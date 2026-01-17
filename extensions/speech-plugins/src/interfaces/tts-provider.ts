/**
 * Text-to-Speech (TTS) Provider Interface
 *
 * Defines the contract for TTS providers that convert text to audio.
 * Providers can be local (Piper, Kokoro) or remote (OpenAI, etc.)
 */

export interface TTSCapabilities {
  /** Supported output audio formats */
  formats: ("wav" | "mp3" | "pcm" | "ulaw")[];
  /** Supported sample rates */
  sampleRates: number[];
  /** Available voices */
  voices: TTSVoice[];
  /** Whether streaming is supported */
  supportsStreaming: boolean;
  /** Languages supported (ISO 639-1 codes) */
  languages: string[];
}

export interface TTSVoice {
  /** Unique voice identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Language (ISO 639-1) */
  language: string;
  /** Voice gender if available */
  gender?: "male" | "female" | "neutral";
  /** Optional voice characteristics */
  characteristics?: string[];
}

export interface TTSProviderMetadata {
  /** Unique provider identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Provider description */
  description: string;
  /** Semantic version */
  version: string;
  /** Provider-specific capabilities */
  capabilities: TTSCapabilities;
  /** Configuration schema validation */
  configSchema?: {
    validate: (config: unknown) => { ok: boolean; errors?: string[] };
    properties?: Record<string, { type: string; description?: string }>;
  };
}

export interface TTSSynthesisOptions {
  /** Voice to use (must be from capabilities.voices) */
  voiceId: string;
  /** Output audio format */
  format: "wav" | "mp3" | "pcm" | "ulaw";
  /** Sample rate for output */
  sampleRate: number;
  /** Speech rate (0.5 = 50%, 1.0 = 100%, 2.0 = 200%) */
  speechRate?: number;
  /** Audio pitch (-20 to +20 semitones) */
  pitch?: number;
  /** Audio volume normalization (-20 to +20 dB) */
  volumeDb?: number;
}

export interface TTSStreamEvent {
  type: "audio" | "error" | "complete";
  /** Audio chunk if type is "audio" */
  chunk?: Buffer;
  /** Error message if type is "error" */
  error?: {
    code: string;
    message: string;
  };
}

export interface TTSStreamCallback {
  onAudio?: (chunk: Buffer) => void;
  onComplete?: () => void;
  onError?: (error: { code: string; message: string }) => void;
}

export interface TTSProvider {
  /** Provider metadata and capabilities */
  readonly metadata: TTSProviderMetadata;

  /**
   * Initialize provider with configuration
   * @param config Provider-specific configuration
   */
  initialize(config?: Record<string, unknown>): Promise<void>;

  /**
   * List available voices
   */
  listVoices(): Promise<TTSVoice[]>;

  /**
   * Synthesize text to audio buffer
   * @param text Text to synthesize
   * @param options Synthesis options
   */
  synthesize(text: string, options: TTSSynthesisOptions): Promise<Buffer>;

  /**
   * Synthesize text to audio stream
   * @param text Text to synthesize
   * @param callbacks Event handlers
   * @param options Synthesis options
   */
  synthesizeStream(
    text: string,
    callbacks: TTSStreamCallback,
    options: TTSSynthesisOptions,
  ): Promise<void>;

  /**
   * Resample audio to target sample rate
   * @param audioBuffer Input audio buffer
   * @param fromSampleRate Current sample rate
   * @param toSampleRate Target sample rate
   * @param format Audio format (for PCM detection)
   */
  resample(
    audioBuffer: Buffer,
    fromSampleRate: number,
    toSampleRate: number,
    format?: string,
  ): Promise<Buffer>;

  /**
   * Clean up resources
   */
  shutdown?(): Promise<void>;
}
