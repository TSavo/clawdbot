/**
 * CartesiaAI TTS Provider Executor
 *
 * Implements VoiceProviderExecutor for CartesiaAI's ultra-fast voice synthesis.
 *
 * Supported Models:
 * - Sonic-3 (DEFAULT): ~90ms end-to-end latency, best balance of speed & quality
 * - Sonic-Turbo: <40ms end-to-end latency, ultra-fast for real-time applications
 *
 * Model Selection Guide:
 * - Use Sonic-3 for: general TTS, content delivery, pre-recorded messages
 * - Use Sonic-Turbo for: live conversations, low-latency real-time synthesis, voice agents
 *
 * Features:
 * - Model-selectable ultra-fast voice synthesis with 40-90ms latency
 * - Zero-shot voice cloning from 3 seconds of reference audio
 * - Emotion control (neutral, happy, sad, angry, surprised)
 * - Multi-language support (40+ languages)
 * - Audio control (pitch, speed, speaking rate)
 * - Streaming synthesis with per-chunk latency tracking
 * - Connection pooling and keep-alive for production use
 */
import { EventEmitter } from 'events';
import { AudioFormat as AudioFormatEnum, BaseVoiceProviderExecutor, VoiceProviderError, } from './executor.js';
/**
 * CartesiaAI TTS executor
 */
export class CartesiaExecutor extends BaseVoiceProviderExecutor {
    constructor(config) {
        super();
        this.id = 'cartesia';
        this.isInitialized = false;
        this.eventEmitter = new EventEmitter();
        this.availableVoices = new Map();
        this.metricsBuffer = [];
        this.MAX_METRICS = 1000;
        // Connection pooling
        this.connectionPool = [];
        this.activeRequests = 0;
        // Voice cache for pre-defined voices
        this.voiceCache = new Map();
        this.config = config;
        this.poolSize = config.connectionPoolSize || 5;
        this.apiEndpoint = config.apiEndpoint || 'https://api.cartesia.ai/api/v1/';
        this.validateConfig();
    }
    /**
     * Validate configuration
     */
    validateConfig() {
        if (!this.config.apiKey) {
            throw new VoiceProviderError('CartesiaAI API key is required', this.id, 'MISSING_API_KEY');
        }
        if (!this.config.model || !['sonic-3', 'sonic-turbo'].includes(this.config.model)) {
            throw new VoiceProviderError('Invalid model: must be sonic-3 or sonic-turbo', this.id, 'INVALID_MODEL');
        }
        if (this.config.speed && (this.config.speed < 0.5 || this.config.speed > 2.0)) {
            throw new VoiceProviderError('Speed must be between 0.5 and 2.0', this.id, 'INVALID_SPEED');
        }
        if (this.config.pitch && (this.config.pitch < 0.5 || this.config.pitch > 2.0)) {
            throw new VoiceProviderError('Pitch must be between 0.5 and 2.0', this.id, 'INVALID_PITCH');
        }
        if (this.config.voiceCloning && !this.config.voiceCloning.referenceText) {
            throw new VoiceProviderError('Voice cloning requires referenceText', this.id, 'MISSING_REFERENCE_TEXT');
        }
    }
    /**
     * Initialize CartesiaAI service with model selection
     *
     * Setup process:
     * 1. Validate configuration and model selection (sonic-3 or sonic-turbo)
     * 2. Test API authentication
     * 3. Load available voices
     * 4. Initialize connection pool for concurrent requests
     *
     * Model is locked during initialization and applies to all subsequent synthesis operations.
     * To use a different model, create a new CartesiaExecutor instance.
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            // Test API connectivity and authentication
            await this.testAuthentication();
            // Load available voices
            await this.loadVoices();
            // Initialize connection pool
            this.initializeConnectionPool();
            this.isInitialized = true;
            console.log(`[CartesiaAI] Initialized with model: ${this.config.model}, voices loaded: ${this.availableVoices.size}`);
        }
        catch (error) {
            throw new VoiceProviderError(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`, this.id, 'INIT_FAILED');
        }
    }
    /**
     * Test API authentication
     */
    async testAuthentication() {
        try {
            const response = await this.makeApiRequest('voices', 'GET');
            if (!response || typeof response !== 'object') {
                throw new Error('Invalid response from API');
            }
        }
        catch (error) {
            throw new VoiceProviderError(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`, this.id, 'AUTH_FAILED');
        }
    }
    /**
     * Load available voices from API
     */
    async loadVoices() {
        try {
            const response = await this.makeApiRequest('voices', 'GET');
            if (response && Array.isArray(response)) {
                for (const voice of response) {
                    this.availableVoices.set(voice.id, voice);
                    this.voiceCache.set(voice.name, voice.id);
                }
            }
        }
        catch (error) {
            console.warn('[CartesiaAI] Failed to load voices:', error);
            // Continue initialization even if voice loading fails
        }
    }
    /**
     * Initialize connection pool for concurrent requests
     */
    initializeConnectionPool() {
        // Pre-create AbortControllers for connection pooling
        for (let i = 0; i < this.poolSize; i++) {
            this.connectionPool.push(new AbortController());
        }
    }
    /**
     * Get next available connection from pool
     */
    getPooledConnection() {
        let controller = this.connectionPool.pop();
        if (!controller) {
            // Pool exhausted, create new (will be returned to pool after use)
            controller = new AbortController();
        }
        return controller;
    }
    /**
     * Return connection to pool
     */
    returnToPool(controller) {
        if (this.connectionPool.length < this.poolSize) {
            // Reset controller for reuse
            controller = new AbortController();
            this.connectionPool.push(controller);
        }
    }
    /**
     * Make API request with connection pooling
     */
    async makeApiRequest(endpoint, method = 'POST', body, options) {
        const controller = this.getPooledConnection();
        const timeout = options?.timeout || this.config.timeout || 30000;
        try {
            this.activeRequests++;
            this.eventEmitter.emit('request-start', {
                endpoint,
                method,
                timestamp: Date.now(),
            });
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            try {
                const response = await fetch(`${this.apiEndpoint}${endpoint}`, {
                    method,
                    headers: {
                        'X-API-Key': this.config.apiKey,
                        'Content-Type': 'application/json',
                    },
                    body: body ? JSON.stringify(body) : undefined,
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    let errorMessage = `HTTP ${response.status}`;
                    try {
                        const errorBody = (await response.json());
                        errorMessage = errorBody.message || errorMessage;
                    }
                    catch {
                        // Use default error message
                    }
                    throw new VoiceProviderError(`API request failed: ${errorMessage}`, this.id, `HTTP_${response.status}`);
                }
                const contentType = response.headers?.get?.('content-type') || '';
                if (contentType.includes('application/json') || contentType === '') {
                    // Try to parse as JSON, fallback to response object
                    try {
                        return await response.json();
                    }
                    catch {
                        return response;
                    }
                }
                // Return raw response for binary data
                return response;
            }
            finally {
                clearTimeout(timeoutId);
            }
        }
        catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new VoiceProviderError(`Request timeout after ${timeout}ms`, this.id, 'REQUEST_TIMEOUT');
            }
            throw error;
        }
        finally {
            this.activeRequests--;
            this.returnToPool(controller);
            this.eventEmitter.emit('request-end', {
                endpoint,
                timestamp: Date.now(),
            });
        }
    }
    /**
     * Get provider capabilities
     *
     * Returns capabilities based on selected model:
     * - Sonic-3: ~90ms end-to-end latency, excellent quality
     * - Sonic-Turbo: <40ms end-to-end latency, ultra-fast for real-time
     *
     * All models support 40+ languages, streaming synthesis, and connection pooling.
     */
    getCapabilities() {
        const isUltraFast = this.config.model === 'sonic-turbo';
        return {
            supportedFormats: [AudioFormatEnum.PCM_16, AudioFormatEnum.MP3, AudioFormatEnum.AAC],
            supportedSampleRates: [16000, 24000, 44100, 48000],
            supportedLanguages: [
                'en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'nl', 'ru', 'uk', 'ja', 'ko',
                'zh', 'tr', 'ar', 'hi', 'th', 'vi', 'id', 'fi', 'sv', 'no', 'da', 'cs',
                'hu', 'ro', 'bg', 'hr', 'sk', 'sl', 'el', 'he', 'fa', 'bn', 'pa', 'ta',
            ],
            supportsStreaming: true,
            maxConcurrentSessions: this.poolSize,
            /**
             * Estimated latency varies by model:
             * - Sonic-Turbo: 40ms (ultra-fast, ideal for live conversations)
             * - Sonic-3: 90ms (balanced quality and speed, recommended default)
             *
             * Actual latency depends on text length, network conditions, and model load.
             */
            estimatedLatencyMs: isUltraFast ? 40 : 90,
            requiresNetworkConnection: true,
            requiresLocalModel: false,
        };
    }
    /**
     * Synthesize text to speech using the configured model
     *
     * Model selection affects latency and quality:
     * - Sonic-3 (default): ~90ms, best quality, recommended for most use cases
     * - Sonic-Turbo: <40ms, ultra-fast for real-time voice agents and live conversations
     *
     * The model is included in the synthesis request and cannot be overridden per-request
     * (configured at initialization time).
     *
     * @param text Text to synthesize
     * @param options Optional synthesis parameters (voice, sampleRate, speed, pitch)
     * @returns AudioBuffer with synthesized audio
     */
    async synthesize(text, options) {
        if (!this.isInitialized) {
            throw new VoiceProviderError('CartesiaAI not initialized', this.id, 'NOT_INITIALIZED');
        }
        if (!text || text.trim().length === 0) {
            throw new VoiceProviderError('Text cannot be empty', this.id, 'EMPTY_TEXT');
        }
        const metrics = {
            startTime: Date.now(),
            inputChars: text.length,
            model: this.config.model,
        };
        try {
            const request = this.buildSynthesisRequest(text, options);
            metrics.firstByteTime = Date.now();
            const response = await this.makeApiRequest('speak', 'POST', request);
            // Handle streaming response
            const audioData = await this.extractAudioData(response);
            metrics.endTime = Date.now();
            metrics.audioSamples = audioData.length / 2; // 16-bit PCM
            this.recordMetrics(metrics);
            return {
                data: audioData,
                format: AudioFormatEnum.PCM_16,
                sampleRate: 16000,
                duration: (audioData.length / 2 / 16000) * 1000,
                channels: 1,
            };
        }
        catch (error) {
            throw new VoiceProviderError(`Synthesis failed: ${error instanceof Error ? error.message : String(error)}`, this.id, 'SYNTHESIS_FAILED');
        }
    }
    /**
     * Stream-based synthesis using WebSocket with proper flow control
     *
     * Supports streaming text input for real-time synthesis using the configured model:
     * - Sonic-3: Optimal for streaming content with consistent latency
     * - Sonic-Turbo: Ultra-low latency for interactive voice applications
     *
     * Features:
     * - Backpressure handling for buffer management
     * - Per-chunk latency tracking
     * - Model selection included in WebSocket context message
     * - Proper error handling and cleanup
     *
     * The model_id is sent in the WebSocket context initialization and cannot be changed
     * mid-stream (must be configured at initialization).
     *
     * @param textStream Readable stream of text chunks
     * @param options Optional synthesis parameters (voice, sampleRate, speed, pitch)
     * @yields AudioBuffer chunks as they are synthesized
     */
    async *synthesizeStream(textStream, options) {
        if (!this.isInitialized) {
            throw new VoiceProviderError('CartesiaAI not initialized', this.id, 'NOT_INITIALIZED');
        }
        const wsUrl = 'wss://api.cartesia.ai/tts/websocket';
        let ws = null;
        const audioChunks = [];
        let streamComplete = false;
        let firstChunkTime = null;
        const startTime = performance.now();
        // Flow control state
        const MAX_BUFFERED_CHUNKS = 10;
        let isBufferFull = false;
        let pendingAudioResolvers = [];
        // Error state
        let streamError = null;
        let textStreamComplete = false;
        try {
            // Dynamically import WebSocket (works in both Node and browser)
            let WebSocketImpl;
            if (globalThis.WebSocket) {
                WebSocketImpl = globalThis.WebSocket;
            }
            else {
                // For Node.js, try importing 'ws' package
                try {
                    const wsModule = await import('ws');
                    WebSocketImpl = wsModule.default || wsModule;
                }
                catch {
                    throw new Error('WebSocket not available and ws package not found');
                }
            }
            ws = new WebSocketImpl(wsUrl);
            // Setup WebSocket connection with timeout
            const wsOpenPromise = new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => reject(new Error('WebSocket connection timeout after 5000ms')), 5000);
                const handleOpen = () => {
                    clearTimeout(timeoutId);
                    ws.removeEventListener('open', handleOpen);
                    ws.removeEventListener('error', handleError);
                    resolve();
                };
                const handleError = (error) => {
                    clearTimeout(timeoutId);
                    ws.removeEventListener('open', handleOpen);
                    ws.removeEventListener('error', handleError);
                    reject(error instanceof Error
                        ? error
                        : new Error('WebSocket connection failed'));
                };
                ws.addEventListener('open', handleOpen);
                ws.addEventListener('error', handleError);
            });
            await wsOpenPromise;
            // Send context message with voice/model settings
            // Model selection (sonic-3 or sonic-turbo) is included here and applies to all chunks
            const voice = this.resolveVoice(options?.voice);
            const voiceMode = this.config.voiceCloning ? 'clone' : 'id';
            const sampleRate = options?.sampleRate || 16000;
            const contextMessage = {
                type: 'context',
                /**
                 * Model selection for this stream:
                 * - 'sonic-3': ~90ms latency, best quality (recommended default)
                 * - 'sonic-turbo': <40ms latency, ultra-fast for real-time
                 *
                 * Once set in context, model applies to entire stream and cannot be changed per-chunk.
                 */
                model_id: this.config.model,
                voice: {
                    mode: voiceMode,
                    ...(voiceMode === 'id' && { id: voice }),
                    ...(voiceMode === 'clone' && {
                        clone: {
                            reference_audio: this.arrayBufferToBase64(this.config.voiceCloning.referenceAudio),
                            reference_text: this.config.voiceCloning.referenceText,
                        },
                    }),
                },
                output_format: {
                    container: 'raw',
                    encoding: 'pcm_s16',
                    sample_rate: sampleRate,
                },
                ...(this.config.emotion && { emotion: this.config.emotion }),
                ...(options?.speed && { speed: options.speed }),
                ...(options?.pitch && { pitch: options.pitch }),
            };
            ws.send(JSON.stringify(contextMessage));
            // Setup message handler for audio chunks with proper error handling
            const handleMessage = (event) => {
                try {
                    const data = JSON.parse(event.data.toString());
                    if (data.type === 'chunk' && data.audio) {
                        // Track first chunk latency
                        if (!firstChunkTime) {
                            firstChunkTime = performance.now();
                            const latency = firstChunkTime - startTime;
                            console.log(`[CartesiaAI] First audio chunk received in ${latency.toFixed(2)}ms`);
                        }
                        // Decode base64 audio
                        const audioData = Buffer.from(data.audio, 'base64');
                        const audioBuffer = {
                            data: new Uint8Array(audioData),
                            format: AudioFormatEnum.PCM_16,
                            sampleRate,
                            duration: (audioData.length / 2 / sampleRate) * 1000,
                            channels: 1,
                        };
                        audioChunks.push(audioBuffer);
                        // Check if buffer is full and apply backpressure
                        if (audioChunks.length >= MAX_BUFFERED_CHUNKS) {
                            isBufferFull = true;
                        }
                        // Wake up any waiting consumers
                        const resolver = pendingAudioResolvers.shift();
                        if (resolver) {
                            resolver();
                        }
                    }
                    else if (data.type === 'done') {
                        streamComplete = true;
                        // Wake up any waiting consumers
                        pendingAudioResolvers.forEach((resolver) => resolver());
                        pendingAudioResolvers = [];
                    }
                    else if (data.type === 'error') {
                        const error = new VoiceProviderError(`WebSocket error: ${data.message || 'Unknown error'}`, this.id, 'SYNTHESIS_FAILED');
                        streamError = error;
                        pendingAudioResolvers.forEach((resolver) => resolver());
                        pendingAudioResolvers = [];
                    }
                }
                catch (error) {
                    const parseError = error instanceof Error ? error : new Error('Message parsing failed');
                    streamError = parseError;
                    console.error('[CartesiaAI] Message parsing error:', parseError);
                    pendingAudioResolvers.forEach((resolver) => resolver());
                    pendingAudioResolvers = [];
                }
            };
            ws.addEventListener('message', handleMessage);
            // Stream text chunks to WebSocket with backpressure handling
            const textReader = textStream.getReader();
            let chunkId = 0;
            const textStreamPromise = (async () => {
                try {
                    while (!streamError && !textStreamComplete) {
                        // Apply backpressure: wait if buffer is full
                        if (isBufferFull) {
                            await new Promise((resolve) => {
                                const checkBuffer = setInterval(() => {
                                    if (audioChunks.length < MAX_BUFFERED_CHUNKS / 2) {
                                        isBufferFull = false;
                                        clearInterval(checkBuffer);
                                        resolve();
                                    }
                                }, 50);
                            });
                        }
                        const { done, value } = await textReader.read();
                        if (value && value.trim()) {
                            // Send text chunk immediately (no buffering)
                            const textMessage = {
                                type: 'chunk',
                                chunk_id: `chunk_${chunkId++}`,
                                text: value,
                                continue: !done,
                            };
                            try {
                                ws.send(JSON.stringify(textMessage));
                            }
                            catch (error) {
                                console.warn('[CartesiaAI] Failed to send text chunk:', error);
                            }
                        }
                        if (done) {
                            // Signal end of text stream
                            try {
                                ws.send(JSON.stringify({ type: 'done' }));
                            }
                            catch (error) {
                                console.warn('[CartesiaAI] Failed to send done message:', error);
                            }
                            textStreamComplete = true;
                            break;
                        }
                    }
                }
                catch (error) {
                    console.error('[CartesiaAI] Text streaming error:', error);
                    streamError = streamError || (error instanceof Error ? error : new Error('Text streaming failed'));
                }
                finally {
                    textReader.releaseLock();
                }
            })();
            // Yield audio chunks as they arrive
            while (!streamComplete || audioChunks.length > 0) {
                // Check for errors
                if (streamError) {
                    throw streamError;
                }
                if (audioChunks.length > 0) {
                    const chunk = audioChunks.shift();
                    // Update backpressure state when buffer drains
                    if (isBufferFull && audioChunks.length < MAX_BUFFERED_CHUNKS / 2) {
                        isBufferFull = false;
                    }
                    yield chunk;
                }
                else if (!streamComplete) {
                    // Wait for next chunk with timeout
                    const chunkWait = await Promise.race([
                        new Promise((resolve) => {
                            pendingAudioResolvers.push(resolve);
                        }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Audio chunk timeout after 10000ms')), 10000)),
                    ]).catch((error) => {
                        throw error;
                    });
                }
                else {
                    break;
                }
            }
            // Wait for text streaming to complete
            await textStreamPromise;
        }
        catch (error) {
            throw new VoiceProviderError(`WebSocket streaming failed: ${error instanceof Error ? error.message : String(error)}`, this.id, 'SYNTHESIS_FAILED');
        }
        finally {
            // Cleanup
            if (ws) {
                try {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.close(1000, 'Stream complete');
                    }
                }
                catch (error) {
                    console.warn('[CartesiaAI] Error closing WebSocket:', error);
                }
            }
        }
    }
    /**
     * Build synthesis request with model selection
     *
     * The request includes the configured model (sonic-3 or sonic-turbo) which determines
     * synthesis latency and quality characteristics.
     *
     * Model selection:
     * - sonic-3: Recommended for most use cases, ~90ms latency, excellent quality
     * - sonic-turbo: For ultra-low latency applications, <40ms latency
     *
     * @param text The text to synthesize
     * @param options Optional parameters (voice, sampleRate, speed, pitch)
     * @returns CartesiaSynthesisRequest with model_id set to configured model
     */
    buildSynthesisRequest(text, options) {
        const voice = this.resolveVoice(options?.voice);
        const voiceMode = this.config.voiceCloning ? 'clone' : 'id';
        const request = {
            text,
            /**
             * Model selection for this request:
             * - 'sonic-3' (default): Best quality/speed balance, ~90ms
             * - 'sonic-turbo': Ultra-fast for real-time synthesis, <40ms
             */
            model_id: this.config.model,
            voice: {
                mode: voiceMode,
                ...(voiceMode === 'id' && { id: voice }),
                ...(voiceMode === 'clone' && {
                    clone: {
                        reference_audio: this.arrayBufferToBase64(this.config.voiceCloning.referenceAudio),
                        reference_text: this.config.voiceCloning.referenceText,
                    },
                }),
            },
            output_format: {
                container: 'raw',
                encoding: 'pcm_s16',
                sample_rate: options?.sampleRate || 16000,
            },
        };
        // Add optional controls
        if (this.config.speed || this.config.pitch || options?.speed || options?.pitch) {
            request.controls = {
                speed: options?.speed ?? this.config.speed ?? 1.0,
                pitch: options?.pitch ?? this.config.pitch ?? 1.0,
            };
        }
        // Add emotion if specified
        if (this.config.emotion) {
            request.emotion = this.config.emotion;
        }
        return request;
    }
    /**
     * Resolve voice ID from voice name or predefined ID
     */
    resolveVoice(voiceNameOrId) {
        if (voiceNameOrId) {
            // Check if it's a voice ID first
            if (this.availableVoices.has(voiceNameOrId)) {
                return voiceNameOrId;
            }
            // Try to resolve by name
            const voiceId = this.voiceCache.get(voiceNameOrId);
            if (voiceId) {
                return voiceId;
            }
            console.warn(`Voice not found: ${voiceNameOrId}, using default`);
        }
        // Return configured voice ID or first available
        if (this.config.voiceId) {
            return this.config.voiceId;
        }
        const firstVoice = this.availableVoices.values().next().value;
        if (firstVoice?.id) {
            return firstVoice.id;
        }
        throw new VoiceProviderError('No voices available', this.id, 'NO_VOICES');
    }
    /**
     * Extract audio data from response
     */
    async extractAudioData(response) {
        // Handle Response object with arrayBuffer method
        if (response && typeof response.arrayBuffer === 'function') {
            const buffer = await response.arrayBuffer();
            return new Uint8Array(buffer);
        }
        // Handle JSON response with base64 audio
        if (response && response.audio) {
            return this.base64ToArrayBuffer(response.audio);
        }
        throw new VoiceProviderError('Invalid response format', this.id, 'INVALID_RESPONSE');
    }
    /**
     * Convert base64 to ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binaryString = Buffer.from(base64, 'base64').toString('binary');
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
    /**
     * Convert ArrayBuffer to base64
     */
    arrayBufferToBase64(buffer) {
        let binary = '';
        for (let i = 0; i < buffer.byteLength; i++) {
            binary += String.fromCharCode(buffer[i]);
        }
        return Buffer.from(binary, 'binary').toString('base64');
    }
    /**
     * Record synthesis metrics
     */
    recordMetrics(metrics) {
        this.metricsBuffer.push(metrics);
        // Keep buffer size bounded
        if (this.metricsBuffer.length > this.MAX_METRICS) {
            this.metricsBuffer = this.metricsBuffer.slice(-this.MAX_METRICS);
        }
        this.eventEmitter.emit('synthesis-complete', {
            ...metrics,
            latencyMs: metrics.endTime ? metrics.endTime - metrics.startTime : 0,
            firstByteLatencyMs: metrics.firstByteTime
                ? metrics.firstByteTime - metrics.startTime
                : 0,
        });
    }
    /**
     * Get synthesis metrics
     */
    getMetrics() {
        return [...this.metricsBuffer];
    }
    /**
     * Get average latency from recent syntheses
     */
    getAverageLatency() {
        if (this.metricsBuffer.length === 0) {
            return this.getCapabilities().estimatedLatencyMs;
        }
        const recentMetrics = this.metricsBuffer.slice(-100);
        const totalLatency = recentMetrics.reduce((acc, m) => {
            return acc + (m.endTime ? m.endTime - m.startTime : 0);
        }, 0);
        return Math.round(totalLatency / recentMetrics.length);
    }
    /**
     * Check if service is healthy
     */
    async isHealthy() {
        if (!this.isInitialized) {
            return false;
        }
        try {
            // Try a quick test request
            await this.makeApiRequest('voices', 'GET', undefined, { timeout: 5000 });
            return true;
        }
        catch (error) {
            console.warn('[CartesiaAI] Health check failed:', error);
            return false;
        }
    }
    /**
     * Shutdown CartesiaAI service
     */
    async shutdown() {
        try {
            // Wait for active requests to complete
            let waitCount = 0;
            while (this.activeRequests > 0 && waitCount < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                waitCount++;
            }
            if (this.activeRequests > 0) {
                console.warn(`[CartesiaAI] Shutdown with ${this.activeRequests} active requests still pending`);
            }
            // Clear connection pool
            this.connectionPool = [];
            // Clear metrics buffer
            this.metricsBuffer = [];
            this.isInitialized = false;
            console.log('[CartesiaAI] Shutdown complete');
        }
        catch (error) {
            console.error('[CartesiaAI] Shutdown error:', error);
        }
    }
    /**
     * Get event emitter for monitoring
     */
    getEventEmitter() {
        return this.eventEmitter;
    }
    /**
     * Transcribe audio (not supported)
     */
    async transcribe(_audio, _options) {
        throw new VoiceProviderError('CartesiaAI is a TTS-only provider, transcription not supported', this.id, 'TRANSCRIPTION_NOT_SUPPORTED');
    }
    /**
     * Transcribe stream (not supported)
     */
    async *transcribeStream(_audioStream, _options) {
        throw new VoiceProviderError('CartesiaAI is a TTS-only provider, transcription not supported', this.id, 'TRANSCRIPTION_NOT_SUPPORTED');
    }
}
//# sourceMappingURL=cartesia.js.map