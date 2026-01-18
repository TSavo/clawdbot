/**
 * Cloud Deployment Handler
 *
 * Manages Kokoro deployment via external API endpoint.
 * Handles HTTP requests, retries, and connection pooling.
 */
import http from 'http';
import https from 'https';
import { VoiceProviderError } from '../executor.js';
export class CloudHandler {
    constructor(endpoint, apiKey) {
        this.lastHealthCheck = null;
        this.isConnected = false;
        this.retryConfig = {
            maxRetries: 3,
            initialDelayMs: 100,
            maxDelayMs: 5000,
            backoffMultiplier: 2,
        };
        this.endpoint = endpoint;
        this.apiKey = apiKey;
        // Initialize agents with connection pooling
        this.httpAgent = new http.Agent({
            keepAlive: true,
            maxSockets: 10,
            maxFreeSockets: 5,
            timeout: 30000,
        });
        this.httpsAgent = new https.Agent({
            keepAlive: true,
            maxSockets: 10,
            maxFreeSockets: 5,
            timeout: 30000,
        });
    }
    /**
     * Validate endpoint is accessible
     */
    async validateEndpoint(endpoint) {
        try {
            console.log(`[Cloud] Validating endpoint: ${endpoint}`);
            const result = await this.makeRequest('GET', endpoint, '/health', undefined, 5000);
            if (result.statusCode !== 200) {
                console.warn(`[Cloud] Endpoint validation failed with status ${result.statusCode}`);
                this.isConnected = false;
                return false;
            }
            console.log('[Cloud] Endpoint validation successful');
            this.isConnected = true;
            return true;
        }
        catch (error) {
            console.warn('[Cloud] Endpoint validation failed:', error instanceof Error ? error.message : String(error));
            this.isConnected = false;
            return false;
        }
    }
    /**
     * Test API authentication
     */
    async testAuthentication(endpoint, apiKey) {
        try {
            console.log('[Cloud] Testing authentication');
            const headers = {};
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }
            const result = await this.makeRequest('GET', endpoint, '/authenticate', undefined, 5000, headers);
            if (result.statusCode === 401 || result.statusCode === 403) {
                console.warn('[Cloud] Authentication failed');
                return false;
            }
            console.log('[Cloud] Authentication successful');
            return true;
        }
        catch (error) {
            console.warn('[Cloud] Authentication test error:', error instanceof Error ? error.message : String(error));
            return false;
        }
    }
    /**
     * Synthesize text via API with retry logic
     */
    async synthesize(text, options) {
        const body = JSON.stringify({
            text,
            voice: options?.voice || 'default',
            speed: options?.speed || 1.0,
            language: options?.language || 'en',
        });
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': String(Buffer.byteLength(body)),
            ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
        };
        try {
            const result = await this.retryRequest('POST', this.endpoint, '/synthesize', body, headers, 30000);
            if (result.statusCode !== 200) {
                throw new Error(`API returned ${result.statusCode}: ${result.body.toString()}`);
            }
            return result.body;
        }
        catch (error) {
            throw new VoiceProviderError(`Synthesis failed: ${error instanceof Error ? error.message : String(error)}`, 'kokoro-cloud', 'API_ERROR');
        }
    }
    /**
     * Stream synthesis response
     */
    async *synthesizeStream(text) {
        const body = JSON.stringify({
            text,
            stream: true,
        });
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': String(Buffer.byteLength(body)),
            ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
        };
        try {
            // TODO: Implement streaming response handling
            const result = await this.retryRequest('POST', this.endpoint, '/synthesize-stream', body, headers, 60000);
            if (result.statusCode === 200) {
                yield result.body;
            }
            else {
                throw new Error(`API returned ${result.statusCode}: ${result.body.toString()}`);
            }
        }
        catch (error) {
            throw new VoiceProviderError(`Stream synthesis failed: ${error instanceof Error ? error.message : String(error)}`, 'kokoro-cloud', 'API_ERROR');
        }
    }
    /**
     * Get connection status
     */
    async getConnectionStatus() {
        try {
            const startTime = Date.now();
            const result = await this.makeRequest('GET', this.endpoint, '/health', undefined, 5000);
            const latencyMs = Date.now() - startTime;
            this.lastHealthCheck = new Date();
            return {
                connected: result.statusCode === 200 || result.statusCode === 204,
                latencyMs,
                lastCheck: this.lastHealthCheck,
            };
        }
        catch (error) {
            return {
                connected: false,
                lastCheck: this.lastHealthCheck || undefined,
            };
        }
    }
    /**
     * Close connection pool and cleanup
     */
    async close() {
        console.log('[Cloud] Closing connection pool');
        this.httpAgent.destroy();
        this.httpsAgent.destroy();
        this.isConnected = false;
    }
    /**
     * Make HTTP request with automatic retry on failure
     */
    async retryRequest(method, host, path, body, headers, timeout) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                const result = await this.makeRequest(method, host, path, body, timeout, headers);
                // Retry on server errors (5xx status codes)
                if (result.statusCode >= 500 && result.statusCode < 600) {
                    const isLastAttempt = attempt === this.retryConfig.maxRetries;
                    if (!isLastAttempt) {
                        lastError = new Error(`HTTP ${result.statusCode}`);
                        const delayMs = Math.min(this.retryConfig.initialDelayMs *
                            Math.pow(this.retryConfig.backoffMultiplier, attempt - 1), this.retryConfig.maxDelayMs);
                        console.warn(`[Cloud] Server error ${result.statusCode} (attempt ${attempt}/${this.retryConfig.maxRetries}), retrying in ${delayMs}ms`);
                        await new Promise((resolve) => setTimeout(resolve, delayMs));
                        continue;
                    }
                }
                return result;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < this.retryConfig.maxRetries) {
                    const delayMs = Math.min(this.retryConfig.initialDelayMs *
                        Math.pow(this.retryConfig.backoffMultiplier, attempt - 1), this.retryConfig.maxDelayMs);
                    console.warn(`[Cloud] Request failed (attempt ${attempt}/${this.retryConfig.maxRetries}), retrying in ${delayMs}ms`);
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                }
            }
        }
        throw new VoiceProviderError(`Request failed after ${this.retryConfig.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`, 'kokoro-cloud', 'REQUEST_TIMEOUT');
    }
    /**
     * Make individual HTTP request
     */
    makeRequest(method, host, path, body, timeout, headers = {}) {
        return new Promise((resolve, reject) => {
            try {
                const url = new URL(path, host);
                const isHttps = url.protocol === 'https:';
                const client = isHttps ? https : http;
                const agent = isHttps ? this.httpsAgent : this.httpAgent;
                const options = {
                    method,
                    hostname: url.hostname,
                    port: url.port,
                    path: url.pathname + url.search,
                    headers: {
                        'User-Agent': 'KokoroClient/1.0',
                        ...headers,
                    },
                    agent,
                    timeout,
                };
                const request = client.request(options, (response) => {
                    const chunks = [];
                    response.on('data', (chunk) => {
                        chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(Buffer.from(chunk)));
                    });
                    response.on('end', () => {
                        const body = Buffer.concat(chunks.map((c) => Buffer.from(c)));
                        resolve({
                            statusCode: response.statusCode || 500,
                            body: new Uint8Array(body),
                        });
                    });
                });
                request.on('error', (error) => {
                    reject(new VoiceProviderError(`Request error: ${error.message}`, 'kokoro-cloud', 'CONNECTION_FAILED'));
                });
                request.on('timeout', () => {
                    request.destroy();
                    reject(new VoiceProviderError(`Request timeout after ${timeout}ms`, 'kokoro-cloud', 'REQUEST_TIMEOUT'));
                });
                if (body) {
                    request.write(body);
                }
                request.end();
            }
            catch (error) {
                reject(error);
            }
        });
    }
}
//# sourceMappingURL=cloud-handler.js.map