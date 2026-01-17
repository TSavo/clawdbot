/**
 * Whisper STT Configuration
 * Basic Whisper implementation with model size selection
 * Supports both system and Docker deployment modes
 */
export type WhisperConfig = {
  type: "whisper";
  modelSize?: "tiny" | "small" | "base" | "medium" | "large";
  language?: string;
  deploymentMode?: "system" | "docker";
  dockerImage?: string;
  dockerPort?: number;
  pythonPath?: string;
  cachePath?: string;
};

/**
 * Faster-Whisper STT Configuration
 * Optimized Whisper with compute type and threading options
 * Supports both system and Docker deployment modes
 */
export type FasterWhisperConfig = {
  type: "faster-whisper";
  modelSize?: "tiny" | "small" | "base" | "medium" | "large";
  language?: string;
  computeType?: "int8" | "float16" | "float32";
  cpuThreads?: number;
  beamSize?: number;
  deploymentMode?: "system" | "docker";
  dockerImage?: string;
  dockerPort?: number;
};

/**
 * Cloud STT Provider Configuration
 * Shared configuration for cloud providers (OpenAI, Google, Azure)
 */
export type CloudSTTConfig = {
  type: "openai" | "google" | "azure";
  service: string;
  apiKey: string;
  model?: string;
  language?: string;
};

/**
 * Discriminated union of all STT provider configurations
 * Use type narrowing to access provider-specific fields
 *
 * @example
 * ```typescript
 * const config: STTProviderConfig = {...};
 * if (config?.type === "faster-whisper") {
 *   // config is narrowed to FasterWhisperConfig
 *   console.log(config.computeType); // accessible
 * }
 * ```
 */
export type STTProviderConfig = WhisperConfig | FasterWhisperConfig | CloudSTTConfig | undefined;

export type TTSProviderConfig = {
  type?: "cloud" | "local" | "kokoro" | "piper" | "elevenlabs" | "openai" | "google" | "azure" | "cartesia";
  service?: string;
  voice?: string;
  voiceId?: string;
  speed?: number;
  apiKey?: string;
  model?: string;
  outputFormat?: string;
};

export type SystemCapabilities = {
  cpuCount: number;
  totalMemoryGb: number;
  diskSpaceGb: number;
  gpuAvailable: boolean;
  gpuMemoryGb: number;
};

export type VoiceProviderEntry = {
  id: string;
  name?: string;
  enabled?: boolean;
  priority?: number;
  stt?: STTProviderConfig;
  tts?: TTSProviderConfig;
};

export type VoiceProvidersConfig = {
  enabled?: boolean;
  providers?: VoiceProviderEntry[];
  fallbackChain?: string[];
  defaultSttProviderId?: string;
  defaultTtsProviderId?: string;
  stt?: STTProviderConfig;
  tts?: TTSProviderConfig;
  autoDetectCapabilities?: boolean;
  systemCapabilities?: SystemCapabilities;
  migrationMetadata?: {
    migratedFrom?: string;
    migratedAt?: string;
  };
};

export type VoiceConfig = {
  providers?: VoiceProvidersConfig;
};
