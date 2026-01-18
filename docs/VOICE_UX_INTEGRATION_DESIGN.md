# Voice Provider UX Integration Design

**Status:** Architecture & Design Complete
**Date:** January 16, 2026
**Purpose:** Define user experience integration for pluggable STT/TTS provider system

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Integration Architecture](#integration-architecture)
3. [Onboarding Flow](#onboarding-flow)
4. [Dashboard UI Design](#dashboard-ui-design)
5. [CLI Command Specifications](#cli-command-specifications)
6. [Settings Schema Design](#settings-schema-design)
7. [User Journeys](#user-journeys)
8. [Breaking vs Non-Breaking Changes](#breaking-vs-non-breaking-changes)
9. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

The pluggable STT/TTS provider system requires seamless integration across three primary user surfaces:

1. **Onboarding Wizard** - First-time voice setup during `clawdbot init`
2. **Web Dashboard** - Provider management, testing, and configuration
3. **CLI Commands** - Voice provider control and diagnostics

### Key Design Principles

- **Progressive Disclosure** - Basic vs advanced settings split
- **Smart Defaults** - Auto-detect system capabilities, recommend providers
- **Zero Friction** - Optional setup (skip if not needed)
- **Clear Feedback** - Show provider status, health, fallback chain
- **Local-First** - Prefer local providers when available, fall back to cloud
- **Backwards Compatible** - Existing configs keep working unchanged

---

## Integration Architecture

### Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Interaction Layer                       │
├─────────────┬────────────────┬──────────────────┬─────────────────┤
│ Onboarding  │  CLI Commands  │  Web Dashboard   │  macOS/iOS Apps │
│   Wizard    │  (clawdbot)    │  (/gateway/ui)   │  (Native)       │
└─────┬───────┴────────┬───────┴──────────┬───────┴────────┬────────┘
      │                │                  │                │
      └────────────────┴──────────────────┴────────────────┘
                      │
      ┌───────────────▼────────────────┐
      │   Configuration Management     │
      ├────────────────────────────────┤
      │ • Voice Provider Config (Zod)  │
      │ • Settings Schema              │
      │ • Validation Rules             │
      │ • Defaults (src/config)        │
      └────────────┬────────────────────┘
                   │
      ┌────────────▼─────────────────────────────────┐
      │     Provider Registry & Runtime              │
      ├──────────────────────────────────────────────┤
      │ • STT/TTS Registry                           │
      │ • Provider Initialization                    │
      │ • Fallback Chain Management                  │
      │ • Health Monitoring                          │
      │ (extensions/voice-call/src/plugins)          │
      └────────────┬──────────────────────────────────┘
                   │
      ┌────────────▼───────────────────────────────────┐
      │         Available Providers                    │
      ├─────────────────────────────────────────────────┤
      │ Cloud:     │ Local:           │ Mock (tests):   │
      │ • OpenAI   │ • Whisper-local  │ • TestSTT       │
      │ • Azure    │ • Piper TTS      │ • TestTTS       │
      │ (future)   │ • Kokoro TTS     │ • TestRegistry  │
      │            │ • Espeak         │                 │
      │            │ (future)         │                 │
      └─────────────────────────────────────────────────┘
```

### Configuration Flow

```
Init/Update Wizard
    ↓
"Configure Voice?" → Skip / Quick Setup / Advanced
    ↓
  [Quick]           [Advanced]
System Check        Provider Selection
    ↓                    ↓
Recommend          Select STT
Provider               ↓
    ↓               Select TTS
Apply Config           ↓
    ↓               Fallback Chain
Save → Zod             ↓
Validation          Test Settings
    ↓                    ↓
Registry Init       Save → Zod
    ↓               Validation
Ready                    ↓
                    Registry Init
                         ↓
                       Ready
```

### File Organization

```
src/commands/
├── configure.voice.ts              NEW - Voice provider wizard
├── voice.ts                         NEW - Voice CLI commands
└── (existing configure files)

src/config/
├── zod-schema.voice.ts              NEW - Voice provider schema
├── types.voice.ts                   NEW - Voice provider types
├── schema.ts                        UPDATED - Add voice hints
└── (existing schema files)

src/gateway/
├── control-ui.ts                    UPDATED - Add voice endpoints
├── routes/
│   └── voice-config.ts              NEW - Voice API endpoints
└── (existing gateway files)

apps/web/
├── pages/settings/voice.tsx         NEW - Voice dashboard
├── components/voice-provider.tsx    NEW - Provider card
└── (existing web files)

extensions/voice-call/
├── src/plugins/
│   ├── interfaces.ts                (already complete)
│   ├── registry.ts                  (already complete)
│   └── README.md                    (already complete)
└── (provider implementations)
```

---

## Onboarding Flow

### Flow Diagram: High-Level

```
Start: clawdbot configure

↓

Show existing config summary
"Voice provider configured? No (use defaults)"

↓

Ask: "Configure voice providers now?"
  Option A: Skip (use defaults, can configure later)
  Option B: Basic setup (quick recommendations)
  Option C: Advanced setup (full control)

┌─────────────────────────────────────────────────────────┐
│ Option A: Skip                                          │
├─────────────────────────────────────────────────────────┤
│ • Save defaults to config                               │
│ • STT: auto-detect (local > cloud)                       │
│ • TTS: auto-detect (local > cloud)                       │
│ • Fallback: enabled                                      │
│ • Message: "You can configure later with               │
│           'clawdbot voice config'"                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Option B: Basic Setup                                   │
├─────────────────────────────────────────────────────────┤
│ Step 1: System Check                                    │
│   • Detect GPU (NVIDIA/AMD/Metal)                       │
│   • Check Whisper model available                       │
│   • Check local TTS engines                             │
│   • Check cloud credentials (OPENAI_API_KEY)            │
│   Result: "Local providers available ✓"                │
│                                                         │
│ Step 2: Recommendation                                  │
│   • "I recommend: Whisper-local STT + Kokoro TTS"       │
│   • "Reason: Fast, offline, no API costs"               │
│   • Accept recommendation? (Y/n)                        │
│   YES → Skip to Step 4                                  │
│   NO → Proceed to Option C                              │
│                                                         │
│ Step 3: Voice Selection                                 │
│   • For TTS: Pick voice (sample playback)               │
│   • Show 3-5 recommended voices                         │
│   • Play 2-sec sample for each                          │
│   • User picks voice                                    │
│                                                         │
│ Step 4: Configuration Applied                          │
│   • Save config                                         │
│   • Test synthesis (short phrase)                       │
│   • Message: "Voice configured! Try: clawdbot voice    │
│             test"                                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Option C: Advanced Setup                                │
├─────────────────────────────────────────────────────────┤
│ Step 1: System Check (same as Basic)                    │
│                                                         │
│ Step 2: STT Provider Selection                          │
│   Which STT provider?                                   │
│   ✓ Whisper-local (Fast, offline, English support)     │
│     OpenAI Realtime (Cloud, best accuracy, costs $)    │
│     (Azure, Google Cloud - future)                      │
│                                                         │
│ Step 3: STT Configuration                              │
│   IF Whisper-local:                                    │
│     Model size?                                         │
│     • tiny (39M, fastest)                               │
│     • small (140M)                                      │
│     • base (140M)                                       │
│     • medium (769M, default)                            │
│     • large (1.5GB, most accurate)                      │
│     Auto-language detection? Yes/No                     │
│                                                         │
│   IF OpenAI Realtime:                                   │
│     API Key: [hidden input]                             │
│     Model: gpt-4-realtime (default)                     │
│                                                         │
│ Step 4: TTS Provider Selection                          │
│   Which TTS provider?                                   │
│   ✓ Kokoro (8 voices, fast, high quality, offline)     │
│     Piper (60+ languages, 100+ voices, offline)        │
│     OpenAI TTS (highest quality, cloud, costs $)       │
│                                                         │
│ Step 5: TTS Voice Selection                            │
│   IF Kokoro: Pick voice                                │
│     • af_bella (female, American)                       │
│     • af_sarah (female, American)                       │
│     • am_adam (male, American)                          │
│     • am_michael (male, American)                       │
│     • bf_emma (female, British)                         │
│     • bf_isabella (female, British)                     │
│     • bm_george (male, British)                         │
│     • bm_lewis (male, British)                          │
│     [Play sample]                                       │
│                                                         │
│   IF Piper: Pick language, then voice                   │
│     Language: English (default)                         │
│     Voice (English): p301, p308, etc.                   │
│                                                         │
│   IF OpenAI:                                            │
│     Voice: alloy, echo, fable, onyx, shimmer, nova    │
│     [Play 2-sec sample]                                │
│                                                         │
│ Step 6: Advanced Options                               │
│   Fallback chain enabled? Yes (recommended)             │
│   If STT fails, try: [NextProvider]                     │
│   If TTS fails, try: [NextProvider]                     │
│   Speed adjustment: 1.0x (0.5 - 2.0)                   │
│                                                         │
│ Step 7: Test & Save                                    │
│   Test phrase: "Hello! This is a voice test."          │
│   [Play output]                                         │
│   OK? Save / Edit                                       │
└─────────────────────────────────────────────────────────┘
```

### Onboarding Integration Points

**In `src/commands/configure.wizard.ts`:**

```typescript
// 1. Add to CONFIGURE_WIZARD_SECTIONS
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

// 2. Add handler in runConfigureWizard
async function runConfigureWizard(
  nextConfig: ClawdbotConfig,
  runtime: RuntimeEnv,
): Promise<ClawdbotConfig> {
  // ... existing code ...

  if (section === "voice") {
    nextConfig = await promptVoiceProviderConfig(nextConfig, runtime);
  }

  // ... rest of function ...
}
```

**In `src/commands/configure.voice.ts` (NEW):**

```typescript
export async function promptVoiceProviderConfig(
  config: ClawdbotConfig,
  runtime: RuntimeEnv,
): Promise<ClawdbotConfig> {
  const proceed = await confirm({
    message: "Configure voice providers?",
    initialValue: false,
  });

  if (!proceed) return config;

  const mode = await select({
    message: "Setup mode",
    options: [
      { value: "skip", label: "Skip (use defaults)" },
      { value: "basic", label: "Basic setup (recommended)" },
      { value: "advanced", label: "Advanced (full control)" },
    ],
  });

  if (mode === "skip") return config;
  if (mode === "basic") return await handleBasicSetup(config, runtime);
  return await handleAdvancedSetup(config, runtime);
}

async function handleBasicSetup(
  config: ClawdbotConfig,
  runtime: RuntimeEnv,
): Promise<ClawdbotConfig> {
  // System detection, recommendations, voice selection
  const capabilities = await detectSystemCapabilities(runtime);
  const recommendation = recommendProviders(capabilities);

  const accepted = await confirm({
    message: `Recommended: ${recommendation.sttName} + ${recommendation.ttsName}`,
    initialValue: true,
  });

  if (accepted) {
    config.voice = {
      ...config.voice,
      stt: { provider: recommendation.sttId, ...recommendation.sttConfig },
      tts: { provider: recommendation.ttsId, ...recommendation.ttsConfig },
    };
  } else {
    return await handleAdvancedSetup(config, runtime);
  }

  await testVoiceSetup(config, runtime);
  return config;
}

async function handleAdvancedSetup(
  config: ClawdbotConfig,
  runtime: RuntimeEnv,
): Promise<ClawdbotConfig> {
  // Full provider selection flow with all options
  // See detailed flow above
}
```

### System Detection & Capabilities

```typescript
// In src/config/voice-capabilities.ts (NEW)

export type VoiceCapabilities = {
  hasGPU: boolean;
  gpuType?: "nvidia" | "amd" | "metal" | "cpu";
  hasWhisper: boolean;
  whisperModelsAvailable: ("tiny" | "small" | "base" | "medium" | "large")[];
  hasKokoro: boolean;
  hasPiper: boolean;
  openaiApiKeyPresent: boolean;
  platform: "linux" | "darwin" | "win32";
  cpuCores: number;
  ramGb: number;
};

export async function detectSystemCapabilities(
  runtime: RuntimeEnv,
): Promise<VoiceCapabilities> {
  // Check GPU availability
  // Check installed Python packages
  // Check environment variables
  // Estimate available resources
}

export function recommendProviders(
  capabilities: VoiceCapabilities,
): RecommendationResult {
  // Based on capabilities, recommend optimal provider combo
  // Preference: Local > Cloud (cost, latency, privacy)
  // Constraint: Whisper-large needs 6GB+ RAM
  // Fallback: Use OpenAI if no local options
}
```

---

## Dashboard UI Design

### Voice Settings Page Layout

**URL:** `/settings/voice` (or `/dashboard/voice-providers`)

```
┌─────────────────────────────────────────────────────────────┐
│ Clawdbot Voice Settings                                      │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ QUICK STATUS                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                               │
│ STT Provider:      Whisper-local          Status: ✓ Ready     │
│ TTS Provider:      Kokoro (af_bella)      Status: ✓ Ready     │
│ Fallback Enabled:  Yes                                        │
│                                                               │
│ [Test Voice] [View Advanced] [Download Models] [Reset]       │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ SPEECH-TO-TEXT (STT)                                          │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                               │
│ [Active: Whisper-local ✓]                                     │
│                                                               │
│ Configuration:                                                │
│   Model Size: ◄ medium ► [140MB] (large = 1.5GB, slower)    │
│   Auto Language Detection: ◉ On ○ Off                         │
│                                                               │
│ System Requirements:                                          │
│   ✓ Python 3.9+ installed                                     │
│   ✓ 2GB RAM available                                         │
│   ✓ GPU: Intel UHD Graphics (ONNX Runtime)                    │
│                                                               │
│ Fallback Provider: ◄ OpenAI Realtime ►                       │
│   Will auto-switch if local model fails                      │
│   [Configure Fallback]                                       │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ [Change Provider]  [Advanced Settings]  [Model Manager]│  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ TEXT-TO-SPEECH (TTS)                                          │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                               │
│ [Active: Kokoro ✓]                                            │
│                                                               │
│ Voice Selection:                                              │
│   Current: af_bella (Female, American)                       │
│                                                               │
│   Available Voices:                                           │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ 🔊 af_bella (Female, American)  [Play Sample] ◉     │    │
│   │ 🔊 af_sarah (Female, American)  [Play Sample]       │    │
│   │ 🔊 am_adam  (Male, American)    [Play Sample]       │    │
│   │ 🔊 am_michael (Male, American)  [Play Sample]       │    │
│   │ 🔊 bf_emma  (Female, British)   [Play Sample]       │    │
│   │ 🔊 bf_isabella (Female, British) [Play Sample]      │    │
│   │ 🔊 bm_george (Male, British)    [Play Sample]       │    │
│   │ 🔊 bm_lewis  (Male, British)    [Play Sample]       │    │
│   └─────────────────────────────────────────────────────┘    │
│                                                               │
│ Speed Adjustment: ◄ 1.0x ► [0.5x - 2.0x]                    │
│                                                               │
│ Fallback Provider: ◄ Piper ►                                │
│   Will auto-switch if Kokoro fails                          │
│   [Configure Fallback]                                      │
│                                                               │
│ System Requirements:                                          │
│   ✓ 500MB RAM available                                       │
│   ✓ Kokoro model cached (1.2GB)                              │
│   ✓ Audio output device: Speakers                            │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ [Change Provider]  [Advanced Settings]  [Model Manager]│  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ VOICE TESTING                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                               │
│ Test Phrase: [Hello! This is a voice test.]                  │
│ [Record from Mic]  [Test STT]                                │
│ [Synthesize]       [Test TTS]                                │
│ [Full Roundtrip]   (STT → TTS)                               │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ PROVIDER DETAILS                                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                               │
│ Available Providers:                                          │
│                                                               │
│ ┌─ STT Providers ─────────────────────────────────────────┐  │
│ │                                                         │  │
│ │ ✓ Whisper-local (ACTIVE)                              │  │
│ │   Type: Offline, Open-source                          │  │
│ │   Model: medium (140MB)                               │  │
│ │   Languages: 99                                        │  │
│ │   Cost: Free                                           │  │
│ │   Status: Ready                                        │  │
│ │   [Settings] [Docs]                                    │  │
│ │                                                         │  │
│ │ ◆ OpenAI Realtime (FALLBACK)                          │  │
│ │   Type: Cloud API                                      │  │
│ │   Accuracy: Very High                                 │  │
│ │   Latency: ~100ms                                      │  │
│ │   Cost: $0.02/min audio (varies)                       │  │
│ │   Status: API Key not configured                      │  │
│ │   [Configure] [Docs]                                   │  │
│ │                                                         │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ┌─ TTS Providers ─────────────────────────────────────────┐  │
│ │                                                         │  │
│ │ ✓ Kokoro (ACTIVE)                                      │  │
│ │   Type: Offline, High-quality                         │  │
│ │   Voices: 8 (4 American, 4 British)                   │  │
│ │   Speed: Real-time (10x faster than playback)         │  │
│ │   Cost: Free                                           │  │
│ │   Status: Ready                                        │  │
│ │   [Settings] [Docs]                                    │  │
│ │                                                         │  │
│ │ ◆ Piper (AVAILABLE)                                    │  │
│ │   Type: Offline, Multi-language                       │  │
│ │   Voices: 100+ across 20+ languages                   │  │
│ │   Cost: Free                                           │  │
│ │   Status: Not installed                               │  │
│ │   [Install] [Docs]                                     │  │
│ │                                                         │  │
│ │ ◇ OpenAI TTS (AVAILABLE)                               │  │
│ │   Type: Cloud API                                      │  │
│ │   Voices: 6 (alloy, echo, fable, onyx, shimmer, nova)│  │
│ │   Quality: Highest                                    │  │
│ │   Cost: $0.015/1k chars                                │  │
│ │   Status: Not configured                              │  │
│ │   [Configure] [Docs]                                   │  │
│ │                                                         │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ ADVANCED OPTIONS                                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                               │
│ ⊕ Fallback Behavior                                           │
│   ○ Enabled (retry next provider on error)                    │
│   ○ Disabled (fail immediately)                              │
│                                                               │
│ ⊕ Timeout Settings                                            │
│   STT timeout: 30000 ms                                       │
│   TTS timeout: 10000 ms                                       │
│                                                               │
│ ⊕ Audio Format                                                │
│   Sample rate: 16000 Hz                                       │
│   Channels: Mono                                              │
│   Bit depth: 16-bit PCM                                       │
│                                                               │
│ [Save Advanced Settings] [Reset to Defaults]                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Component Implementation Sketch

**`apps/web/components/voice-provider.tsx`:**

```typescript
interface VoiceProviderCardProps {
  type: "stt" | "tts";
  provider: VoiceProvider;
  isActive: boolean;
  isFallback: boolean;
  status: "ready" | "error" | "unconfigured" | "loading";
  onConfigure: () => void;
  onTest: () => void;
}

export function VoiceProviderCard({
  type,
  provider,
  isActive,
  isFallback,
  status,
  onConfigure,
  onTest,
}: VoiceProviderCardProps) {
  const badge = isActive ? "ACTIVE" : isFallback ? "FALLBACK" : "AVAILABLE";
  const statusIcon = status === "ready" ? "✓" : "⚠";

  return (
    <div className={cn("provider-card", { active: isActive })}>
      <div className="provider-header">
        <h3>{provider.name}</h3>
        <badge className={`badge-${isActive ? "active" : "secondary"}`}>
          {badge} {status === "ready" && statusIcon}
        </badge>
      </div>

      <div className="provider-details">
        <dl>
          <dt>Type:</dt>
          <dd>{provider.type === "local" ? "Offline" : "Cloud API"}</dd>

          {type === "tts" && provider.voices && (
            <>
              <dt>Voices:</dt>
              <dd>{provider.voices.length}</dd>
            </>
          )}

          {provider.cost && (
            <>
              <dt>Cost:</dt>
              <dd>{provider.cost}</dd>
            </>
          )}

          {provider.accuracy && (
            <>
              <dt>Accuracy:</dt>
              <dd>{provider.accuracy}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="provider-status">
        <StatusIndicator status={status} />
        {status === "error" && (
          <p className="error-message">{provider.errorMessage}</p>
        )}
      </div>

      <div className="provider-actions">
        {isActive && type === "tts" && (
          <button onClick={onTest}>Test Voice</button>
        )}
        {!isActive && <button onClick={onConfigure}>Configure</button>}
        {isActive && <button onClick={onConfigure}>Settings</button>}
      </div>
    </div>
  );
}
```

**`apps/web/pages/settings/voice.tsx`:**

```typescript
export default function VoiceSettingsPage() {
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    fetchVoiceConfig();
  }, []);

  async function fetchVoiceConfig() {
    const response = await fetch("/api/voice/config");
    const config = await response.json();
    setVoiceConfig(config);
    setLoading(false);
  }

  async function handleVoiceTest() {
    const response = await fetch("/api/voice/test", {
      method: "POST",
      body: JSON.stringify({ text: "Hello! This is a voice test." }),
    });
    const result = await response.json();
    setTestResult(result);
  }

  if (loading) return <Loading />;

  return (
    <div className="voice-settings">
      <h1>Voice Settings</h1>

      <section className="quick-status">
        <h2>Quick Status</h2>
        <QuickStatusDisplay config={voiceConfig} />
        <ActionBar onTest={handleVoiceTest} />
      </section>

      <section className="stt-section">
        <h2>Speech-to-Text (STT)</h2>
        <VoiceProviderCard
          type="stt"
          provider={voiceConfig.stt.provider}
          isActive={true}
          status={voiceConfig.stt.status}
          onConfigure={() => openConfigModal("stt")}
          onTest={() => testSTT()}
        />
      </section>

      <section className="tts-section">
        <h2>Text-to-Speech (TTS)</h2>
        <VoiceProviderCard
          type="tts"
          provider={voiceConfig.tts.provider}
          isActive={true}
          status={voiceConfig.tts.status}
          onConfigure={() => openConfigModal("tts")}
          onTest={() => testTTS()}
        />
        <VoiceSelector
          currentVoice={voiceConfig.tts.voice}
          availableVoices={voiceConfig.tts.provider.voices}
          onVoiceChange={handleVoiceChange}
          onPlaySample={(voice) => playSample(voice)}
        />
      </section>

      <section className="provider-details">
        <h2>Provider Details</h2>
        <ProviderGrid providers={voiceConfig.availableProviders} />
      </section>

      <section className="advanced">
        <details>
          <summary>Advanced Options</summary>
          <AdvancedSettings
            config={voiceConfig}
            onChange={handleAdvancedChange}
          />
        </details>
      </section>

      {testResult && <TestResultPanel result={testResult} />}
    </div>
  );
}
```

---

## CLI Command Specifications

### Command: `clawdbot voice configure`

**Purpose:** Interactive configuration wizard for voice providers

**Usage:**
```bash
clawdbot voice configure [OPTIONS]

Options:
  --local-only                 Only show local providers
  --cloud-only                 Only show cloud providers
  --stt <provider>             Set STT provider directly
  --tts <provider>             Set TTS provider directly
  --voice <voice>              Set TTS voice directly
  --model-size <size>          Set model size (for Whisper)
  --skip-test                  Skip voice test after config
  --json                       Output JSON config
  --dry-run                    Show config without saving
```

**Examples:**
```bash
# Interactive wizard
clawdbot voice configure

# Quick local setup
clawdbot voice configure --local-only

# Set specific providers
clawdbot voice configure \
  --stt whisper-local \
  --tts kokoro \
  --voice af_bella

# Test current config
clawdbot voice configure --skip-test --json
```

**Output Example:**
```
Welcome to Clawdbot Voice Configuration

Detecting system capabilities...
  GPU: Intel UHD Graphics
  Memory: 16GB available
  Platform: Linux

Recommended Setup
  STT: Whisper-local (fast, offline, English support)
  TTS: Kokoro (8 voices, high quality, offline)

Accept recommendation? [Y/n] Y

Configuring STT: Whisper-local
  Model size? [1. tiny 2. small 3. base 4. medium 5. large]
  Select [4] ▸

Configuring TTS: Kokoro
  Voice selection:
  1. af_bella (Female, American) [Play]
  2. af_sarah (Female, American) [Play]
  3. am_adam (Male, American) [Play]
  4. am_michael (Male, American) [Play]
  5. bf_emma (Female, British) [Play]
  6. bf_isabella (Female, British) [Play]
  7. bm_george (Male, British) [Play]
  8. bm_lewis (Male, British) [Play]
  Select [1] ▸

Testing voice configuration...
  STT: ✓ Ready
  TTS: ✓ Ready
  Roundtrip: ✓ 2.3s

Configuration saved to ~/.clawdbot/clawdbot.json

Try: clawdbot voice test
```

### Command: `clawdbot voice status`

**Purpose:** Show current voice provider configuration

**Usage:**
```bash
clawdbot voice status [OPTIONS]

Options:
  --health              Check provider health
  --deep                Include detailed diagnostics
  --json                JSON output
```

**Output Example:**
```
Clawdbot Voice Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SPEECH-TO-TEXT (STT)
  Active Provider:    Whisper-local
  Status:             ✓ Ready
  Model:              medium (140MB)
  Languages:          99
  Auto-detection:     Enabled
  Fallback Provider:  OpenAI Realtime
  Health:             ✓ OK (1 test in 245ms)

TEXT-TO-SPEECH (TTS)
  Active Provider:    Kokoro
  Status:             ✓ Ready
  Voice:              af_bella (Female, American)
  Available Voices:   8
  Speed:              1.0x
  Fallback Provider:  Piper
  Health:             ✓ OK (3 tests in 456ms)

SYSTEM REQUIREMENTS
  ✓ Python 3.9+       (3.11.2)
  ✓ Memory Available  (2.4GB of 16GB)
  ✓ GPU Support       (Intel UHD Graphics)
  ✓ Audio Device      (HDMI Audio)

CACHE STATUS
  Whisper-local:      medium (140MB)
  Kokoro:             1.2GB
  OpenAI API:         Configured

RECENT USAGE
  STT Calls:          245
  TTS Calls:          312
  Avg STT Latency:    1.2s
  Avg TTS Latency:    0.8s
  Error Rate:         0.2%
  Fallback Rate:      0.05%
```

### Command: `clawdbot voice test`

**Purpose:** Test voice providers with sample input

**Usage:**
```bash
clawdbot voice test [OPTIONS]

Options:
  --text <text>               Text to synthesize (default: "Hello! This is a voice test.")
  --file <path>               Audio file to transcribe
  --stt-only                  Test STT only
  --tts-only                  Test TTS only
  --all-providers             Test all available providers
  --timeout <ms>              Timeout in milliseconds (default: 30000)
```

**Examples:**
```bash
# Test current setup
clawdbot voice test

# Test specific providers
clawdbot voice test --all-providers

# Test with custom text
clawdbot voice test --text "Custom phrase"

# Test STT with audio file
clawdbot voice test --file audio.wav --stt-only

# Test all providers with timeout
clawdbot voice test --all-providers --timeout 60000
```

**Output Example:**
```
Testing Voice Providers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEXT-TO-SPEECH (TTS)
  Phrase: "Hello! This is a voice test."

  Kokoro (active)
    Voice:     af_bella
    Duration:  2.3s
    Size:      18KB
    Status:    ✓ Success
    Latency:   847ms
    [Play Output]

  Piper (fallback)
    Voice:     p301 (American English)
    Duration:  2.8s
    Size:      22KB
    Status:    ✓ Success
    Latency:   1.2s
    [Play Output]

  OpenAI TTS (available)
    Voice:     echo
    Duration:  2.1s
    Size:      16KB
    Status:    ⚠ Not configured
    [Configure]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SPEECH-TO-TEXT (STT)
  Playing Kokoro output through STT...

  Whisper-local (active)
    Detected Language:  English
    Confidence:         0.95
    Result:             "Hello this is a voice test"
    Latency:            1.8s
    Status:             ✓ Success

  OpenAI Realtime (fallback)
    Result:             "Hello, this is a voice test."
    Latency:            2.1s
    Status:             ✓ Success
    Cost:               $0.0004

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUMMARY
  Overall:    ✓ All providers working
  Round-trip: 4.1s (TTS → STT → Playback)
  Best combo: Kokoro → Whisper-local (3.0s, free)
```

### Command: `clawdbot voice providers`

**Purpose:** List available voice providers

**Usage:**
```bash
clawdbot voice providers [OPTIONS]

Options:
  --stt                  Show STT providers only
  --tts                  Show TTS providers only
  --installed            Show installed providers only
  --all                  Show all available providers (default)
  --json                 JSON output
```

**Output Example:**
```
Available Voice Providers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SPEECH-TO-TEXT (STT)

✓ Whisper-local (INSTALLED, ACTIVE)
  Type:        Offline, Open-source
  Accuracy:    High (~92%)
  Latency:     1-3s (depends on audio length & model)
  Cost:        Free
  Models:      tiny, small, base, medium, large
  Languages:   99
  Setup:       pip install openai-whisper
  Docs:        https://github.com/openai/whisper

◆ OpenAI Realtime (AVAILABLE)
  Type:        Cloud API
  Accuracy:    Very High (~95%)
  Latency:     ~100ms
  Cost:        $0.02 per minute
  Models:      gpt-4-realtime (WebSocket)
  Languages:   All (auto-detected)
  Setup:       export OPENAI_API_KEY=sk-...
  Docs:        https://platform.openai.com/docs/guides/speech-to-text

◇ Azure Speech Services (COMING SOON)
  Type:        Cloud API
  Accuracy:    Very High
  Cost:        $0.006-0.012 per minute
  Setup:       Configure Azure credentials
  Status:      Planned for v2.1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEXT-TO-SPEECH (TTS)

✓ Kokoro (INSTALLED, ACTIVE)
  Type:        Offline, High-quality
  Voices:      8 (4 American, 4 British)
  Speed:       Real-time (10x faster than playback)
  Cost:        Free
  Quality:     Very High
  Setup:       Auto-included
  Voice List:  af_bella, af_sarah, am_adam, am_michael,
               bf_emma, bf_isabella, bm_george, bm_lewis
  Docs:        https://github.com/remixer-dec/kokoro

✓ Piper (AVAILABLE)
  Type:        Offline, Multi-language
  Voices:      100+ across 20+ languages
  Speed:       Real-time
  Cost:        Free
  Quality:     High
  Setup:       pip install piper-tts
  Languages:   en, de, es, fr, it, ja, zh, ...
  Docs:        https://github.com/rhasspy/piper

◆ OpenAI TTS (AVAILABLE)
  Type:        Cloud API
  Voices:      6 (alloy, echo, fable, onyx, shimmer, nova)
  Speed:       2-5x faster than real-time
  Cost:        $0.015 per 1,000 characters
  Quality:     Highest
  Setup:       export OPENAI_API_KEY=sk-...
  Docs:        https://platform.openai.com/docs/guides/text-to-speech

◇ Azure Speech Services (COMING SOON)
  Type:        Cloud API
  Voices:      200+ across 70+ languages
  Cost:        $0.0008-0.0016 per 10K characters
  Quality:     Very High
  Setup:       Configure Azure credentials
  Status:      Planned for v2.1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEGEND
  ✓ = Installed & working
  ◆ = Available (not installed)
  ◇ = Coming soon
  ACTIVE = Currently in use
  INSTALLED = Ready to use
  AVAILABLE = Can be installed

TIPS
  • Install Piper: clawdbot voice install piper
  • Configure OpenAI: export OPENAI_API_KEY=sk-...
  • Switch provider: clawdbot voice configure
  • Test provider: clawdbot voice test --all-providers
```

---

## Settings Schema Design

### Config Schema: `src/config/zod-schema.voice.ts` (NEW)

```typescript
import { z } from "zod";

// ============================================================================
// Provider Definitions
// ============================================================================

export const STTProviderType = z.enum([
  "whisper-local",
  "openai-realtime",
  "azure-speech",
  "google-cloud",
]);

export const TTSProviderType = z.enum([
  "kokoro",
  "piper",
  "openai-tts",
  "azure-tts",
  "google-tts",
]);

// ============================================================================
// Whisper-local Configuration
// ============================================================================

const WhisperLocalConfigSchema = z
  .object({
    modelSize: z
      .enum(["tiny", "small", "base", "medium", "large"])
      .default("medium"),
    autoLanguageDetection: z.boolean().default(true),
    device: z.enum(["cpu", "cuda", "mps"]).optional(),
    computeType: z.enum(["default", "auto", "int8", "int8_float32"]).optional(),
    beamSize: z.number().int().min(1).max(100).default(5),
    bestOf: z.number().int().min(1).max(5).default(1),
    temperature: z.number().min(0).max(1).default(0),
  })
  .optional();

// ============================================================================
// OpenAI Realtime Configuration
// ============================================================================

const OpenAIRealtimeConfigSchema = z
  .object({
    apiKey: z.string().min(1),
    model: z.literal("gpt-4-realtime").default("gpt-4-realtime"),
    voiceActivityDetection: z.boolean().default(true),
    vadThreshold: z.number().min(0).max(1).default(0.3),
    maxTokens: z.number().int().positive().default(4096),
  })
  .optional();

// ============================================================================
// Kokoro Configuration
// ============================================================================

const KokoroConfigSchema = z
  .object({
    voice: z
      .enum([
        "af_bella",
        "af_sarah",
        "am_adam",
        "am_michael",
        "bf_emma",
        "bf_isabella",
        "bm_george",
        "bm_lewis",
      ])
      .default("af_bella"),
    speed: z.number().min(0.5).max(2.0).default(1.0),
    device: z.enum(["cpu", "cuda", "mps"]).optional(),
  })
  .optional();

// ============================================================================
// Piper Configuration
// ============================================================================

const PiperConfigSchema = z
  .object({
    language: z.string().default("en"),
    voice: z.string().default("p301"),
    speed: z.number().min(0.5).max(2.0).default(1.0),
    outputFormat: z
      .enum(["pcm", "wav", "raw", "mulaw"])
      .default("pcm"),
    device: z.enum(["cpu", "cuda"]).optional(),
  })
  .optional();

// ============================================================================
// OpenAI TTS Configuration
// ============================================================================

const OpenAITTSConfigSchema = z
  .object({
    apiKey: z.string().min(1),
    model: z.enum(["tts-1", "tts-1-hd"]).default("tts-1"),
    voice: z
      .enum(["alloy", "echo", "fable", "onyx", "shimmer", "nova"])
      .default("alloy"),
    speed: z.number().min(0.25).max(4.0).default(1.0),
  })
  .optional();

// ============================================================================
// Main Voice Configuration
// ============================================================================

export const VoiceSTTConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    provider: STTProviderType,
    whisperLocal: WhisperLocalConfigSchema,
    openaiRealtime: OpenAIRealtimeConfigSchema,
    fallbackProvider: STTProviderType.optional(),
    timeout: z.number().int().positive().default(30000),
  })
  .strict()
  .refine(
    (data) => {
      // If provider is whisper-local, whisperLocal config must exist or use defaults
      if (data.provider === "whisper-local" && !data.whisperLocal) {
        return true; // Defaults apply
      }
      // If provider is openai-realtime, apiKey must be provided
      if (
        data.provider === "openai-realtime" &&
        !data.openaiRealtime?.apiKey
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "Missing required configuration for selected STT provider",
    }
  );

export const VoiceTTSConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    provider: TTSProviderType,
    kokoro: KokoroConfigSchema,
    piper: PiperConfigSchema,
    openaiTts: OpenAITTSConfigSchema,
    fallbackProvider: TTSProviderType.optional(),
    timeout: z.number().int().positive().default(10000),
  })
  .strict()
  .refine(
    (data) => {
      // If provider is kokoro or piper, no additional config needed (optional)
      if (data.provider === "kokoro" || data.provider === "piper") {
        return true;
      }
      // If provider is openai-tts, apiKey must be provided
      if (data.provider === "openai-tts" && !data.openaiTts?.apiKey) {
        return false;
      }
      return true;
    },
    {
      message: "Missing required configuration for selected TTS provider",
    }
  );

export const VoiceConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    stt: VoiceSTTConfigSchema,
    tts: VoiceTTSConfigSchema,
    fallbackEnabled: z.boolean().default(true),
    audioFormat: z
      .object({
        sampleRate: z.number().int().default(16000),
        channels: z.number().int().min(1).max(2).default(1),
        bitDepth: z.number().int().default(16),
        encoding: z.enum(["pcm", "mulaw", "alaw"]).default("pcm"),
      })
      .optional(),
  })
  .optional();

export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;
export type VoiceSTTConfig = z.infer<typeof VoiceSTTConfigSchema>;
export type VoiceTTSConfig = z.infer<typeof VoiceTTSConfigSchema>;
```

### Integration into Main Schema

**In `src/config/zod-schema.ts`:**

```typescript
import { VoiceConfigSchema } from "./zod-schema.voice.js";

export const ClawdbotSchema = z
  .object({
    // ... existing fields ...
    audio: AudioSchema,
    messages: MessagesSchema,
+ voice: VoiceConfigSchema,        // NEW
    commands: CommandsSchema,
    // ... rest of schema ...
  })
  .strict();
```

### Config Types: `src/config/types.voice.ts` (NEW)

```typescript
export interface VoiceProvider {
  id: string;
  name: string;
  type: "local" | "cloud";
  category: "stt" | "tts";
  enabled: boolean;
  status: "ready" | "error" | "unconfigured" | "loading";
  errorMessage?: string;
}

export interface STTProvider extends VoiceProvider {
  category: "stt";
  accuracy?: string;
  latency?: string;
  languages?: number;
}

export interface TTSProvider extends VoiceProvider {
  category: "tts";
  voices?: string[];
  quality?: string;
  cost?: string;
}

export interface VoiceHealth {
  sttStatus: "healthy" | "degraded" | "unhealthy";
  ttsStatus: "healthy" | "degraded" | "unhealthy";
  lastTestedAt: Date;
  uptime: number;
  errorRate: number;
}
```

### UI Hints: `src/config/schema.ts` (UPDATED)

```typescript
const FIELD_LABELS: Record<string, string> = {
  // ... existing ...
+ "voice.enabled": "Enable Voice Features",
+ "voice.stt.provider": "STT Provider",
+ "voice.stt.whisperLocal.modelSize": "Whisper Model Size",
+ "voice.stt.whisperLocal.autoLanguageDetection": "Auto Language Detection",
+ "voice.stt.timeout": "STT Timeout (ms)",
+ "voice.tts.provider": "TTS Provider",
+ "voice.tts.kokoro.voice": "Kokoro Voice",
+ "voice.tts.kokoro.speed": "Speech Speed",
+ "voice.tts.piper.voice": "Piper Voice",
+ "voice.tts.openaiTts.voice": "OpenAI Voice",
+ "voice.tts.timeout": "TTS Timeout (ms)",
+ "voice.fallbackEnabled": "Enable Fallback Providers",
};

const CONFIGURE_SECTION_OPTIONS = [
  // ... existing ...
+ { value: "voice", label: "Voice", hint: "STT/TTS provider setup" },
];

const GROUP_LABELS: Record<string, string> = {
  // ... existing ...
+ voice: "Voice",
};

const GROUP_ORDER: Record<string, number> = {
  // ... existing ...
+ voice: 65,  // Between audio (60) and models (70)
};
```

---

## User Journeys

### Journey 1: New User - Basic Setup

```
┌─ Start: clawdbot init
├─ Questions: workspace, model, gateway, channels, skills
├─ "Configure voice providers?"
│  └─ "Not now, I'll configure later"
│
├─ ✓ Configuration saved (defaults)
└─ Message: "Voice: Using auto-detected providers. Reconfigure with
             'clawdbot voice configure'"

After Setup (Optional):
├─ User runs: clawdbot voice configure
├─ Prompted: "Basic or advanced setup?"
│  └─ Choose: "Basic"
├─ System checks capabilities
├─ Recommends: "Whisper-local + Kokoro"
├─ Selects voice: "af_bella"
├─ Tests successfully
├─ ✓ Configuration saved
└─ Ready to use!
```

### Journey 2: Advanced User - Custom Setup

```
┌─ During onboarding: "Configure voice?"
├─ Select: "Advanced setup"
├─ System Check Results:
│  • GPU: NVIDIA RTX 3060
│  • RAM: 32GB available
│  • Platform: Linux
├─ STT: Select "Whisper-local"
│  └─ Model size: "large" (for accuracy)
├─ TTS: Select "OpenAI TTS"
│  └─ Voice: "nova"
│  └─ API Key: [hidden input]
├─ Test both providers
├─ Advanced options:
│  • Fallback: enabled (OpenAI → Piper)
│  • Timeout: 45000ms
│  • Speed: 1.2x
├─ Review config
├─ ✓ Save
└─ Ready with optimized setup!
```

### Journey 3: Switching Providers

```
┌─ Current: Kokoro TTS
├─ Command: clawdbot voice configure --tts-only
├─ Prompt: "Current TTS: Kokoro (af_bella)"
├─ Available options:
│  • Piper (100+ voices)
│  • OpenAI TTS (6 voices, highest quality)
│  • Keep Kokoro
├─ Select: "Piper"
├─ Language: "English"
├─ Voice: "p301 (Female American)"
├─ Test: "Hello! This is a voice test."
│  ✓ Success in 1.2s
├─ Save new config
└─ ✓ Voice switched!
```

### Journey 4: Troubleshooting

```
┌─ User runs: clawdbot message send --to "+1234" --text "Hello"
├─ Error: TTS failed - Kokoro timeout
├─ User runs: clawdbot voice status --health
├─ Output shows:
│  • STT: ✓ Ready
│  • TTS: ⚠ Degraded (recent timeout)
│  • Fallback attempted: ✓ Success
├─ User runs: clawdbot voice test --all-providers --timeout 60000
├─ Results show:
│  • Kokoro: ⚠ 8.2s (slow)
│  • Piper: ✓ 2.1s (working)
├─ Decision: Switch to Piper
├─ Command: clawdbot voice configure --tts piper
├─ Voice selected, config saved
├─ Retry message: ✓ Success!
└─ Issue resolved
```

### Journey 5: Mac App Integration

```
┌─ User opens Clawdbot Mac app
├─ Settings tab → Voice
├─ UI shows:
│  • STT: Whisper-local ✓
│  • TTS: Kokoro ✓
│  • Voice samples available
├─ User clicks: [Test Voice]
├─ Hears: "Hello! This is a voice test."
├─ User drags voice speed slider: 1.2x
├─ User clicks voice dropdown: sees 8 voices
├─ User selects: "af_sarah"
├─ Clicks: [Play Sample]
├─ Hears: "Hello! This is a voice test." (af_sarah voice)
├─ Confirms: [Save]
├─ Config synced to cloud
└─ ✓ Voice updated across all devices!
```

---

## Breaking vs Non-Breaking Changes

### Non-Breaking Changes (Safe)

✓ **Adding new optional config section:**
```json
{
  "voice": {
    "enabled": true,
    "stt": {...},
    "tts": {...}
  }
}
```
- Existing configs without `voice` section: still work
- New section defaults to auto-detection if omitted
- No migration needed

✓ **Adding new CLI commands:**
- `clawdbot voice configure`
- `clawdbot voice status`
- `clawdbot voice test`
- `clawdbot voice providers`
- Existing commands unaffected

✓ **Adding new dashboard page:**
- `/settings/voice` - new page
- Existing pages unchanged
- Accessible from settings navigation

✓ **Adding onboarding section:**
- New section in configure wizard
- Entirely optional (can skip)
- Doesn't affect existing sections

### Breaking Changes (None!)

✓ **Zero breaking changes by design:**
- All changes are backwards compatible
- Existing voice-call extension still works
- All current voice-related configs preserved
- No modifications to existing data structures
- Existing voice features continue unchanged

### Migration Path (If Needed)

If user has legacy voice config:

```typescript
// Before (legacy)
{
  "talk": {
    "voice": "nova",
    "voiceAliases": {
      "main": "nova"
    }
  }
}

// After (optional migration)
{
  "voice": {
    "enabled": true,
    "tts": {
      "provider": "openai-tts",
      "openaiTts": {
        "voice": "nova"
      }
    }
  },
  // Legacy still works too (backwards compat)
  "talk": {
    "voice": "nova",
    "voiceAliases": { "main": "nova" }
  }
}
```

**Migration strategy:**
1. Detect legacy `talk.voice` config
2. Offer migration: "Migrate to new voice system? [Y/n]"
3. If yes: create new `voice` section, preserve old section
4. If no: keep working as-is with legacy config
5. In future major version: deprecation notice

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Create `src/config/zod-schema.voice.ts` with all provider schemas
- [ ] Create `src/config/types.voice.ts` with TypeScript types
- [ ] Update `src/config/schema.ts` with UI hints and labels
- [ ] Create `src/commands/configure.voice.ts` for wizard integration
- [ ] Add voice section to `CONFIGURE_WIZARD_SECTIONS`

### Phase 2: CLI Commands (Week 2)
- [ ] Create `src/commands/voice.ts` with main command structure
- [ ] Implement `clawdbot voice configure` (full wizard)
- [ ] Implement `clawdbot voice status` (current config)
- [ ] Implement `clawdbot voice test` (provider testing)
- [ ] Implement `clawdbot voice providers` (list available)
- [ ] Add voice commands to CLI router

### Phase 3: Gateway API Endpoints (Week 2)
- [ ] Create `src/gateway/routes/voice-config.ts` with endpoints:
  - `GET /api/voice/config` - current config
  - `POST /api/voice/test` - test providers
  - `PUT /api/voice/config` - update config
  - `GET /api/voice/status` - health status
  - `GET /api/voice/providers` - list available
- [ ] Add authentication guards
- [ ] Add error handling

### Phase 4: Web Dashboard (Week 3)
- [ ] Create `apps/web/components/voice-provider.tsx` - provider card
- [ ] Create `apps/web/components/voice-selector.tsx` - voice selection
- [ ] Create `apps/web/pages/settings/voice.tsx` - main page
- [ ] Add voice settings link to main settings page
- [ ] Implement voice sample playback
- [ ] Add test interface

### Phase 5: System Capabilities (Week 3)
- [ ] Create `src/config/voice-capabilities.ts` - system detection
- [ ] Implement GPU detection (NVIDIA/AMD/Metal)
- [ ] Implement memory check
- [ ] Implement provider availability detection
- [ ] Create recommendation algorithm

### Phase 6: Integration & Testing (Week 4)
- [ ] Integration tests for all CLI commands
- [ ] E2E tests for onboarding flow
- [ ] Gateway API tests
- [ ] Web dashboard tests
- [ ] Full config validation
- [ ] Test with all provider combinations

### Phase 7: Documentation & Polish (Week 4)
- [ ] Update CLI help text
- [ ] Create voice setup guide
- [ ] Create troubleshooting guide
- [ ] Update CHANGELOG.md
- [ ] Create migration guide (for legacy configs)
- [ ] Internal documentation for maintainers

### Phase 8: Release (Week 5)
- [ ] Code review preparation
- [ ] Address review feedback
- [ ] Final testing
- [ ] Release notes preparation
- [ ] Version bump
- [ ] Merge to main

---

## Summary

This comprehensive UX integration design provides:

1. **Seamless Onboarding** - Progressive disclosure from skip to advanced setup
2. **Intuitive Configuration** - Smart defaults, recommendations, system detection
3. **Clear Feedback** - Status displays, health checks, testing utilities
4. **Multi-Platform Support** - CLI, Web Dashboard, macOS/iOS native apps
5. **Zero Breaking Changes** - Fully backwards compatible
6. **Production-Ready** - Clear roadmap, testable components, documented APIs

The integration prioritizes **user experience** through:
- Minimal friction (skip if not needed)
- Smart recommendations (detect capabilities, suggest optimal setup)
- Clear feedback (status, health, test results)
- Flexibility (basic to advanced options available)
- Consistency (same information across all surfaces)

All design follows **existing Clawdbot patterns** in:
- Configuration (Zod schemas, config management)
- CLI (command structure, prompts, output formatting)
- Web UI (dashboard layout, component organization)
- Onboarding (wizard flow, section-based config)

---

*Design Document Complete - Ready for Implementation*
