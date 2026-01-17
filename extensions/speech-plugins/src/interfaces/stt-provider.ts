/**
 * Speech-to-Text (STT) Provider Interface
 *
 * Defines the contract for STT providers that convert audio to text.
 * Providers can be local (Whisper) or remote (OpenAI, etc.)
 */

export interface STTCapabilities {
  /** Supported audio formats (e.g., "wav", "mp3", "ogg") */
  formats: string[];
  /** Supported sample rates (e.g., 8000, 16000, 44100) */
  sampleRates: number[];
  /** Whether streaming is supported */
  supportsStreaming: boolean;
  /** Whether partial transcripts are returned during streaming */
  supportsPartialTranscripts: boolean;
  /** Languages supported (ISO 639-1 codes) */
  languages: string[];
  /** Maximum audio duration in seconds (null for unlimited) */
  maxDurationSeconds: number | null;
}

export interface STTProviderMetadata {
  /** Unique provider identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Provider description */
  description: string;
  /** Semantic version */
  version: string;
  /** Provider-specific capabilities */
  capabilities: STTCapabilities;
  /** Configuration schema validation */
  configSchema?: {
    validate: (config: unknown) => { ok: boolean; errors?: string[] };
    properties?: Record<string, { type: string; description?: string }>;
  };
}

export interface STTTranscriptSegment {
  /** Recognized text for this segment */
  text: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Start time in milliseconds */
  startMs: number;
  /** End time in milliseconds */
  endMs: number;
  /** Whether this is a final segment (vs. partial/interim) */
  isFinal: boolean;
  /** Optional language detected (ISO 639-1) */
  language?: string;
}

export interface STTStreamEvent {
  type: "transcript" | "error" | "complete";
  /** Transcript segments for this event */
  segments?: STTTranscriptSegment[];
  /** Error message if type is "error" */
  error?: {
    code: string;
    message: string;
  };
}

export interface STTStreamCallback {
  onTranscript?: (event: STTStreamEvent) => void;
  onPartial?: (partial: string) => void;
  onComplete?: (transcript: STTTranscriptSegment[]) => void;
  onError?: (error: { code: string; message: string }) => void;
}

export interface STTProvider {
  /** Provider metadata and capabilities */
  readonly metadata: STTProviderMetadata;

  /**
   * Initialize provider with configuration
   * @param config Provider-specific configuration object
   */
  initialize(config?: Record<string, unknown>): Promise<void>;

  /**
   * Transcribe audio from a buffer
   * @param audioBuffer Raw audio buffer
   * @param format Audio format (e.g., "wav", "mp3")
   * @param sampleRate Audio sample rate
   * @param options Transcription options
   */
  transcribe(
    audioBuffer: Buffer,
    options?: {
      format?: string;
      sampleRate?: number;
      language?: string;
      prompt?: string;
    },
  ): Promise<STTTranscriptSegment[]>;

  /**
   * Transcribe audio from a stream with callbacks
   * @param stream Audio stream
   * @param callbacks Event handlers
   * @param options Transcription options
   */
  transcribeStream(
    stream: NodeJS.ReadableStream,
    callbacks: STTStreamCallback,
    options?: {
      format?: string;
      sampleRate?: number;
      language?: string;
      prompt?: string;
    },
  ): Promise<void>;

  /**
   * Clean up resources
   */
  shutdown?(): Promise<void>;
}
