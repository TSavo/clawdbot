/**
 * Cloud Mode Index
 *
 * Central export point for cloud mode implementations across all providers.
 *
 * Usage:
 * ```typescript
 * import {
 *   CloudCredentialManager,
 *   CloudRateLimiter,
 *   createStreamHandler,
 *   DEFAULT_CONFIGS,
 * } from '@providers/cloud-mode-index.js';
 *
 * // Initialize a provider with cloud mode
 * const deepgram = new DeepgramSTTPlugin();
 * await deepgram.initializeCloudMode({
 *   apiKey: process.env.DEEPGRAM_API_KEY
 * });
 *
 * // Check rate limit status
 * const status = deepgram.getCloudModeStatus();
 * ```
 */

// Core credential management
export {
  CloudCredentialManager,
  getCredentialManager,
  setCredentialManager,
  type CloudCredential,
  type CredentialStore,
} from './cloud-credential-manager.js';

// Stream handlers for different API patterns
export {
  BaseStreamHandler,
  WebSocketStreamHandler,
  RESTStreamHandler,
  StreamHandlerRegistry,
  createStreamHandler,
  type StreamConfig,
  type StreamOptions,
} from './cloud-stream-handlers.js';

// Rate limiting and quota management
export {
  CloudRateLimiter,
  DEFAULT_CONFIGS,
  type RateLimitConfig,
  type RateLimitStatus,
} from './cloud-rate-limiter.js';

/**
 * Provider Cloud Mode Implementations
 *
 * All cloud providers implement the following methods:
 * - initializeCloudMode(config?): Initialize cloud mode with API credentials
 * - getCloudModeStatus(): Get current rate limit and status
 * - isCloudModeAvailable(): Check if cloud mode is ready
 * - cleanupCloudMode(): Clean up resources
 */

/**
 * Provider Summary
 *
 * STT (Speech-to-Text):
 * - Deepgram: WebSocket streaming, <300ms latency, 36+ languages
 *
 * TTS (Text-to-Speech):
 * - ElevenLabs: REST API streaming, premium voices, 23+ languages
 * - CartesiaAI: WebSocket streaming, ultra-fast synthesis, 32+ languages
 */

/**
 * Integration with plugin-installer
 *
 * The cloud mode infrastructure is fully integrated with the existing
 * plugin-installer pattern:
 *
 * 1. Cloud Mode Detection:
 *    - Enabled when deployment mode is 'cloud'
 *    - Validated in initializeCloudMode()
 *
 * 2. Credential Storage:
 *    - Encrypted storage at ~/.clawdbot/credentials/cloud-credentials.enc
 *    - Environment variable fallback (DEEPGRAM_API_KEY, ELEVENLABS_API_KEY, CARTESIA_API_KEY)
 *    - Automatic credential validation via API endpoints
 *
 * 3. Rate Limiting:
 *    - Per-second, per-minute, per-hour quotas
 *    - Token bucket algorithm for fair distribution
 *    - Automatic backoff with exponential retry
 *
 * 4. Streaming Support:
 *    - WebSocket for real-time providers (Deepgram, CartesiaAI)
 *    - REST for request-response providers (ElevenLabs)
 *    - Automatic connection pooling and reuse
 *
 * 5. Error Recovery:
 *    - Automatic reconnection on connection loss
 *    - Credential refresh support
 *    - Graceful degradation
 */

/**
 * Configuration Example
 *
 * ```json
 * {
 *   "deploymentMode": "cloud",
 *   "providers": {
 *     "deepgram": {
 *       "mode": "cloud",
 *       "apiKey": "${DEEPGRAM_API_KEY}",
 *       "model": "nova-v3",
 *       "language": "en-US"
 *     },
 *     "elevenlabs": {
 *       "mode": "cloud",
 *       "apiKey": "${ELEVENLABS_API_KEY}",
 *       "stability": 0.5,
 *       "similarityBoost": 0.75
 *     },
 *     "cartesia": {
 *       "mode": "cloud",
 *       "apiKey": "${CARTESIA_API_KEY}",
 *       "model": "sonic-turbo"
 *     }
 *   }
 * }
 * ```
 */
