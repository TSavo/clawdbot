# Voice Providers: System Integration Guide

**Status:** Integration Ready
**Target Audiences:** Developers, System Administrators, End Users
**Last Updated:** January 2026

---

## Overview

This guide documents how the pluggable voice provider system integrates across Clawdbot's onboarding, configuration, web dashboard, and CLI layers. It serves as a reference for developers building features that depend on voice providers, as well as system administrators deploying Clawdbot with specific STT/TTS configurations.

The voice provider system follows Clawdbot's existing patterns for:
- **Plugin discovery** via npm packages (`@clawdbot/stt-*`, `@clawdbot/tts-*`)
- **Configuration** via YAML/JSON with Zod validation
- **Form handling** in web UI with React controllers
- **CLI interactions** with interactive prompts (Clack)
- **Connection lifecycle** (setup, validation, fallback)

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                   Clawdbot Application                      │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Onboarding      │  │  Configure Tool  │               │
│  │  Wizard          │  │                  │               │
│  └────────┬─────────┘  └────────┬─────────┘               │
│           │                     │                         │
│           └──────────┬──────────┘                         │
│                      │                                    │
│  ┌───────────────────v──────────────────┐               │
│  │   Configuration Schema & Validation   │               │
│  │  (Zod schemas in config/*.ts)        │               │
│  └───────────────────┬──────────────────┘               │
│                      │                                    │
│  ┌───────────────────v──────────────────┐               │
│  │   Voice Provider Plugin System        │               │
│  │  (extensions/voice-call/plugins/)    │               │
│  │  • Registry                           │               │
│  │  • Provider Interfaces                │               │
│  │  • Discovery & Initialization         │               │
│  └───────────────────┬──────────────────┘               │
│                      │                                    │
│  ┌───────────────────v──────────────────┐               │
│  │   Web Dashboard (React UI)            │               │
│  │  • Voice settings panels              │               │
│  │  • Provider selection dropdowns       │               │
│  │  • Provider-specific forms            │               │
│  └───────────────────────────────────────┘               │
│                                                              │
│  ┌───────────────────────────────────────┐               │
│  │   Voice-Call Extension                │               │
│  │  • Twilio/Telnyx integration          │               │
│  │  • Provider usage (STT/TTS)           │               │
│  │  • Audio format negotiation           │               │
│  └───────────────────────────────────────┘               │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

---

## Integration Point 1: Onboarding Flow

### User Journey: First-Time Setup

When a new user runs `clawdbot init` or `clawdbot onboard`, the wizard should help them:

1. **Select voice capability** - Enable/disable voice features
2. **Choose STT provider** - Speech-to-text provider for incoming calls
3. **Choose TTS provider** - Text-to-speech for outgoing messages
4. **Configure provider credentials** - API keys, model selection, etc.
5. **Test providers** - Health check + optional demo

### Implementation Pattern

The onboarding system follows the connection setup pattern used for Slack, Discord, Telegram, Signal, and iMessage.

**File locations:**
- Wizard logic: `src/wizard/onboarding.ts`
- Channel setup commands: `src/commands/onboard-channels.ts`
- Helpers: `src/commands/onboard-helpers.ts`
- Prompts: `src/wizard/prompts.ts`

**New files to add:**
- `src/commands/onboard-voice-providers.ts` - Voice provider onboarding
- `src/commands/voice-provider-prompt.ts` - Interactive prompts

### Onboarding Code Example

```typescript
// src/commands/onboard-voice-providers.ts
import { z } from "zod";
import type { WizardPrompter } from "../wizard/prompts";
import { getVoiceProviderRegistry } from "../extensions/voice-call/plugins/registry";

export async function setupVoiceProviders(
  state: { config: ClawdbotConfig; prompter: WizardPrompter }
) {
  const enableVoice = await state.prompter.confirm({
    message: "Enable voice features (calls with speech recognition)?",
    initialValue: false,
  });

  if (!enableVoice) {
    return; // Voice disabled
  }

  // Show available STT providers
  const registry = await getVoiceProviderRegistry();
  const sttProviders = registry.listSTTProviders();

  const sttChoice = await state.prompter.select({
    message: "Select speech-to-text provider",
    options: sttProviders.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.capabilities.requiresInternet ? "Cloud" : "Local"})`,
      hint: p.description,
    })),
  });

  // Show available TTS providers
  const ttsProviders = registry.listTTSProviders();

  const ttsChoice = await state.prompter.select({
    message: "Select text-to-speech provider",
    options: ttsProviders.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.capabilities.requiresInternet ? "Cloud" : "Local"})`,
      hint: p.description,
    })),
  });

  // Configure chosen providers
  await configureSTTProvider(state, sttChoice);
  await configureTTSProvider(state, ttsChoice);

  // Health check
  const sttHealthy = await registry.healthCheckSTT(sttChoice);
  const ttsHealthy = await registry.healthCheckTTS(ttsChoice);

  if (!sttHealthy || !ttsHealthy) {
    await state.prompter.note(
      "Warning: Some providers failed health check. Verify credentials are correct.",
      "Provider Status"
    );
  }
}

async function configureSTTProvider(
  state: { config: ClawdbotConfig; prompter: WizardPrompter },
  providerId: string
) {
  const provider = await getVoiceProviderRegistry().getSTTProvider(providerId);

  if (providerId === "openai-realtime") {
    const apiKey = await state.prompter.password({
      message: "Enter OpenAI API key",
      validate: (v) => v.length > 0 ? true : "API key required",
    });

    const model = await state.prompter.select({
      message: "Select model",
      options: [
        { value: "gpt-4o-transcribe", label: "gpt-4o-transcribe (latest)" },
      ],
    });

    state.config.voice = state.config.voice || {};
    state.config.voice.stt = {
      provider: providerId,
      config: { apiKey, model },
    };
  }
  // Additional provider-specific setup
}

async function configureTTSProvider(
  state: { config: ClawdbotConfig; prompter: WizardPrompter },
  providerId: string
) {
  if (providerId === "openai-tts") {
    const apiKey = await state.prompter.password({
      message: "Enter OpenAI API key",
    });

    const voice = await state.prompter.select({
      message: "Select voice",
      options: [
        { value: "coral", label: "Coral (neutral, natural)" },
        { value: "sage", label: "Sage (warm, professional)" },
        // ... more voices
      ],
    });

    state.config.voice = state.config.voice || {};
    state.config.voice.tts = {
      provider: providerId,
      config: { apiKey, voice },
    };
  }
  // Additional provider-specific setup
}
```

### Integration with Existing Wizard Flow

Add to `src/wizard/onboarding.ts` main flow:

```typescript
export async function runOnboardingWizard(
  opts: OnboardOptions,
  runtime: RuntimeEnv = defaultRuntime,
  prompter: WizardPrompter,
) {
  // ... existing setup ...

  // Add voice provider setup
  if (flow === "advanced") {
    await setupVoiceProviders({ config: baseConfig, prompter });
  } else if (flow === "quickstart") {
    // Minimal voice setup - just enable/disable
    const enableVoice = await prompter.confirm({
      message: "Enable voice features?",
      initialValue: true,
    });
    if (enableVoice) {
      // Use defaults
      baseConfig.voice = {
        stt: { provider: "openai-realtime", config: {} },
        tts: { provider: "openai-tts", config: {} },
      };
    }
  }

  // ... continue with finalization ...
}
```

---

## Integration Point 2: Configuration System

### Configuration Schema

Voice providers are configured in `~/.clawdbot/config.yaml` under a `voice` section:

```yaml
voice:
  stt:
    provider: "openai-realtime"
    config:
      apiKey: "${OPENAI_API_KEY}"
      model: "gpt-4o-transcribe"
      silenceDurationMs: 800
      vadThreshold: 0.5
    fallback:
      providers:
        - "whisper-local"
        - "coqui-local"

  tts:
    provider: "openai-tts"
    config:
      apiKey: "${OPENAI_API_KEY}"
      voice: "coral"
      speed: 1.0
    fallback:
      providers:
        - "kokoro-local"
```

### Zod Validation Schema

Create `src/config/zod-schema.voice-providers.ts`:

```typescript
import { z } from "zod";

export const VoiceSTTConfigSchema = z.object({
  provider: z.string().describe("STT provider ID"),
  config: z.record(z.unknown()).optional().describe("Provider-specific config"),
  fallback: z
    .object({
      providers: z.array(z.string()).optional(),
      strategy: z.enum(["priority", "round-robin", "failover"]).optional(),
      maxRetries: z.number().int().positive().optional(),
      retryDelayMs: z.number().int().positive().optional(),
    })
    .optional()
    .describe("Fallback rules when primary provider fails"),
});

export const VoiceTTSConfigSchema = z.object({
  provider: z.string().describe("TTS provider ID"),
  config: z.record(z.unknown()).optional(),
  fallback: z
    .object({
      providers: z.array(z.string()).optional(),
      strategy: z.enum(["priority", "round-robin", "failover"]).optional(),
      maxRetries: z.number().int().positive().optional(),
      retryDelayMs: z.number().int().positive().optional(),
    })
    .optional(),
});

export const VoiceConfigSchema = z
  .object({
    stt: VoiceSTTConfigSchema.optional(),
    tts: VoiceTTSConfigSchema.optional(),
    audioFormat: z
      .object({
        sampleRate: z.enum([8000, 16000, 24000, 48000]).optional(),
        format: z.enum(["pcm", "wav", "mp3", "mu-law"]).optional(),
      })
      .optional(),
  })
  .optional()
  .describe("Voice provider configuration");
```

Integrate into main config schema (`src/config/zod-schema.ts`):

```typescript
export const ClawdbotConfigSchema = z.object({
  // ... existing fields ...
  voice: VoiceConfigSchema,
});
```

### Configuration Loading

The gateway loads voice configuration at startup:

```typescript
// src/gateway/startup.ts (or similar)
import { loadVoiceProviderConfig } from "../config/voice-config";

export async function initializeGateway(config: ClawdbotConfig) {
  // ... existing init ...

  // Initialize voice providers
  if (config.voice) {
    const registry = await loadVoiceProviderConfig(config.voice);
    // Make available to voice-call extension
    app.locals.voiceProviderRegistry = registry;
  }
}
```

---

## Integration Point 3: Web Dashboard (React UI)

### UI Layout

Add voice provider settings to the web dashboard configuration page:

**Location:** `ui/src/ui/pages/Configuration.tsx` (or similar)

### Voice Settings Form Components

Create new components:

**File:** `ui/src/ui/controllers/config.voice-providers.ts`

```typescript
import type { ConfigState } from "./config";
import type { VoiceForm, VoiceSTTForm, VoiceTTSForm } from "../ui-types";

export interface VoiceFormState {
  voiceEnabled: boolean;
  sttProvider: string;
  sttConfig: Record<string, unknown>;
  ttsProvider: string;
  ttsConfig: Record<string, unknown>;
  sttProviders: ProviderOption[];
  ttsProviders: ProviderOption[];
  loadingProviders: boolean;
  testResults: {
    sttHealthy: boolean | null;
    ttsHealthy: boolean | null;
  };
}

export interface ProviderOption {
  id: string;
  name: string;
  type: "cloud" | "local";
  description: string;
  requiresInternet: boolean;
  supportsStreaming: boolean;
}

export async function loadVoiceProviderOptions(state: ConfigState) {
  if (!state.client || !state.connected) return;

  try {
    const response = await state.client.request("voice.providers.list", {});

    // Parse providers and populate voice form
    state.voiceForm = {
      sttProviders: response.stt,
      ttsProviders: response.tts,
    };
  } catch (err) {
    state.lastError = String(err);
  }
}

export async function testVoiceProvider(
  state: ConfigState,
  type: "stt" | "tts",
  providerId: string
) {
  if (!state.client || !state.connected) return;

  try {
    const response = await state.client.request("voice.provider.health", {
      type,
      providerId,
    });

    return response.healthy as boolean;
  } catch (err) {
    console.error(`Health check failed for ${type}/${providerId}:`, err);
    return false;
  }
}

export function updateVoiceProviderSelection(
  state: ConfigState,
  type: "stt" | "tts",
  providerId: string
) {
  state.configForm = state.configForm || {};
  state.configForm.voice = state.configForm.voice || {};

  if (type === "stt") {
    state.configForm.voice.stt = {
      provider: providerId,
      config: {},
    };
  } else {
    state.configForm.voice.tts = {
      provider: providerId,
      config: {},
    };
  }

  state.configFormDirty = true;
}
```

### React Component Example

**File:** `ui/src/ui/components/VoiceProviderSettings.tsx`

```typescript
import React, { useEffect, useState } from "react";
import type { VoiceFormState, ProviderOption } from "../controllers/config.voice-providers";

interface VoiceProviderSettingsProps {
  enabled: boolean;
  sttProvider: string;
  ttsProvider: string;
  sttProviders: ProviderOption[];
  ttsProviders: ProviderOption[];
  onChanged: (path: string[], value: unknown) => void;
  onTest: (type: "stt" | "tts", providerId: string) => Promise<boolean>;
}

export const VoiceProviderSettings: React.FC<VoiceProviderSettingsProps> = ({
  enabled,
  sttProvider,
  ttsProvider,
  sttProviders,
  ttsProviders,
  onChanged,
  onTest,
}) => {
  const [testResults, setTestResults] = useState<{
    sttHealthy: boolean | null;
    ttsHealthy: boolean | null;
  }>({ sttHealthy: null, ttsHealthy: null });

  useEffect(() => {
    if (enabled && sttProvider) {
      onTest("stt", sttProvider).then((healthy) =>
        setTestResults((prev) => ({ ...prev, sttHealthy: healthy }))
      );
    }
  }, [enabled, sttProvider]);

  return (
    <div className="voice-provider-settings">
      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) =>
              onChanged(["voice", "enabled"], e.currentTarget.checked)
            }
          />
          Enable Voice Features
        </label>
      </div>

      {enabled && (
        <>
          <div className="setting-group">
            <label htmlFor="stt-provider">Speech-to-Text Provider</label>
            <select
              id="stt-provider"
              value={sttProvider}
              onChange={(e) =>
                onChanged(["voice", "stt", "provider"], e.currentTarget.value)
              }
            >
              <option value="">-- Select Provider --</option>
              {sttProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type === "cloud" ? "Cloud" : "Local"})
                </option>
              ))}
            </select>
            {testResults.sttHealthy !== null && (
              <span className={testResults.sttHealthy ? "healthy" : "unhealthy"}>
                {testResults.sttHealthy ? "✓ Connected" : "✗ Unavailable"}
              </span>
            )}
          </div>

          <div className="setting-group">
            <label htmlFor="tts-provider">Text-to-Speech Provider</label>
            <select
              id="tts-provider"
              value={ttsProvider}
              onChange={(e) =>
                onChanged(["voice", "tts", "provider"], e.currentTarget.value)
              }
            >
              <option value="">-- Select Provider --</option>
              {ttsProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type === "cloud" ? "Cloud" : "Local"})
                </option>
              ))}
            </select>
            {testResults.ttsHealthy !== null && (
              <span className={testResults.ttsHealthy ? "healthy" : "unhealthy"}>
                {testResults.ttsHealthy ? "✓ Connected" : "✗ Unavailable"}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};
```

### Gateway API Endpoints

Add new endpoints to the gateway for voice provider support:

**File:** `src/gateway/server-methods/voice.ts`

```typescript
import type { GatewayMethods } from "./types";
import { getVoiceProviderRegistry } from "../extensions/voice-call/plugins/registry";

export const voiceMethods: GatewayMethods = {
  async "voice.providers.list"() {
    const registry = await getVoiceProviderRegistry();

    return {
      stt: registry.listSTTProviders().map((p) => ({
        id: p.id,
        name: p.name,
        type: p.capabilities.requiresInternet ? "cloud" : "local",
        description: p.description,
        requiresInternet: p.capabilities.requiresInternet,
        supportsStreaming: p.capabilities.streaming,
      })),
      tts: registry.listTTSProviders().map((p) => ({
        id: p.id,
        name: p.name,
        type: p.capabilities.requiresInternet ? "cloud" : "local",
        description: p.description,
        requiresInternet: p.capabilities.requiresInternet,
        supportsStreaming: p.capabilities.streaming,
      })),
    };
  },

  async "voice.provider.health"(
    req: { type: "stt" | "tts"; providerId: string }
  ) {
    const registry = await getVoiceProviderRegistry();

    if (req.type === "stt") {
      const provider = registry.getSTTProvider(req.providerId);
      if (!provider) return { healthy: false, error: "Provider not found" };
      const healthy = await provider.healthCheck?.();
      return { healthy: healthy ?? true };
    } else {
      const provider = registry.getTTSProvider(req.providerId);
      if (!provider) return { healthy: false, error: "Provider not found" };
      const healthy = await provider.healthCheck?.();
      return { healthy: healthy ?? true };
    }
  },
};
```

Register with gateway:

```typescript
// src/gateway/index.ts
import { voiceMethods } from "./server-methods/voice";

export function registerGatewayMethods(app: Express) {
  // ... existing methods ...
  Object.assign(app.locals.gatewayMethods, voiceMethods);
}
```

---

## Integration Point 4: Configure Tool (CLI)

### CLI Commands

Add voice provider configuration to `clawdbot configure`:

**File:** `src/commands/configure-voice.ts`

```typescript
import type { WizardPrompter } from "../wizard/prompts";
import { getVoiceProviderRegistry } from "../extensions/voice-call/plugins/registry";

export async function configureVoiceProviders(prompter: WizardPrompter) {
  const registry = await getVoiceProviderRegistry();

  const action = await prompter.select({
    message: "Voice configuration",
    options: [
      { value: "stt", label: "Configure speech-to-text (STT)" },
      { value: "tts", label: "Configure text-to-speech (TTS)" },
      { value: "fallback", label: "Configure fallback providers" },
      { value: "test", label: "Test providers" },
    ],
  });

  switch (action) {
    case "stt":
      return await configureSTPProvider(prompter, registry);
    case "tts":
      return await configureTTSProvider(prompter, registry);
    case "fallback":
      return await configureFallback(prompter, registry);
    case "test":
      return await testProviders(prompter, registry);
  }
}

async function configureSTPProvider(
  prompter: WizardPrompter,
  registry: VoiceProviderRegistry
) {
  const providers = registry.listSTTProviders();

  const selected = await prompter.select({
    message: "Select speech-to-text provider",
    options: providers.map((p) => ({
      value: p.id,
      label: `${p.name}`,
      hint: `${p.capabilities.streaming ? "Streaming" : "Batch"} • ${
        p.capabilities.requiresInternet ? "Cloud" : "Local"
      }`,
    })),
  });

  // Get provider and prompt for config
  const provider = registry.getSTTProvider(selected);
  if (!provider) throw new Error(`Provider ${selected} not found`);

  // Provider-specific configuration
  const config: Record<string, unknown> = {};

  if (selected === "openai-realtime") {
    config.apiKey = await prompter.password({
      message: "Enter OpenAI API key",
    });
    config.model = await prompter.text({
      message: "Model",
      initialValue: "gpt-4o-transcribe",
    });
  } else if (selected === "whisper-local") {
    config.modelSize = await prompter.select({
      message: "Model size",
      options: [
        { value: "tiny", label: "Tiny (fastest, ~39MB)" },
        { value: "base", label: "Base (balanced, ~140MB)" },
        { value: "small", label: "Small (accurate, ~466MB)" },
      ],
    });
    config.device = await prompter.select({
      message: "Compute device",
      options: [
        { value: "cpu", label: "CPU (slow but works anywhere)" },
        { value: "cuda", label: "NVIDIA GPU (fast)" },
        { value: "mps", label: "Apple Metal (macOS GPU)" },
      ],
    });
  }

  return { provider: selected, config };
}

async function testProviders(
  prompter: WizardPrompter,
  registry: VoiceProviderRegistry
) {
  const providers = registry.listSTTProviders();

  await prompter.note("Testing providers...");

  const results = await Promise.all(
    providers.map(async (p) => {
      const healthy = await p.provider.healthCheck?.();
      return {
        id: p.id,
        name: p.name,
        healthy: healthy ?? true,
      };
    })
  );

  const summary = results
    .map((r) => `${r.healthy ? "✓" : "✗"} ${r.name}`)
    .join("\n");

  await prompter.note(summary, "Provider Status");
}
```

### Integration with Configure Command

Update `src/commands/configure.ts`:

```typescript
export async function runConfigureWizard(
  opts: ConfigureOptions,
  prompter: WizardPrompter
) {
  const section = await prompter.select({
    message: "What would you like to configure?",
    options: [
      { value: "channels", label: "Connection providers (Slack, Discord, etc.)" },
      { value: "voice", label: "Voice providers (STT/TTS)" },
      { value: "skills", label: "Skills" },
      { value: "model", label: "AI model" },
    ],
  });

  switch (section) {
    case "channels":
      return await setupChannels(prompter);
    case "voice":
      return await configureVoiceProviders(prompter);
    case "skills":
      return await setupSkills(prompter);
    case "model":
      return await promptDefaultModel(prompter);
  }
}
```

---

## Integration Point 5: Voice-Call Extension

### Using Providers in Voice-Call

When voice-call extension handles calls, it uses the provider registry:

**File:** `extensions/voice-call/src/call-manager.ts`

```typescript
import { getVoiceProviderRegistry } from "./plugins/registry";
import type { CallSession } from "./types";

export class CallManager {
  private sttRegistry: PluginRegistry<STTProvider>;
  private ttsRegistry: PluginRegistry<TTSProvider>;

  async initialize() {
    const registry = await getVoiceProviderRegistry();
    this.sttRegistry = registry.stt;
    this.ttsRegistry = registry.tts;
  }

  async handleIncomingAudio(
    callSession: CallSession,
    audioChunk: Buffer
  ): Promise<string> {
    const sttProvider = this.sttRegistry.getPrimary();
    if (!sttProvider) {
      throw new Error("No STT provider available");
    }

    try {
      const transcript = await sttProvider.transcribe(audioChunk, {
        format: "mu-law",
        sampleRate: 8000,
        language: callSession.language,
      });
      return transcript;
    } catch (error) {
      // Fallback to secondary provider
      const fallback = this.sttRegistry.getFallback();
      if (fallback) {
        console.warn("STT provider failed, using fallback");
        return await fallback.transcribe(audioChunk);
      }
      throw error;
    }
  }

  async synthesizeResponse(
    callSession: CallSession,
    text: string
  ): Promise<Buffer> {
    const ttsProvider = this.ttsRegistry.getPrimary();
    if (!ttsProvider) {
      throw new Error("No TTS provider available");
    }

    try {
      const audio = await ttsProvider.synthesize(text, {
        format: "mu-law",
        sampleRate: 8000,
        voice: callSession.voiceSettings?.voice,
        speed: callSession.voiceSettings?.speed,
      });
      return audio;
    } catch (error) {
      const fallback = this.ttsRegistry.getFallback();
      if (fallback) {
        console.warn("TTS provider failed, using fallback");
        return await fallback.synthesize(text);
      }
      throw error;
    }
  }
}
```

### Audio Format Negotiation

The voice-call extension handles format conversion between providers and Twilio:

```typescript
import {
  pcmToMulaw,
  resample24kTo8k,
  type STTOptions
} from "./providers/audio-utils";

export async function normalizeAudioForProvider(
  audio: Buffer,
  provider: STTProvider,
  options: STTOptions = {}
): Promise<{ audio: Buffer; options: STTOptions }> {
  // Get provider's preferred format
  const preferredFormat = provider.supportedFormats[0];

  // Normalize to provider's requirements
  let normalizedAudio = audio;
  let normalizedOptions = options;

  // Example: Convert PCM 24kHz to mu-law 8kHz for OpenAI Realtime
  if (preferredFormat.name === "mu-law" && preferredFormat.sampleRates.includes(8000)) {
    if (options.sampleRate === 24000) {
      normalizedAudio = resample24kTo8k(audio);
    }
    normalizedAudio = pcmToMulaw(normalizedAudio);
    normalizedOptions = { ...options, format: "mu-law", sampleRate: 8000 };
  }

  return { audio: normalizedAudio, options: normalizedOptions };
}
```

---

## Integration Point 6: Error Handling & Fallback

### Fallback Strategy

When a provider fails, the system automatically switches to fallback providers:

```typescript
export async function transcribeWithFallback(
  audio: Buffer,
  registry: PluginRegistry<STTProvider>,
  options: STTOptions = {}
): Promise<string> {
  const providers = registry.list().sort((a, b) => b.priority - a.priority);

  let lastError: Error | null = null;

  for (const { id, provider } of providers) {
    try {
      console.log(`Attempting STT with ${id}...`);
      const result = await provider.transcribe(audio, options);
      return result;
    } catch (error) {
      lastError = error as Error;
      console.warn(`STT provider ${id} failed:`, lastError.message);
      continue; // Try next provider
    }
  }

  throw new Error(
    `All STT providers exhausted. Last error: ${lastError?.message}`
  );
}
```

### Error Propagation

Errors from voice providers should be logged and reported to users:

```typescript
export interface VoiceProviderError extends Error {
  providerId: string;
  type: "stt" | "tts";
  isRetryable: boolean;
  details?: Record<string, unknown>;
}

export class STTProviderError extends Error implements VoiceProviderError {
  providerId: string;
  type = "stt" as const;
  isRetryable: boolean;
  details?: Record<string, unknown>;

  constructor(message: string, providerId: string, isRetryable = true) {
    super(message);
    this.name = "STTProviderError";
    this.providerId = providerId;
    this.isRetryable = isRetryable;
  }
}
```

---

## Integration Point 7: Dependency Management

### Optional Dependencies

Voice providers may depend on external libraries. Use optional peer dependencies:

**In `extensions/voice-call/package.json`:**

```json
{
  "peerDependencies": {
    "@clawdbot/stt-whisper": "^1.0.0",
    "@clawdbot/tts-kokoro": "^1.0.0",
    "@clawdbot/tts-piper": "^1.0.0"
  },
  "peerDependenciesMeta": {
    "@clawdbot/stt-whisper": {
      "optional": true
    },
    "@clawdbot/tts-kokoro": {
      "optional": true
    },
    "@clawdbot/tts-piper": {
      "optional": true
    }
  }
}
```

### Graceful Degradation

If an optional provider package is missing:

```typescript
export async function loadOptionalProvider(packageName: string) {
  try {
    return await import(packageName);
  } catch (error) {
    console.warn(`Optional provider ${packageName} not installed`, error);
    return null; // Skip this provider
  }
}

export async function discoverProviders(options: DiscoveryOptions = {}) {
  const providers: ProviderMetadata[] = [];

  // Built-in providers (always available)
  providers.push(...loadBuiltinProviders());

  // Optional local providers
  if (options.includeLocal !== false) {
    const whisper = await loadOptionalProvider("@clawdbot/stt-whisper");
    if (whisper) providers.push(whisper.metadata);

    const kokoro = await loadOptionalProvider("@clawdbot/tts-kokoro");
    if (kokoro) providers.push(kokoro.metadata);
  }

  return providers;
}
```

---

## Integration Checklist

Use this checklist when integrating voice providers:

### Configuration
- [ ] Add `VoiceConfigSchema` to `src/config/zod-schema.ts`
- [ ] Update main `ClawdbotConfigSchema` to include voice
- [ ] Create `src/config/voice-config.ts` for loading config
- [ ] Document config format in `docs/configuration.md`

### Onboarding
- [ ] Create `src/commands/onboard-voice-providers.ts`
- [ ] Add voice setup to onboarding wizard flow
- [ ] Test with both quickstart and advanced modes
- [ ] Verify provider discovery works

### Web Dashboard
- [ ] Create `ui/src/ui/controllers/config.voice-providers.ts`
- [ ] Create React components for voice settings
- [ ] Add API endpoints in `src/gateway/server-methods/voice.ts`
- [ ] Register endpoints with gateway
- [ ] Test provider selection and health checks

### CLI
- [ ] Create `src/commands/configure-voice.ts`
- [ ] Add voice option to `clawdbot configure` menu
- [ ] Add provider testing command
- [ ] Test with different providers

### Voice-Call Extension
- [ ] Update call manager to use provider registry
- [ ] Implement audio format negotiation
- [ ] Add fallback handling
- [ ] Test with cloud and local providers

### Documentation
- [ ] Update `docs/configuration.md` with voice section
- [ ] Document onboarding flow in `docs/getting-started.md`
- [ ] Add provider setup guide in `docs/voice-providers.md`
- [ ] Document CLI commands in `docs/cli/configure.md`

### Testing
- [ ] Unit tests for config loading
- [ ] Integration tests for provider discovery
- [ ] E2E tests for onboarding flow
- [ ] E2E tests for web dashboard
- [ ] Test fallback behavior

---

## File Reference

### Configuration
- `src/config/zod-schema.voice-providers.ts` - Zod schemas
- `src/config/voice-config.ts` - Config loading

### Onboarding
- `src/commands/onboard-voice-providers.ts` - Voice setup
- `src/wizard/onboarding.ts` - Main wizard (updated)

### Web Dashboard
- `ui/src/ui/controllers/config.voice-providers.ts` - State management
- `ui/src/ui/components/VoiceProviderSettings.tsx` - React component
- `src/gateway/server-methods/voice.ts` - API endpoints

### CLI
- `src/commands/configure-voice.ts` - Configure command

### Voice-Call
- `extensions/voice-call/src/call-manager.ts` - Call handling
- `extensions/voice-call/src/plugins/registry.ts` - Provider registry

### Plugin System
- `extensions/voice-call/src/plugins/interfaces.ts` - Provider interfaces
- `extensions/voice-call/src/plugins/registry.ts` - Registry implementation
- `extensions/voice-call/src/providers/audio-utils.ts` - Audio utilities

---

## Related Documentation

- [Voice Plugins Architecture](/voice-plugins)
- [Voice Providers API Reference](/voice-plugins-api-reference)
- [Configuration Guide](/configuration)
- [Web Dashboard Guide](/web-dashboard)
- [CLI Reference](/cli/configure)
- [Local Providers Setup](/platforms/windows/voice-setup)

---

## Glossary

- **Provider** - An implementation of STT or TTS interface (e.g., OpenAI, Whisper Local)
- **Registry** - System that manages multiple providers and selects which one to use
- **Fallback** - Secondary provider to use if primary provider fails
- **Health Check** - Periodic test to verify provider is available
- **Audio Format** - Encoding, sample rate, bit depth (e.g., PCM 16-bit 24kHz)
- **Normalization** - Converting audio from one format to another

