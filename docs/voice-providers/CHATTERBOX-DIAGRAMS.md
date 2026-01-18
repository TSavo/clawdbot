# Chatterbox TTS Provider - System Diagrams

## 1. Provider Integration Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      Application Layer                           │
│         (CLI, API Routes, Gateway, Message Handlers)            │
└────────────────────────────┬─────────────────────────────────────┘
                             │ synthesize(text, options)
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                   VoiceOrchestrator                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ • Provider selection & priority-based routing               │ │
│  │ • Fallback chain management (TTSFallbackChain)             │ │
│  │ • Health monitoring (30s interval)                         │ │
│  │ • Circuit breaker pattern (3 failures → open)              │ │
│  │ • Metrics collection (latency, success rate)               │ │
│  │ • Load balancing across healthy providers                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Fallback Chain: [Chatterbox] → [Kokoro] → [ElevenLabs]        │
└──┬──────────────┬─────────────┬────────────┬──────────────┬────┘
   │              │             │            │              │
   │              │             │            │              │
┌──▼─────┐ ┌────▼─────┐ ┌─────▼──────┐ ┌──▼──────┐ ┌─────▼────┐
│Whisper │ │ Kokoro   │ │Chatterbox  │ │ElevenLabs│ │  Future  │
│(STT)   │ │(TTS)     │ │(TTS)       │ │(TTS)    │ │ Providers│
└────────┘ └──────────┘ └────────────┘ └────────┘ └──────────┘
```

## 2. ChatterboxExecutor Class Hierarchy

```
┌──────────────────────────────────────┐
│   VoiceProviderExecutor (interface)  │
│                                      │
│  + transcribe(audio): Promise        │
│  + transcribeStream(stream): AsyncIterable
│  + synthesize(text, options): Promise│
│  + synthesizeStream(stream): AsyncIterable
│  + initialize(): Promise             │
│  + shutdown(): Promise               │
│  + getCapabilities(): Capabilities   │
│  + isHealthy(): Promise<boolean>     │
└──────────────────────────────────────┘
             ▲
             │
┌────────────┴──────────────────────────┐
│  BaseVoiceProviderExecutor (abstract) │
│                                       │
│  + createSilence(duration): AudioBuffer
│  + normalizeAudioBuffer(): AudioBuffer
└────────────┬──────────────────────────┘
             ▲
             │
┌────────────┴────────────────────────────────────┐
│      ChatterboxExecutor                         │
│                                                │
│  Properties:                                   │
│  - id: 'chatterbox'                           │
│  - config: ChatterboxDeploymentConfig          │
│  - handler: DockerHandler|SystemHandler|...   │
│  - isInitialized: boolean                      │
│  - healthCheckInterval: NodeJS.Timeout         │
│  - eventEmitter: EventEmitter                  │
│                                                │
│  Methods:                                      │
│  + initialize(): Promise<void>                 │
│  + shutdown(): Promise<void>                   │
│  + synthesize(text, options): Promise          │
│  + synthesizeStream(stream): AsyncIterable     │
│  + getCapabilities(): ProviderCapabilities     │
│  + isHealthy(): Promise<boolean>               │
│  - validateSynthesisInputs(): void             │
│  - validateConfig(): void                      │
│  - createHandler(): Handler                    │
│  - startHealthChecks(): void                   │
└─────────────────────────────────────────────────┘
```

## 3. Deployment Handler Architecture

```
                    ChatterboxExecutor
                            │
                    ┌───────┴───────┐
                    │               │
                    ▼               ▼
        ┌─────────────────────┐   ┌─────────────────────┐
        │ Deployment Mode     │   │ Deployment Mode     │
        │ (from config)       │   │ (from config)       │
        └──────────────────────┘   └─────────────────────┘
           │         │         │
     'docker'   'system'   'cloud'
           │         │         │
           ▼         ▼         ▼
    ┌──────────┐ ┌──────────┐ ┌──────────────┐
    │ Docker   │ │ System   │ │ Cloud        │
    │ Handler  │ │ Handler  │ │ Handler      │
    │          │ │          │ │              │
    │ HTTP API │ │ Subprocess   API Gateway │
    │ to Port  │ │ (Python)     (Resemble   │
    │ 8000     │ │ Direct)      AI)         │
    └──────────┘ └──────────┘ └──────────────┘
         │            │            │
         │            │            │
    HTTP POST     python -c    HTTPS POST
    localhost:8000  script    api.resemble.ai
         │            │            │
         │            │            │
         ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────────┐
    │Docker    │ │ Chatterbox    │ Resemble  │
    │Container │ │ Python       │ AI API    │
    │(GPU      │ │ Process      │ Servers   │
    │ enabled) │ │ (GPU/CPU)    │ (Cloud)   │
    └──────────┘ └──────────┘ └──────────────┘

    ◄─────────────────────────────────────────►
              All handlers implement:
       initialize() | shutdown() | synthesize() | isHealthy()
```

## 4. Text-to-Speech Synthesis Pipeline

```
Input Text (UTF-8)
    │
    ├──► Text Normalization
    │    • Unicode normalization
    │    • Number expansion (123 → "one hundred twenty-three")
    │    • Abbreviation expansion (Dr. → "Doctor")
    │    • Punctuation handling
    │
    ├──► Language Detection/Validation
    │    • Auto-detect if not specified
    │    • Validate against 23 supported languages
    │    • Error: UNSUPPORTED_LANGUAGE
    │
    ├──► Voice Resolution
    │    • Predefined voice lookup
    │    • Voice cloning check (if enabled)
    │    • Voice metadata retrieval
    │    • Error: VOICE_NOT_FOUND
    │
    ├──► Reference Audio Processing (if voice cloning)
    │    • Duration validation (1-30 seconds)
    │    • Format validation (16-48kHz, mono/stereo)
    │    • Resampling to 16kHz
    │    • Speaker embedding extraction
    │    • Error: INVALID_REFERENCE_AUDIO
    │
    ├──► Model Selection
    │    • Choose variant (base/large/xlarge)
    │    • Load from cache or download
    │    • Verify GPU availability
    │    • Error: MODEL_LOAD_FAILED
    │
    ├──► Synthesis Parameters Preparation
    │    • Speed (0.5 - 2.0x)
    │    • Prosody (emotion, expressiveness)
    │    • Watermarking (PerTh enabled by default)
    │    • Sample rate (16kHz, 22.05kHz, 44.1kHz)
    │
    ├──► TTS Synthesis
    │    • Text → Phoneme sequence
    │    • Mel-spectrogram generation
    │    • Prosody embedding
    │    • Duration prediction
    │    • Vocoder (waveform generation)
    │    • Error: SYNTHESIS_TIMEOUT, SYNTHESIS_FAILED
    │
    ├──► Audio Post-Processing
    │    • Speed adjustment (if not 1.0x)
    │    • PerTh watermarking injection
    │    • Loudness normalization
    │    • Format conversion (PCM16 → MP3, WAV)
    │
    └──► AudioBuffer Output
         • data: Uint8Array (binary PCM or encoded)
         • format: AudioFormat (PCM_16, MP3, WAV)
         • sampleRate: number (16000, 22050, 44100)
         • duration: number (milliseconds)
         • channels: number (1 for mono)
```

## 5. Error Handling Flow

```
User Request
    │
    ▼
Validate Inputs
├─► Text validation (required, < 5000 chars)
│   └─ Error: TEXT_TOO_LONG
│
├─► Language validation (must be in 23 supported)
│   └─ Error: UNSUPPORTED_LANGUAGE
│
├─► Voice validation (must exist in predefined voices)
│   └─ Error: VOICE_NOT_FOUND
│
└─► Voice cloning validation (if enabled)
    ├─ Reference audio format check
    ├─ Duration check (1-30 seconds)
    └─ Error: INVALID_REFERENCE_AUDIO
         │
         ▼
    Call Deployment Handler
         │
         ├─── Docker Handler ──┐
         │                     ├──► Network Error
         │                     ├──► Timeout
         │                     └──► Invalid Response
         │
         ├─── System Handler ──┐
         │                     ├──► Python not installed
         │                     ├──► Model load failed
         │                     ├──► GPU unavailable
         │                     └──► Subprocess timeout
         │
         └─── Cloud Handler ───┐
                               ├──► API unreachable
                               ├──► Rate limited
                               ├──► Invalid API key
                               └──► Quota exceeded
         │
         ▼
    Categorize Error
    │
    ├─ Retryable Errors
    │  ├─ SYNTHESIS_TIMEOUT → Retry with backoff
    │  ├─ GPU_NOT_AVAILABLE → Retry or fallback
    │  ├─ DOCKER_UNREACHABLE → Retry or fallback
    │  └─ RATE_LIMITED → Retry with backoff
    │
    └─ Non-Retryable Errors
       ├─ UNSUPPORTED_LANGUAGE → Fail immediately
       ├─ VOICE_NOT_FOUND → Fail immediately
       ├─ INVALID_REFERENCE_AUDIO → Fail immediately
       └─ TEXT_TOO_LONG → Fail immediately
         │
         ▼
    Orchestrator Fallback Decision
    │
    ├─ If Retryable → Try next provider in chain
    ├─ If Non-Retryable → Return error
    └─ If all providers fail → Circuit breaker opens
```

## 6. Health Check and Circuit Breaker Pattern

```
Orchestrator Health Check Loop (every 30 seconds)
        │
        ├─► For each provider:
        │   │
        │   ├─► Call provider.isHealthy()
        │   │   │
        │   │   ├─ Success
        │   │   │  └─► consecutiveSuccesses++
        │   │   │      consecutiveFailures = 0
        │   │   │      healthy = true
        │   │   │
        │   │   └─ Failure
        │   │      └─► consecutiveFailures++
        │   │          consecutiveSuccesses = 0
        │   │          if (consecutiveFailures >= 2)
        │   │             healthy = false
        │   │
        │   └─► Check Circuit Breaker
        │       │
        │       ├─ Circuit CLOSED (normal operation)
        │       │  └─ failureCount = 0
        │       │
        │       ├─ failureCount++ on each failed request
        │       │  └─ if (failureCount >= 3)
        │       │     └─► Circuit OPENS
        │       │
        │       ├─ Circuit OPEN (provider blocked)
        │       │  └─ All requests rejected
        │       │     Wait for timeout (60 seconds default)
        │       │
        │       └─ Circuit HALF-OPEN (after timeout)
        │          └─ Next request is test
        │             ├─ Success → CLOSES circuit
        │             └─ Failure → RE-OPENS circuit
        │
        └─► Update metrics
            • Health status
            • Circuit breaker state
            • Response times
            • Error rates
```

## 7. Voice Cloning Workflow

```
User Request with Voice Cloning
        │
        ├──► Load Reference Audio File
        │    │
        │    ├─ Format: WAV, MP3, OGG
        │    ├─ Sample rate: 16-48kHz
        │    ├─ Duration: 1-30 seconds
        │    └─ Loudness: -20dBFS to 0dBFS
        │
        ├──► Preprocess Reference Audio
        │    │
        │    ├─ Resample to 16kHz
        │    ├─ Normalize loudness
        │    ├─ Remove silence edges
        │    └─ Verify mono/stereo
        │
        ├──► Extract Speaker Embedding
        │    │
        │    ├─ Feed through speaker encoder
        │    ├─ Generate 256-dim embedding vector
        │    └─ Compare with existing voices (for safety)
        │
        ├──► Generate Voice Clone
        │    │
        │    ├─ Synthesize text with extracted embedding
        │    ├─ Apply similarity scaling (0-1.0)
        │    ├─ Cache clone for session (optional)
        │    └─ Verify watermarking integrity
        │
        ├──► Quality Assurance
        │    │
        │    ├─ Check against copyrighted voices (safety)
        │    ├─ Measure speaker similarity
        │    ├─ Verify watermark presence
        │    └─ Validate mel-spectrogram
        │
        └──► Return Synthesized Audio
             • data: Uint8Array (audio waveform)
             • metadata: duration, sample_rate, confidence
```

## 8. Deployment Mode Comparison

```
                    Docker              System              Cloud
                    ───────              ──────              ─────

Infrastructure:     Container           Local Python        API Server
                    (isolated)           (direct)            (remote)

Latency:            100-500ms            50-200ms (GPU)      800ms-2s
                    (network)            1-4s (CPU)          (network)

Memory:             4-8GB RAM            4-32GB RAM          N/A
                    + VRAM if GPU        (depends on CPU)    (remote)

Setup:              Docker install       pip install         API key
                    + pull image         + models             + endpoint

Scaling:            docker-compose       Limited to host     Automatic
                    or K8s               resources           (API tier)

Cost:               $0 (self-hosted)     $0 (self-hosted)    $$ (pay-per-use)
                    + infrastructure     + power/cooling     or subscription

Reliability:        High (isolated)      Depends on host     Depends on SLA
                    Container restarts   Process crashes     API availability

GPU Support:        nvidia-docker        Direct CUDA/Metal   Provider's GPU

Best For:           Production           Development         Premium/Backup
                    & scaling            & testing           & load burst
```

## 9. Configuration Loading Sequence

```
Application Start
    │
    ├──► Load Environment Variables
    │    • CHATTERBOX_MODE (docker|system|cloud)
    │    • CHATTERBOX_DOCKER_IMAGE
    │    • CHATTERBOX_DOCKER_PORT
    │    • CHATTERBOX_PYTHON_PATH
    │    • CHATTERBOX_API_ENDPOINT
    │    • CHATTERBOX_API_KEY
    │
    ├──► Load Config File (voice-providers.config.ts)
    │    • Provider registry entries
    │    • Fallback chains
    │    • Health check settings
    │    • Circuit breaker settings
    │
    ├──► Validate Configuration
    │    • Schema validation (Zod)
    │    • Required fields check
    │    • Type checking
    │
    ├──► Instantiate Orchestrator
    │    new VoiceOrchestrator({
    │      config: voiceProvidersConfig,
    │      defaultMode: 'docker',
    │    })
    │
    ├──► For each provider entry in config:
    │    │
    │    ├─► Create deployment handler
    │    │   • DockerHandler (if mode === 'docker')
    │    │   • SystemHandler (if mode === 'system')
    │    │   • CloudHandler (if mode === 'cloud')
    │    │
    │    └─► Call handler.initialize()
    │        • Validate connectivity
    │        • Load models if needed
    │        • Detect GPU if applicable
    │
    └──► Start Health Checks
         • 30-second interval
         • Check each provider
         • Update metrics
         • Unref timer (don't keep process alive)
```

## 10. Integration with Message Gateway

```
User sends message on WhatsApp/Telegram/Discord/etc.
        │
        ├──► Process message text
        │    • Extract audio request flag
        │    • Get voice preference
        │    • Set synthesis options
        │
        ├──► Generate response text
        │    • AI response generation
        │    • Voice selection (default or user preference)
        │    • Audio format selection
        │
        ├──► Call orchestrator.synthesize()
        │    await orchestrator.synthesize(
        │      "Hello! How can I help?",
        │      {
        │        voice: 'en_US_female_1',
        │        language: 'en',
        │        speed: 1.0,
        │        format: AudioFormat.MP3,
        │      }
        │    )
        │
        ├──► Orchestrator selects provider
        │    • Check ChatterboxExecutor health → HEALTHY
        │    • Call synthesize() on ChatterboxExecutor
        │    • Get AudioBuffer back
        │
        ├──► Encode audio for delivery
        │    • Convert to appropriate format (MP3, WAV, etc.)
        │    • Add metadata (duration, sample rate)
        │    • Create attachment/file reference
        │
        └──► Send to user
             • Audio file or stream
             • Attached to message
             • Via message gateway
```

---

**Document Generated:** January 16, 2026
**Status:** Supporting Architecture Diagrams
**Format:** ASCII diagrams for version control friendliness
