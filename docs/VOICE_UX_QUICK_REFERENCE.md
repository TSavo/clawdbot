# Voice Provider UX - Quick Reference Guide

**Use this for:** Quick lookups during implementation
**For details:** See `VOICE_UX_INTEGRATION_DESIGN.md`

---

## File Locations

### New Files to Create
```
src/config/
├── zod-schema.voice.ts           Zod schemas for voice config
├── types.voice.ts                 TypeScript types
└── voice-capabilities.ts          System detection

src/commands/
├── configure.voice.ts             Wizard integration
└── voice.ts                        Main voice commands (4 subcommands)

src/gateway/
└── routes/voice-config.ts          REST API endpoints (6 endpoints)

src/cli/
└── routes/voice.ts                 CLI command registration

apps/web/
├── components/voice-provider.tsx   Provider card component
├── components/voice-selector.tsx   Voice selection component
└── pages/settings/voice.tsx        Main voice settings page
```

### Files to Update
```
src/config/schema.ts              Add UI hints + labels
src/gateway/control-ui.ts         Register voice routes
apps/web/pages/settings/index.tsx Add voice settings link
```

---

## CLI Commands Quick Reference

### Command 1: Configure Voice
```bash
clawdbot voice configure [OPTIONS]

# No options (interactive)
clawdbot voice configure

# Quick local setup
clawdbot voice configure --local-only

# Set specific providers
clawdbot voice configure --stt whisper-local --tts kokoro --voice af_bella

# View without saving
clawdbot voice configure --dry-run --json

# Skip test
clawdbot voice configure --skip-test
```

**Handlers in `src/commands/voice.ts`:**
- `configureCommand()`
- `handleBasicSetup()`
- `handleAdvancedSetup()`

---

### Command 2: Show Status
```bash
clawdbot voice status [OPTIONS]

# Current config
clawdbot voice status

# With health check
clawdbot voice status --health

# Detailed diagnostics
clawdbot voice status --deep

# JSON output
clawdbot voice status --json
```

**Handler:** `statusCommand()`

---

### Command 3: Test Providers
```bash
clawdbot voice test [OPTIONS]

# Test current setup
clawdbot voice test

# Test all providers
clawdbot voice test --all-providers

# Custom text
clawdbot voice test --text "Hello world"

# Test STT with audio file
clawdbot voice test --file audio.wav --stt-only

# Longer timeout
clawdbot voice test --timeout 60000
```

**Handler:** `testCommand()`

---

### Command 4: List Providers
```bash
clawdbot voice providers [OPTIONS]

# All providers
clawdbot voice providers

# STT only
clawdbot voice providers --stt

# TTS only
clawdbot voice providers --tts

# Installed only
clawdbot voice providers --installed

# JSON format
clawdbot voice providers --json
```

**Handler:** `providersCommand()`

---

## Onboarding Integration

**File:** `src/commands/configure.voice.ts`

### Add to Wizard Sections
```typescript
export const CONFIGURE_WIZARD_SECTIONS = [
  "workspace",
  "model",
  "web",
  "gateway",
  "daemon",
  "channels",
  "skills",
+ "voice",      // NEW
  "health",
] as const;
```

### Wizard Flow Functions
```typescript
export async function promptVoiceProviderConfig(
  config: ClawdbotConfig,
  runtime: RuntimeEnv,
): Promise<ClawdbotConfig>

async function handleBasicSetup(
  config: ClawdbotConfig,
  runtime: RuntimeEnv,
): Promise<ClawdbotConfig>

async function handleAdvancedSetup(
  config: ClawdbotConfig,
  runtime: RuntimeEnv,
): Promise<ClawdbotConfig>

async function testVoiceSetup(
  config: ClawdbotConfig,
  runtime: RuntimeEnv,
): Promise<void>
```

---

## Configuration Schema

**File:** `src/config/zod-schema.voice.ts`

### Main Config Object
```typescript
VoiceConfigSchema = z.object({
  enabled: boolean
  stt: VoiceSTTConfigSchema
  tts: VoiceTTSConfigSchema
  fallbackEnabled: boolean
  audioFormat?: AudioFormatSchema
})

export type VoiceConfig = z.infer<typeof VoiceConfigSchema>
```

### STT Config
```typescript
VoiceSTTConfigSchema = z.object({
  enabled: boolean
  provider: STTProviderType  // enum
  whisperLocal?: WhisperLocalConfigSchema
  openaiRealtime?: OpenAIRealtimeConfigSchema
  fallbackProvider?: STTProviderType
  timeout: number  // default 30000
})

STTProviderType = z.enum([
  "whisper-local",
  "openai-realtime",
  "azure-speech",
  "google-cloud",
])
```

### TTS Config
```typescript
VoiceTTSConfigSchema = z.object({
  enabled: boolean
  provider: TTSProviderType  // enum
  kokoro?: KokoroConfigSchema
  piper?: PiperConfigSchema
  openaiTts?: OpenAITTSConfigSchema
  fallbackProvider?: TTSProviderType
  timeout: number  // default 10000
})

TTSProviderType = z.enum([
  "kokoro",
  "piper",
  "openai-tts",
  "azure-tts",
  "google-tts",
])
```

### Provider Configs
```typescript
WhisperLocalConfigSchema = z.object({
  modelSize: z.enum(["tiny", "small", "base", "medium", "large"])
  autoLanguageDetection: boolean
  device?: z.enum(["cpu", "cuda", "mps"])
  computeType?: z.enum(["default", "auto", "int8", "int8_float32"])
  beamSize: number  // 1-100
  bestOf: number    // 1-5
  temperature: number  // 0-1
})

KokoroConfigSchema = z.object({
  voice: z.enum([
    "af_bella", "af_sarah", "am_adam", "am_michael",
    "bf_emma", "bf_isabella", "bm_george", "bm_lewis"
  ])
  speed: number  // 0.5-2.0
  device?: z.enum(["cpu", "cuda", "mps"])
})

PiperConfigSchema = z.object({
  language: string
  voice: string
  speed: number  // 0.5-2.0
  outputFormat: z.enum(["pcm", "wav", "raw", "mulaw"])
  device?: z.enum(["cpu", "cuda"])
})

OpenAIRealtimeConfigSchema = z.object({
  apiKey: string
  model: z.literal("gpt-4-realtime")
  voiceActivityDetection: boolean
  vadThreshold: number  // 0-1
  maxTokens: number
})

OpenAITTSConfigSchema = z.object({
  apiKey: string
  model: z.enum(["tts-1", "tts-1-hd"])
  voice: z.enum([
    "alloy", "echo", "fable", "onyx", "shimmer", "nova"
  ])
  speed: number  // 0.25-4.0
})
```

---

## Gateway API Endpoints

**File:** `src/gateway/routes/voice-config.ts`

### Endpoints
```
GET    /api/voice/config          → Get current config
POST   /api/voice/config          → Update config
GET    /api/voice/status          → Get provider status
POST   /api/voice/test            → Test providers
GET    /api/voice/providers       → List available providers
GET    /api/voice/health          → Health metrics
```

### Request/Response Examples

```typescript
// GET /api/voice/config
Response: VoiceConfig

// POST /api/voice/config
Request: Partial<VoiceConfig>
Response: VoiceConfig

// GET /api/voice/status
Response: {
  stt: { status: "ready" | "error", latency?: number }
  tts: { status: "ready" | "error", latency?: number }
  lastTestedAt: Date
}

// POST /api/voice/test
Request: { text?: string, file?: Buffer }
Response: {
  stt?: { success: boolean, result: string, latency: number }
  tts?: { success: boolean, duration: number, latency: number }
}

// GET /api/voice/providers
Response: {
  stt: VoiceProvider[]
  tts: VoiceProvider[]
}

// GET /api/voice/health
Response: {
  sttHealth: "healthy" | "degraded" | "unhealthy"
  ttsHealth: "healthy" | "degraded" | "unhealthy"
  uptime: number
  errorRate: number
}
```

---

## Web Dashboard Components

**File:** `apps/web/components/voice-provider.tsx`

```typescript
interface VoiceProviderCardProps {
  type: "stt" | "tts"
  provider: VoiceProvider
  isActive: boolean
  isFallback: boolean
  status: "ready" | "error" | "unconfigured" | "loading"
  onConfigure: () => void
  onTest?: () => void
}

export function VoiceProviderCard(props): JSX.Element
```

**File:** `apps/web/components/voice-selector.tsx`

```typescript
interface VoiceSelectorProps {
  currentVoice: string
  availableVoices: string[]
  onVoiceChange: (voice: string) => void
  onPlaySample: (voice: string) => void
}

export function VoiceSelector(props): JSX.Element
```

**File:** `apps/web/pages/settings/voice.tsx`

```typescript
export default function VoiceSettingsPage(): JSX.Element

// Internal state
voiceConfig: VoiceConfig
loading: boolean
testResult: VoiceTestResult | null

// Handlers
handleVoiceTest()
handleProviderChange()
handleVoiceChange()
handleAdvancedChange()
handleSave()

// Sections rendered
- QuickStatus
- STTProvider
- TTSProvider
- VoiceSelector
- VoiceTest
- ProviderDetails
- AdvancedSettings
- TestResults
```

---

## System Capabilities Detection

**File:** `src/config/voice-capabilities.ts`

```typescript
type VoiceCapabilities = {
  hasGPU: boolean
  gpuType?: "nvidia" | "amd" | "metal" | "cpu"
  hasWhisper: boolean
  whisperModelsAvailable: ModelSize[]
  hasKokoro: boolean
  hasPiper: boolean
  openaiApiKeyPresent: boolean
  platform: "linux" | "darwin" | "win32"
  cpuCores: number
  ramGb: number
}

export async function detectSystemCapabilities(
  runtime: RuntimeEnv
): Promise<VoiceCapabilities>

export function recommendProviders(
  capabilities: VoiceCapabilities
): RecommendationResult

export function canRunWhisperModel(
  size: ModelSize,
  capabilities: VoiceCapabilities
): boolean
```

### Detection Logic
- GPU: Check CUDA_VISIBLE_DEVICES, nvidia-smi, rocm-smi, Metal
- Python: `python3 -c "import openai_whisper"`
- RAM: `os.freemem()`
- Platform: `process.platform`
- API Key: Check `process.env.OPENAI_API_KEY`
- Recommendation: Local > Cloud (if available)

---

## UI Hints & Labels

**Update `src/config/schema.ts`:**

```typescript
const FIELD_LABELS = {
  "voice.enabled": "Enable Voice Features",
  "voice.stt.provider": "Speech-to-Text Provider",
  "voice.stt.whisperLocal.modelSize": "Whisper Model Size",
  "voice.tts.provider": "Text-to-Speech Provider",
  "voice.tts.kokoro.voice": "Voice (Kokoro)",
  "voice.tts.kokoro.speed": "Speech Speed",
  "voice.fallbackEnabled": "Enable Provider Fallback",
  // ... more labels
}

const GROUP_LABELS = {
  voice: "Voice",
  // ... existing groups
}

const GROUP_ORDER = {
  voice: 65,  // Between audio (60) and models (70)
  // ... existing order
}

const CONFIGURE_SECTION_OPTIONS = [
  // ... existing options
  { value: "voice", label: "Voice", hint: "STT/TTS provider setup" },
]
```

---

## Validation Rules

**In Zod schemas:**

```typescript
// STT provider validation
.refine(
  (data) => {
    if (data.provider === "whisper-local") return true
    if (data.provider === "openai-realtime" && data.openaiRealtime?.apiKey) {
      return true
    }
    return false
  },
  { message: "Missing required config for STT provider" }
)

// TTS provider validation
.refine(
  (data) => {
    if (data.provider === "kokoro" || data.provider === "piper") {
      return true
    }
    if (data.provider === "openai-tts" && data.openaiTts?.apiKey) {
      return true
    }
    return false
  },
  { message: "Missing required config for TTS provider" }
)
```

---

## Integration Checklist

### Phase 1: Config (Day 1)
- [ ] Create `zod-schema.voice.ts`
- [ ] Create `types.voice.ts`
- [ ] Update `schema.ts` with hints
- [ ] Run tests: `pnpm test`

### Phase 2: CLI (Days 2-3)
- [ ] Create `configure.voice.ts`
- [ ] Create `voice.ts` with 4 commands
- [ ] Create `voice-capabilities.ts`
- [ ] Register CLI routes
- [ ] Run tests: `pnpm test`

### Phase 3: Gateway (Day 3)
- [ ] Create `voice-config.ts` endpoints
- [ ] Add to `control-ui.ts`
- [ ] Test with Postman/curl

### Phase 4: Web (Days 4-5)
- [ ] Create `voice-provider.tsx` component
- [ ] Create `voice-selector.tsx` component
- [ ] Create `settings/voice.tsx` page
- [ ] Add navigation link
- [ ] Run tests: `pnpm test`

### Phase 5: Integration (Day 6)
- [ ] E2E tests
- [ ] All components working together
- [ ] Full type safety check: `tsc --noEmit`

---

## Testing Strategy

### Unit Tests
- Zod schema validation
- Command parsing
- Component rendering
- API endpoint responses

### Integration Tests
- CLI command flow
- Config save/load cycle
- Gateway + CLI integration
- Web dashboard + API integration

### E2E Tests
- Full onboarding flow
- Configuration persistence
- Provider switching
- Voice testing

**Test Coverage Target:** 75%+ (follow existing standards)

---

## Common Pitfalls

❌ **Don't:**
- Create new dependencies (use existing libraries)
- Make voice setup required (keep optional)
- Hard-code provider paths (use registry)
- Forget backward compatibility (support old configs)
- Skip error handling (graceful degradation)

✅ **Do:**
- Use existing prompt utilities
- Validate all user input with Zod
- Follow existing code patterns
- Add comprehensive tests
- Write clear error messages
- Document breaking changes (none!)

---

## Development Workflow

1. **Start with config** - Schema design first
2. **CLI commands** - Test with mocks
3. **Gateway endpoints** - Validate API contracts
4. **Web components** - Build independently
5. **Integration** - Wire everything together
6. **Testing** - Comprehensive test suite
7. **Documentation** - Code + user docs

---

## Quick Copy-Paste Templates

### New File Template
```typescript
// File: src/commands/voice.ts
// Purpose: Voice provider management commands

import type { ClawdbotConfig } from "../config/config.js";
import { defaultRuntime } from "../runtime.js";
import type { RuntimeEnv } from "../runtime.js";

export async function voiceCommand(args: ParsedArgs): Promise<void> {
  // Implementation
}
```

### Zod Schema Template
```typescript
// File: src/config/zod-schema.voice.ts

import { z } from "zod";

const WhisperLocalConfigSchema = z
  .object({
    modelSize: z.enum(["tiny", "small", "base", "medium", "large"]),
    autoLanguageDetection: z.boolean().default(true),
  })
  .optional();

export const VoiceSTTConfigSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(["whisper-local", "openai-realtime"]),
  whisperLocal: WhisperLocalConfigSchema,
  timeout: z.number().int().positive().default(30000),
});

export type VoiceSTTConfig = z.infer<typeof VoiceSTTConfigSchema>;
```

### React Component Template
```typescript
// File: apps/web/components/voice-provider.tsx

import type { VoiceProvider } from "@/types/voice";

interface VoiceProviderCardProps {
  provider: VoiceProvider;
  isActive: boolean;
}

export function VoiceProviderCard({
  provider,
  isActive,
}: VoiceProviderCardProps) {
  return (
    <div className={isActive ? "active" : ""}>
      <h3>{provider.name}</h3>
      {/* Implementation */}
    </div>
  );
}
```

---

## Resources

- **Full Design:** `docs/VOICE_UX_INTEGRATION_DESIGN.md`
- **Checklist:** `docs/VOICE_UX_IMPLEMENTATION_CHECKLIST.md`
- **Examples:** `docs/VOICE_UX_CONFIG_EXAMPLES.md`
- **Summary:** `docs/VOICE_UX_INTEGRATION_SUMMARY.md`

---

*Last Updated: January 16, 2026*
*Use during: Implementation*
*Length:** ~1,500 lines of spec + code snippets
