# Voice Provider Management Components - Complete Package

A comprehensive set of web UI components for managing voice providers in Clawdbot. Built with Lit and TypeScript, these production-ready components provide enterprise-grade voice provider configuration, testing, and monitoring.

## Package Contents

### Core Components

1. **VoiceSettingsPanel** - Main settings container
   - File: `ui/src/ui/views/voice-settings-panel.ts`
   - Provider selection and configuration
   - Status display and save functionality

2. **ProviderConfigPanel** - Generic provider configuration
   - File: `ui/src/ui/views/provider-config-panel.ts`
   - Voice/model/language selection
   - Speed adjustment
   - Custom instructions

3. **VoiceTestInterface** - Testing tool for TTS/STT
   - File: `ui/src/ui/views/voice-test-interface.ts`
   - Text synthesis with audio playback
   - Microphone recording for transcription
   - Real-time result display

4. **ProviderStatusDisplay** - Health and resource monitoring
   - File: `ui/src/ui/views/provider-status-display.ts`
   - Provider status indicators
   - Resource usage (GPU, memory, CPU)
   - Capability summary

5. **FallbackChainManager** - Failover configuration
   - File: `ui/src/ui/views/fallback-chain-manager.ts`
   - Drag-to-reorder providers
   - Add/remove from chain
   - Priority management

### Data Layer

- **Controllers** - API integration layer
  - File: `ui/src/ui/controllers/voice.ts`
  - Provider loading and capabilities
  - Configuration management
  - Testing and status functions

- **Types** - TypeScript definitions
  - File: `ui/src/ui/types/voice-api.ts`
  - API endpoint types
  - Request/response structures
  - Error definitions

### Server Implementation

- **API Endpoints** - Gateway server routes
  - File: `src/gateway/voice-api-endpoints.ts`
  - Example implementation
  - All required endpoints
  - Error handling

### Documentation & Examples

- **Integration Guide** - `ui/VOICE_COMPONENTS_INTEGRATION.md`
  - Component overview
  - Data flow
  - API reference
  - Integration instructions

- **Complete Example** - `ui/src/ui/views/voice-settings-example.ts`
  - Full page implementation
  - Tabbed interface
  - All components integrated
  - Production-ready

- **Tests** - `ui/src/ui/views/voice-settings-panel.test.ts`
  - Unit tests for components
  - Data loading tests
  - Configuration management
  - Error handling

## Quick Start

### 1. Copy Files to Your Project

```bash
# Components
cp ui/src/ui/views/voice-*.ts /your/project/ui/src/ui/views/
cp ui/src/ui/views/provider-*.ts /your/project/ui/src/ui/views/
cp ui/src/ui/views/fallback-*.ts /your/project/ui/src/ui/views/

# Controllers
cp ui/src/ui/controllers/voice.ts /your/project/ui/src/ui/controllers/

# Types
cp ui/src/ui/types/voice-api.ts /your/project/ui/src/ui/types/

# Server implementation (optional)
cp src/gateway/voice-api-endpoints.ts /your/project/src/gateway/
```

### 2. Register Components

```typescript
// In your main app file
import "./views/voice-settings-panel";
import "./views/provider-config-panel";
import "./views/voice-test-interface";
import "./views/provider-status-display";
import "./views/fallback-chain-manager";
```

### 3. Implement API Endpoints

```typescript
// In your Express app
import { registerVoiceApi } from "./voice-api-endpoints";

const router = express.Router();
registerVoiceApi(router);
app.use(router);
```

### 4. Create Your UI

```html
<!-- Use individual components -->
<voice-settings-panel .host=${this.app}></voice-settings-panel>

<!-- Or use the complete example -->
<voice-settings-page .host=${this.app}></voice-settings-page>
```

## Component Hierarchy

```
VoiceSettingsPage (complete page)
├── VoiceSettingsPanel (main settings)
│   ├── ProviderStatusDisplay (STT status)
│   ├── ProviderStatusDisplay (TTS status)
│   └── [Status indicators]
├── ProviderConfigPanel (STT config)
├── ProviderConfigPanel (TTS config)
├── VoiceTestInterface (TTS/STT testing)
│   ├── [TTS synthesis]
│   └── [STT recording]
└── FallbackChainManager (fallback chain)
```

## API Reference

### Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/voice/providers` | List all providers |
| GET | `/api/voice/config` | Get current config |
| POST | `/api/voice/config` | Save configuration |
| GET | `/api/voice/providers/:id/status` | Provider status |
| GET | `/api/voice/providers/:id/capabilities` | Provider capabilities |
| POST | `/api/voice/test-tts` | Test TTS |
| POST | `/api/voice/test-stt` | Test STT |
| GET | `/api/voice/health` | System health |

### Data Types

```typescript
// Provider information
interface VoiceProvider {
  id: string;
  name: string;
  type: "stt" | "tts";
  description: string;
  capabilities: string[];
  status: "available" | "unavailable" | "error";
}

// Configuration
interface VoiceConfig {
  sttProvider: { provider: string; config?: Record<string, unknown> };
  ttsProvider: { provider: string; config?: Record<string, unknown> };
  fallbackChain?: string[];
  enabled: boolean;
}

// Status
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

## Usage Examples

### Load Configuration

```typescript
import { loadVoiceConfig } from "./controllers/voice";

const config = await loadVoiceConfig(host);
console.log(config.sttProvider.provider); // "stt-whisper-local"
```

### Save Configuration

```typescript
import { saveVoiceConfig } from "./controllers/voice";

const newConfig = {
  sttProvider: { provider: "stt-whisper-local" },
  ttsProvider: { provider: "tts-piper" },
  enabled: true,
};

await saveVoiceConfig(host, newConfig);
```

### Test Providers

```typescript
import { testTTSProvider, testSTTProvider } from "./controllers/voice";

// Test TTS
const result = await testTTSProvider(host, "tts-piper", "Hello world");
if (result.success) {
  console.log(`Duration: ${result.duration}ms`);
  // Audio available in result.audio
}

// Test STT
const sttResult = await testSTTProvider(host, "stt-whisper-local", audioBuffer);
if (sttResult.success) {
  console.log(`Transcript: ${sttResult.transcript}`);
}
```

### Monitor Provider Status

```typescript
import { loadProviderStatus } from "./controllers/voice";

const status = await loadProviderStatus(host, "stt-whisper-local");
console.log(`Healthy: ${status.healthy}`);
console.log(`GPU: ${status.resourceUsage?.gpu}`);
console.log(`Memory: ${status.resourceUsage?.memory}MB`);
```

## Features

### Provider Management
- ✅ Discover available providers
- ✅ Switch STT/TTS providers
- ✅ Save provider configuration
- ✅ Per-provider settings (voices, models, languages)
- ✅ Provider-specific capabilities

### Testing Interface
- ✅ TTS synthesis with audio playback
- ✅ STT recording with transcription
- ✅ Real-time performance metrics
- ✅ Error reporting
- ✅ Duration tracking

### Status Monitoring
- ✅ Provider health indicators
- ✅ Resource usage monitoring (GPU, memory, CPU)
- ✅ Warning display
- ✅ Last check timestamp
- ✅ Capability summary

### Fallback Management
- ✅ Drag-to-reorder providers
- ✅ Add/remove from chain
- ✅ Visual priority indicators
- ✅ Duplicate prevention
- ✅ Behavior documentation

### UI/UX
- ✅ Responsive design
- ✅ Dark/light theme support
- ✅ Loading states
- ✅ Error messages
- ✅ Success notifications
- ✅ Accessibility (ARIA, keyboard nav)

## Architecture

### Three-Tier Architecture

```
┌─────────────────────────────────────┐
│     React/Lit Components            │ ← UI Layer
│  (voice-settings-panel, etc.)       │
└──────────────────┬──────────────────┘
                   │
┌──────────────────▼──────────────────┐
│      Controllers (voice.ts)         │ ← API Client
│  (loadVoiceConfig, testTTS, etc.)   │
└──────────────────┬──────────────────┘
                   │
┌──────────────────▼──────────────────┐
│    Express API Endpoints            │ ← Server
│  (/api/voice/*)                     │
└─────────────────────────────────────┘
```

### Data Flow

```
User Action
    ↓
Component Event Handler
    ↓
Controller Function (API Call)
    ↓
Express Endpoint
    ↓
Plugin Registry / Provider Logic
    ↓
Response → Controller → Component Update
```

## Styling

All components use CSS custom properties for consistent theming:

```css
/* Primary Colors */
--primary-color: #3b82f6;
--success-color: #10b981;
--error-color: #ef4444;
--warning-color: #f59e0b;

/* Backgrounds */
--bg-primary: #ffffff;
--bg-secondary: #f9fafb;

/* Text */
--text-primary: #111827;
--text-secondary: #6b7280;

/* Borders */
--border-color: #e5e7eb;
--shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
```

Override in your app:

```css
voice-settings-panel {
  --primary-color: #your-brand-color;
  --bg-primary: #your-bg-color;
}
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Requires Web Audio API for STT testing

## Performance

- Lazy loading of provider capabilities
- Debounced configuration saves
- Cached provider status
- Efficient audio processing
- Minimal re-renders

## Security Considerations

- ✅ Authorization headers on all API calls
- ✅ CORS-safe implementation
- ✅ Input validation
- ✅ Error message sanitization
- ✅ No hardcoded credentials
- ✅ Microphone access only on user request

## Testing

Run tests:

```bash
pnpm test ui/src/ui/views/voice-settings-panel.test.ts
```

Test coverage:
- ✅ Component rendering
- ✅ Data loading
- ✅ Configuration management
- ✅ Status display
- ✅ Error handling
- ✅ Save functionality

## Troubleshooting

### Components not rendering
- Ensure all imports are registered
- Check browser console for errors
- Verify host object is passed correctly

### API endpoints not found
- Check endpoint URLs
- Verify authorization headers
- Check server logs

### Microphone access denied
- Show permission prompt to user
- Check browser permissions
- Verify HTTPS/localhost

### Performance issues
- Check network tab for slow requests
- Monitor component re-renders
- Profile with browser DevTools

## File Structure

```
clawdbot/
├── ui/
│   ├── src/
│   │   └── ui/
│   │       ├── views/
│   │       │   ├── voice-settings-panel.ts
│   │       │   ├── voice-settings-panel.test.ts
│   │       │   ├── provider-config-panel.ts
│   │       │   ├── voice-test-interface.ts
│   │       │   ├── provider-status-display.ts
│   │       │   ├── fallback-chain-manager.ts
│   │       │   └── voice-settings-example.ts
│   │       ├── controllers/
│   │       │   └── voice.ts
│   │       └── types/
│   │           └── voice-api.ts
│   └── VOICE_COMPONENTS_INTEGRATION.md
└── src/
    └── gateway/
        └── voice-api-endpoints.ts
```

## Contributing

When adding new features:

1. Add component in `ui/src/ui/views/`
2. Add controller function in `ui/src/ui/controllers/voice.ts`
3. Add types in `ui/src/ui/types/voice-api.ts`
4. Implement endpoint in `src/gateway/voice-api-endpoints.ts`
5. Add tests
6. Update documentation

## Support & Issues

For issues or questions:
- Check troubleshooting section
- Review integration guide
- Check component JSDoc comments
- Inspect browser console for errors

## License

Same as Clawdbot project

---

## Next Steps

1. **Copy files** to your project
2. **Register components** in your app
3. **Implement API endpoints** on server
4. **Integrate with your UI** following the example
5. **Test components** with real providers
6. **Deploy** with confidence

## Additional Resources

- Voice Plugin Interfaces: `extensions/voice-call/src/plugins/interfaces.ts`
- Provider Implementations: `extensions/voice-call/src/providers/`
- Voice Configuration: `extensions/voice-call/src/config.ts`

---

**Created:** January 16, 2026
**Version:** 1.0.0
**Status:** Production-Ready
