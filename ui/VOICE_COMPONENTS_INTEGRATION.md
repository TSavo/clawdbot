# Voice Provider Management Components

Complete web UI components for managing voice providers in Clawdbot. Built with Lit and TypeScript, these components provide a comprehensive interface for configuring STT/TTS providers, testing providers, and managing system resources.

## Components Overview

### 1. **VoiceSettingsPanel** (`voice-settings-panel.ts`)

Main settings container component that orchestrates the voice system configuration.

**Features:**
- Provider discovery and selection
- STT/TTS provider switching
- Configuration display
- Save/reload functionality
- Error handling and status displays

**Usage:**
```html
<voice-settings-panel></voice-settings-panel>
```

**Props:**
```typescript
@property({ type: Object }) host?: ClawdbotApp;
```

**Events:**
- Emits to parent when config changes
- Auto-updates on provider selection

### 2. **ProviderConfigPanel** (`provider-config-panel.ts`)

Generic provider configuration UI component that adapts to provider capabilities.

**Features:**
- Voice selection with language support
- Model selection with descriptions
- Language auto-detection or manual selection
- Speed adjustment with range slider
- Custom instructions for style/tone

**Usage:**
```html
<provider-config-panel
  providerId="tts-piper"
  providerType="tts"
  .config=${{ voice: "en_US-libritts-high", speed: 1.0 }}
  .host=${this.host}
  @config-change=${this.handleConfigChange}
></provider-config-panel>
```

**Events:**
```typescript
// Dispatched when config values change
event.detail: { key: string, value: unknown }
```

### 3. **VoiceTestInterface** (`voice-test-interface.ts`)

Component for testing TTS synthesis and STT transcription in real-time.

**Features:**
- **TTS Testing:**
  - Text input for synthesis
  - Audio playback of generated speech
  - Duration and success metrics

- **STT Testing:**
  - Microphone recording with visual indicator
  - Automatic transcription
  - Confidence scores
  - Error reporting

**Usage:**
```html
<voice-test-interface
  sttProviderId="stt-whisper-local"
  ttsProviderId="tts-piper"
  .host=${this.host}
></voice-test-interface>
```

**Permissions Required:**
- Microphone access for STT testing
- Web Audio API for audio processing

### 4. **ProviderStatusDisplay** (`provider-status-display.ts`)

Component showing provider health, resource usage, and capabilities.

**Features:**
- Health status with visual indicators (green/yellow/red)
- Resource usage (GPU, memory, CPU)
- Last checked timestamp
- Capability summary
- Warning list for degraded status

**Usage:**
```html
<provider-status-display
  providerId="stt-whisper-local"
  providerName="Whisper (Local)"
  .host=${this.host}
></provider-status-display>
```

### 5. **FallbackChainManager** (`fallback-chain-manager.ts`)

Draggable list interface for configuring provider fallback ordering.

**Features:**
- Drag-to-reorder providers
- Add/remove providers from chain
- Visual priority indicators
- Behavior explanation
- Prevention of duplicates

**Usage:**
```html
<fallback-chain-manager
  .providers=${this.providers}
  .chainProviders=${this.config.fallbackChain}
  @chain-updated=${this.handleChainUpdate}
></fallback-chain-manager>
```

**Events:**
```typescript
// Dispatched when chain order changes
event.detail: { chain: string[] }
```

## Data Flow

### Loading Configuration

```typescript
import {
  loadVoiceProviders,
  loadVoiceConfig,
  loadProviderStatus,
  loadProviderCapabilities,
} from "./controllers/voice";

// Load initial data
const providers = await loadVoiceProviders(host);
const config = await loadVoiceConfig(host);
const status = await loadProviderStatus(host, providerId);
const capabilities = await loadProviderCapabilities(host, providerId);
```

### Saving Configuration

```typescript
import { saveVoiceConfig } from "./controllers/voice";

const newConfig = {
  sttProvider: { provider: "stt-whisper-local", model: "base" },
  ttsProvider: { provider: "tts-piper", voice: "en_US-libritts-high" },
  fallbackChain: ["stt-openai-realtime"],
  enabled: true,
};

const success = await saveVoiceConfig(host, newConfig);
```

### Testing Providers

```typescript
import { testTTSProvider, testSTTProvider } from "./controllers/voice";

// Test TTS
const ttsResult = await testTTSProvider(
  host,
  "tts-piper",
  "Hello, world!",
  { voice: "en_US-libritts-high", speed: 1.0 }
);

// Test STT
const sttResult = await testSTTProvider(host, "stt-whisper-local", audioBuffer);
```

## API Endpoints

The components expect the following API endpoints on the gateway server:

### GET Endpoints

| Endpoint | Response | Description |
|----------|----------|-------------|
| `/api/voice/providers` | `GetProvidersResponse` | List all providers |
| `/api/voice/config` | `GetConfigResponse` | Get current config |
| `/api/voice/providers/:id/status` | `GetProviderStatusResponse` | Get provider status |
| `/api/voice/providers/:id/capabilities` | `GetCapabilitiesResponse` | Get provider capabilities |
| `/api/voice/health` | `VoiceSystemHealth` | System health check |
| `/api/voice/discovery` | `DiscoveryResponse` | Discover available providers |

### POST Endpoints

| Endpoint | Request | Response | Description |
|----------|---------|----------|-------------|
| `/api/voice/config` | `SetConfigRequest` | `GetConfigResponse` | Save configuration |
| `/api/voice/test-tts` | `TestTTSRequest` | `TestTTSResponse` | Test TTS synthesis |
| `/api/voice/test-stt` | FormData | `TestSTTResponse` | Test STT transcription |

## Integration Guide

### 1. Register Components in Your App

```typescript
// app.ts or main.ts
import "./views/voice-settings-panel";
import "./views/provider-config-panel";
import "./views/voice-test-interface";
import "./views/provider-status-display";
import "./views/fallback-chain-manager";
```

### 2. Add Voice Controllers

```typescript
// Add to app type
interface ClawdbotApp {
  voiceProviders?: VoiceProvider[];
  voiceConfig?: VoiceConfig;
  // ... other properties
}
```

### 3. Create Voice Settings Page

```html
<div class="voice-settings-page">
  <voice-settings-panel .host=${this.app}></voice-settings-panel>

  <!-- Optional: Detailed view -->
  <div class="provider-details">
    ${this.providers.map(
      (provider) => html`
        <div class="provider-card">
          <provider-status-display
            providerId=${provider.id}
            providerName=${provider.name}
            .host=${this.app}
          ></provider-status-display>

          <provider-config-panel
            providerId=${provider.id}
            providerType=${provider.type}
            .config=${this.getProviderConfig(provider.id)}
            .host=${this.app}
            @config-change=${this.handleConfigChange}
          ></provider-config-panel>
        </div>
      `
    )}
  </div>

  <!-- Testing section -->
  <div class="testing-section">
    <voice-test-interface
      sttProviderId=${this.config.sttProvider.provider}
      ttsProviderId=${this.config.ttsProvider.provider}
      .host=${this.app}
    ></voice-test-interface>
  </div>

  <!-- Fallback management -->
  <fallback-chain-manager
    .providers=${this.providers}
    .chainProviders=${this.config.fallbackChain}
    @chain-updated=${this.handleChainUpdate}
  ></fallback-chain-manager>
</div>
```

### 4. Handle Configuration Changes

```typescript
private async handleChainUpdate(event: CustomEvent) {
  const { chain } = event.detail;
  this.config.fallbackChain = chain;
  await saveVoiceConfig(this.host, this.config);
}

private handleConfigChange(event: CustomEvent) {
  const { key, value } = event.detail;
  const currentProvider = this.getCurrentProvider();
  if (currentProvider) {
    currentProvider.config[key] = value;
    this.requestUpdate();
  }
}
```

## Gateway Server Implementation

### Example Express Route Handler

```typescript
// src/gateway/voice-api-endpoints.ts
import { registerVoiceApi } from "./voice-api-endpoints";
import express from "express";

const app = express();

// Register voice API endpoints
const router = express.Router();
registerVoiceApi(router);
app.use(router);

// Add middleware for authentication if needed
app.use("/api/voice", (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});
```

### Setting up Plugin Registry

```typescript
import { PluginRegistry } from "../extensions/voice-call/src/plugins";
import * as STTWhisper from "../extensions/voice-call/src/providers/stt-whisper-local";
import * as TTSPiper from "../extensions/voice-call/src/providers/tts-piper";

// Register providers on startup
const registry = PluginRegistry.getInstance();

registry.registerSTT("stt-whisper-local", new STTWhisper.WhisperProvider());
registry.registerTTS("tts-piper", new TTSPiper.PiperProvider());
```

## Styling

All components use CSS custom properties for theming:

```css
:host {
  --primary-color: #3b82f6;
  --success-color: #10b981;
  --error-color: #ef4444;
  --warning-color: #f59e0b;
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --border-color: #e5e7eb;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
```

Override in your app:

```css
voice-settings-panel {
  --primary-color: #your-color;
  --bg-primary: #your-bg;
}
```

## Type Definitions

Core types are defined in `ui/src/ui/types/voice-api.ts` and `ui/src/ui/controllers/voice.ts`:

```typescript
// Provider information
interface VoiceProvider {
  id: string;
  name: string;
  type: "stt" | "tts";
  description: string;
  capabilities: string[];
  status: "available" | "unavailable" | "error";
  config?: Record<string, unknown>;
}

// Configuration
interface VoiceConfig {
  sttProvider: STTConfig;
  ttsProvider: TTSConfig;
  fallbackChain?: string[];
  enabled: boolean;
}

// Provider status with resource usage
interface ProviderStatus {
  id: string;
  available: boolean;
  healthy: boolean;
  lastChecked: number;
  resourceUsage?: {
    gpu?: boolean;
    memory?: number;
    cpu?: number;
  };
  warnings?: string[];
}
```

## Testing

Run component tests:

```bash
pnpm test ui/src/ui/views/voice-settings-panel.test.ts
```

Test coverage includes:
- Provider loading and separation
- Configuration management
- Status display
- Save functionality
- Error handling
- Fallback chain management

## Performance Considerations

1. **Lazy Loading**: Provider capabilities loaded on-demand
2. **Debouncing**: Configuration changes debounced before save
3. **Caching**: Provider status cached to reduce API calls
4. **Audio Processing**: Web Audio API for efficient audio handling

## Accessibility

- Semantic HTML with proper labels
- Keyboard navigation support
- ARIA attributes for status indicators
- Screen reader friendly descriptions

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Requires Web Audio API support

## Troubleshooting

### Components Not Rendering

Ensure all components are registered:
```typescript
import "./views/voice-settings-panel";
// ... other imports
```

### Microphone Access Denied

Users must grant microphone permission. Show a helpful prompt:
```typescript
if (!navigator.mediaDevices?.getUserMedia) {
  alert("Microphone access required for STT testing");
}
```

### API Endpoints Not Found

Verify endpoints are registered and authentication headers are correct:
```typescript
const headers = {
  Authorization: `Bearer ${sessionKey}`,
  "Content-Type": "application/json",
};
```

### Status Not Updating

Manually refresh:
```typescript
const status = await loadProviderStatus(host, providerId);
```

## Contributing

When adding new features:
1. Update type definitions in `types/voice-api.ts`
2. Add controller functions in `controllers/voice.ts`
3. Update API endpoints in `voice-api-endpoints.ts`
4. Add component tests
5. Update this documentation

## License

Same as Clawdbot project
