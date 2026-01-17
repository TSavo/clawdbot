/**
 * Voice API Types
 *
 * Type definitions for voice system API endpoints.
 * Used for communication between web UI and gateway server.
 */

/**
 * Base API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Provider metadata sent from API
 */
export interface ApiVoiceProvider {
  id: string;
  name: string;
  type: "stt" | "tts";
  description: string;
  version: string;
  capabilities: string[];
  config: {
    voices?: string[];
    models?: string[];
    languages?: string[];
    speedRange?: [number, number];
    instructions?: boolean;
  };
  status: "available" | "unavailable" | "loading";
  error?: string;
}

/**
 * List providers endpoint response
 * GET /api/voice/providers
 */
export interface GetProvidersResponse {
  providers: ApiVoiceProvider[];
  timestamp: number;
}

/**
 * Voice configuration sent to/from API
 */
export interface ApiVoiceConfig {
  sttProvider: {
    id: string;
    config?: Record<string, unknown>;
  };
  ttsProvider: {
    id: string;
    config?: Record<string, unknown>;
  };
  fallbackChain?: string[];
  enabled: boolean;
}

/**
 * Get configuration endpoint response
 * GET /api/voice/config
 */
export interface GetConfigResponse {
  config: ApiVoiceConfig;
  timestamp: number;
}

/**
 * Save configuration endpoint request
 * POST /api/voice/config
 */
export interface SetConfigRequest {
  config: ApiVoiceConfig;
}

/**
 * Provider status details
 */
export interface ApiProviderStatus {
  id: string;
  name: string;
  available: boolean;
  healthy: boolean;
  lastChecked: number;
  uptime?: number;
  resourceUsage?: {
    gpu?: {
      enabled: boolean;
      utilization?: number;
      memory?: number;
    };
    memory?: number;
    cpu?: number;
  };
  warnings?: string[];
  errors?: string[];
}

/**
 * Provider status endpoint response
 * GET /api/voice/providers/:providerId/status
 */
export interface GetProviderStatusResponse {
  status: ApiProviderStatus;
  timestamp: number;
}

/**
 * Provider capabilities endpoint response
 * GET /api/voice/providers/:providerId/capabilities
 */
export interface GetCapabilitiesResponse {
  voices?: Array<{
    id: string;
    name: string;
    language?: string;
    gender?: string;
    accent?: string;
  }>;
  models?: Array<{
    id: string;
    name: string;
    description?: string;
    size?: string;
  }>;
  languages?: Array<{
    code: string;
    name: string;
    nativeName?: string;
  }>;
  speeds?: {
    min: number;
    max: number;
    default: number;
    step?: number;
  };
  supportedInstructions?: boolean;
  timestamp: number;
}

/**
 * TTS test request
 * POST /api/voice/test-tts
 */
export interface TestTTSRequest {
  providerId: string;
  text: string;
  voice?: string;
  speed?: number;
  instructions?: string;
}

/**
 * TTS test response
 */
export interface TestTTSResponse {
  success: boolean;
  provider: string;
  duration: number;
  audioUrl?: string;
  audioBase64?: string;
  error?: string;
  timestamp: number;
}

/**
 * STT test request
 * POST /api/voice/test-stt (multipart/form-data)
 *
 * Form fields:
 * - providerId: string
 * - audio: File (audio/wav, audio/mp3, etc.)
 * - language?: string
 */
export interface TestSTTRequest {
  providerId: string;
  language?: string;
  // audio file sent as multipart
}

/**
 * STT test response
 */
export interface TestSTTResponse {
  success: boolean;
  provider: string;
  duration: number;
  transcript?: string;
  confidence?: number;
  error?: string;
  timestamp: number;
}

/**
 * System health check response
 * GET /api/voice/health
 */
export interface VoiceSystemHealth {
  online: boolean;
  providers: {
    [providerId: string]: {
      available: boolean;
      healthy: boolean;
      error?: string;
    };
  };
  systemStatus: {
    gpu?: boolean;
    memory?: number;
    cpu?: number;
    storageAvailable?: boolean;
  };
  timestamp: number;
}

/**
 * Provider discovery response
 * GET /api/voice/discovery
 */
export interface DiscoveryResponse {
  available: ApiVoiceProvider[];
  notInstalled: Array<{
    id: string;
    name: string;
    description: string;
    installCommand?: string;
  }>;
  timestamp: number;
}

/**
 * Configuration schema for form validation
 * GET /api/voice/schema
 */
export interface ConfigSchema {
  sttProvider: {
    type: "select";
    options: Array<{ id: string; name: string }>;
  };
  ttsProvider: {
    type: "select";
    options: Array<{ id: string; name: string }>;
  };
  sttConfig?: Record<string, unknown>;
  ttsConfig?: Record<string, unknown>;
  fallbackChain?: {
    type: "array";
    items: string;
  };
}

/**
 * Error response structure
 */
export interface VoiceApiError {
  code: string;
  message: string;
  provider?: string;
  statusCode: number;
  timestamp: number;
  traceId?: string;
}
