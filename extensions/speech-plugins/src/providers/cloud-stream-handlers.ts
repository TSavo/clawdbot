/**
 * Cloud Stream Handlers
 *
 * Implements WebSocket and REST API streaming for cloud-based voice providers.
 *
 * Features:
 * - WebSocket streaming for real-time audio (Deepgram, CartesiaAI)
 * - REST API streaming for request-response (ElevenLabs)
 * - Connection pooling and reuse
 * - Automatic reconnection
 * - Error handling and timeouts
 */

import { EventEmitter } from 'node:events';
import type { WebSocket } from 'ws';

export interface StreamConfig {
  url: string;
  apiKey: string;
  headers?: Record<string, string>;
  timeout?: number;
  maxRetries?: number;
}

export interface StreamOptions {
  format?: string;
  sampleRate?: number;
  language?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Base stream handler class
 */
export abstract class BaseStreamHandler extends EventEmitter {
  protected url: string;
  protected apiKey: string;
  protected headers: Record<string, string>;
  protected timeout: number;
  protected maxRetries: number;

  constructor(config: StreamConfig) {
    super();
    this.url = config.url;
    this.apiKey = config.apiKey;
    this.headers = config.headers || {};
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
  }

  abstract connect(options: StreamOptions): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract send(data: Buffer): Promise<void>;
  abstract isConnected(): boolean;
}

/**
 * WebSocket stream handler for real-time streaming providers
 *
 * Used by Deepgram and CartesiaAI for low-latency audio streaming.
 */
export class WebSocketStreamHandler extends BaseStreamHandler {
  private ws: WebSocket | null = null;
  private isReady = false;
  private retryCount = 0;
  private messageQueue: Buffer[] = [];
  private reconnectTimer: NodeJS.Timeout | null = null;

  /**
   * Connect to WebSocket endpoint
   */
  async connect(options: StreamOptions): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    try {
      // Dynamic import to avoid circular dependency
      const { WebSocket: WS } = await import('ws');

      // Build connection URL with query parameters
      const url = new URL(this.url);
      if (options.language) {
        url.searchParams.append('language', options.language);
      }
      if (options.sampleRate) {
        url.searchParams.append('sample_rate', String(options.sampleRate));
      }

      // Create headers with API key
      const headers = {
        ...this.headers,
        'Authorization': `Token ${this.apiKey}`,
      };

      // Establish connection with timeout
      return new Promise((resolve, reject) => {
        const timeoutHandle = setTimeout(() => {
          if (this.ws) {
            this.ws.close();
            this.ws = null;
          }
          reject(new Error(`WebSocket connection timeout after ${this.timeout}ms`));
        }, this.timeout);

        try {
          this.ws = new WS(url.toString(), { headers });

          this.ws.on('open', () => {
            clearTimeout(timeoutHandle);
            this.isReady = true;
            this.retryCount = 0;

            // Drain message queue
            this.drainQueue();

            this.emit('connected');
            resolve();
          });

          this.ws.on('message', (data: Buffer) => {
            this.emit('data', data);
          });

          this.ws.on('error', (error: Error) => {
            clearTimeout(timeoutHandle);
            this.emit('error', error);
            reject(error);
          });

          this.ws.on('close', () => {
            this.isReady = false;
            this.emit('disconnected');
            this.attemptReconnect();
          });
        } catch (error) {
          clearTimeout(timeoutHandle);
          reject(error);
        }
      });
    } catch (error) {
      throw new Error(
        `Failed to connect WebSocket: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Disconnect from WebSocket
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      return new Promise((resolve) => {
        if (this.ws) {
          this.ws.once('close', () => {
            this.ws = null;
            this.isReady = false;
            resolve();
          });
          this.ws.close();
        } else {
          this.isReady = false;
          resolve();
        }
      });
    }
  }

  /**
   * Send data through WebSocket
   */
  async send(data: Buffer): Promise<void> {
    if (!this.isReady || !this.ws) {
      // Queue message if not connected
      this.messageQueue.push(data);
      return;
    }

    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      this.ws.send(data, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.isReady && this.ws !== null;
  }

  /**
   * Drain queued messages
   */
  private drainQueue(): void {
    while (this.messageQueue.length > 0) {
      const data = this.messageQueue.shift();
      if (data) {
        this.send(data).catch((error) => {
          this.emit('error', error);
        });
      }
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.retryCount >= this.maxRetries) {
      this.emit('error', new Error('Max reconnection attempts exceeded'));
      return;
    }

    this.retryCount += 1;
    const delayMs = Math.min(1000 * Math.pow(2, this.retryCount - 1), 30000);

    this.reconnectTimer = setTimeout(() => {
      this.connect({ sampleRate: 16000 }).catch((error) => {
        this.emit('error', error);
      });
    }, delayMs);
  }
}

/**
 * REST stream handler for request-response providers
 *
 * Used by ElevenLabs for audio synthesis with streaming response.
 */
export class RESTStreamHandler extends BaseStreamHandler {
  private controller: AbortController | null = null;
  private isActive = false;

  /**
   * Connect for REST (no-op, connection is per-request)
   */
  async connect(options: StreamOptions): Promise<void> {
    this.isActive = true;
    this.emit('connected');
  }

  /**
   * Disconnect for REST
   */
  async disconnect(): Promise<void> {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    this.isActive = false;
    this.emit('disconnected');
  }

  /**
   * Send request and stream response
   */
  async send(data: Buffer): Promise<void> {
    if (!this.isActive) {
      throw new Error('Stream handler not connected');
    }

    this.controller = new AbortController();

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: data,
        signal: this.controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Stream the response
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          if (value) {
            this.emit('data', value);
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Expected when disconnecting
        return;
      }
      throw error;
    } finally {
      this.controller = null;
    }
  }

  /**
   * Check if stream handler is active
   */
  isConnected(): boolean {
    return this.isActive;
  }
}

/**
 * Stream handler factory
 */
export function createStreamHandler(
  type: 'websocket' | 'rest',
  config: StreamConfig,
): BaseStreamHandler {
  switch (type) {
    case 'websocket':
      return new WebSocketStreamHandler(config);
    case 'rest':
      return new RESTStreamHandler(config);
    default:
      throw new Error(`Unknown stream handler type: ${type}`);
  }
}

/**
 * Stream handler registry for managing multiple concurrent streams
 */
export class StreamHandlerRegistry extends EventEmitter {
  private handlers: Map<string, BaseStreamHandler> = new Map();

  /**
   * Register a stream handler
   */
  register(id: string, handler: BaseStreamHandler): void {
    if (this.handlers.has(id)) {
      throw new Error(`Stream handler with id ${id} already registered`);
    }

    handler.on('error', (error) => {
      this.emit('error', { id, error });
    });

    this.handlers.set(id, handler);
  }

  /**
   * Get a registered stream handler
   */
  get(id: string): BaseStreamHandler | undefined {
    return this.handlers.get(id);
  }

  /**
   * Remove a stream handler
   */
  async remove(id: string): Promise<void> {
    const handler = this.handlers.get(id);
    if (handler) {
      await handler.disconnect();
      this.handlers.delete(id);
    }
  }

  /**
   * Close all handlers
   */
  async closeAll(): Promise<void> {
    const promises = Array.from(this.handlers.entries()).map(([, handler]) =>
      handler.disconnect().catch((error) => {
        this.emit('error', error);
      }),
    );

    await Promise.all(promises);
    this.handlers.clear();
  }

  /**
   * Get number of active handlers
   */
  count(): number {
    return this.handlers.size;
  }
}
