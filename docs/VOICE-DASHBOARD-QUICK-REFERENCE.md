# Voice Dashboard - Quick Reference Guide

## Key Files

| File | Purpose |
|------|---------|
| `/docs/voice-dashboard-ui-architecture.md` | Complete technical blueprint (450+ lines) |
| `/ui/src/ui/controllers/voice-dashboard.types.ts` | TypeScript type definitions (500+ lines) |
| `/ui/src/ui/controllers/voice-dashboard.store.ts` | Zustand state management (700+ lines) |
| `/docs/voice-dashboard-component-guide.md` | Component implementation patterns (400+ lines) |
| `/docs/voice-dashboard-api-spec.md` | API endpoint specifications (550+ lines) |

**Total:** 5 documents, 2,600+ lines of comprehensive specifications

---

## Architecture at a Glance

### Page Layout
```
Header (Title + Refresh + Settings)
├── Provider Status Board (30%)          - 7 cards, real-time
├── Control Section (35%)                - STT/TTS selectors + fallback
├── Test Panel (35%)                     - STT/TTS test interfaces
└── Metrics & Analytics (35%)            - Charts + statistics
```

### Technology Stack
- **React** - UI framework
- **TypeScript** - Strict typing
- **Zustand** - State management
- **WebSocket** - Real-time updates (10s intervals)
- **CSS Modules** - Scoped styling
- **Vitest** - Testing framework

### Key Metrics
- **Real-time Updates:** WebSocket every 10 seconds
- **Provider Latency:** 0.09s (CartesiaAI) to 2.3s (Whisper)
- **Error Rates:** 0% (ElevenLabs, Kokoro) to 2.1% (Deepgram)
- **Success Rate:** 99.8% overall

---

## Core Components (30 Total)

### Top Level
- `VoiceDashboard` - Main page container

### Status Section (30% height)
- `ProviderStatusGrid` - 3-column grid layout
- `ProviderCard` ×7 - Individual provider cards
- `StatusIndicator` - Colored health indicator
- `HealthMonitor` - WebSocket listener

### Control Section (35% height)
- `STTSelectorCard` - STT provider selector
- `TTSSelectorCard` - TTS provider selector
- `ProviderSelector` - Dropdown selector component
- `ProviderDropdown` - Menu list
- `MetricsPreview` - Inline metrics
- `FallbackChainDisplay` - Chain visualization
- `ConfigPanel` - Configuration buttons

### Test Section (35% height)
- `TestPanel` - Tab container
- `STTTestTab` - Speech-to-text test
- `TTSTestTab` - Text-to-speech test
- `AudioUploader` - Drag-drop file upload
- `TextInput` - Text for synthesis
- `AudioPlayer` - Playback controls
- `AudioWaveform` - Waveform visualization
- `ResultDisplay` - Test results
- `VoiceControls` - Speed, emotion sliders

### Metrics Section (35% height)
- `MetricsSection` - Charts container
- `LatencyChart` - Line chart (7 providers)
- `ErrorRatePie` - Pie chart breakdown
- `StatisticsBar` - Summary statistics
- `MetricsExport` - Download/export options

### UI Elements
- `SettingsPanel` - Collapsible settings
- `ErrorNotification` - Error messages
- `LoadingSpinner` - Loading state
- `RefreshButton` - Manual refresh

---

## State Management (Zustand Store)

### Store Structure
```typescript
useVoiceProviderStore: {
  // Provider data
  providers: ProviderInfo[]
  configuration: VoiceConfiguration

  // Real-time
  providerStatus: Map<string, ProviderStatus>
  lastHealthCheck: number

  // Metrics
  metrics: ProviderMetrics[]
  metricsSummary: MetricsSummary

  // Testing
  lastSTTTest: STTTestResult
  lastTTSTest: TTSTestResult

  // UI state
  selectedTab: "status" | "control" | "test" | "metrics"
  expandedProviderId: string | null
  theme: "light" | "dark"

  // Methods: 20+ actions for all operations
}
```

### Helper Hooks
- `useActiveProviders()` - Get current STT/TTS
- `useProviderStatus(id)` - Get single provider status
- `useHealthHistory(id)` - Get historical data

---

## API Endpoints (13 Total)

### Status & Info
- `GET /api/voice/status` - All provider health
- `GET /api/voice/providers` - Provider list
- `GET /api/voice/providers/:id/capabilities` - Provider details
- `GET /api/voice/health` - Service heartbeat

### Selection & Config
- `POST /api/voice/select` - Switch active provider
- `GET /api/voice/fallback-chain` - Current fallback
- `POST /api/voice/fallback-chain` - Update fallback
- `GET /api/voice/settings` - Dashboard settings
- `POST /api/voice/settings` - Update settings

### Testing
- `POST /api/voice/test/transcribe` - Test STT (multipart)
- `POST /api/voice/test/synthesize` - Test TTS (JSON)

### Metrics
- `GET /api/voice/metrics` - Historical performance
- `GET /api/voice/health-history` - Provider health timeline

### WebSocket
- `wss://host/ws/voice/updates` - Real-time updates
  - `provider-status` (every 10s)
  - `metrics` (every 60s)
  - `error` (real-time)
  - `config-update` (on change)

---

## Component Props Overview

### ProviderCard
```typescript
interface ProviderCardProps {
  provider: ProviderInfo
  status: ProviderStatus | undefined
  isActive: boolean
  isExpanded: boolean
  onExpand: (expanded: boolean) => void
  onTest: () => void
  onSwitch: () => void
  onConfigure: () => void
}
```

### ProviderSelector
```typescript
interface ProviderSelectorProps {
  type: "stt" | "tts"
  providers: ProviderInfo[]
  activeProviderId: string
  onSelect: (providerId: string) => void
  metrics?: ProviderMetrics
  status?: ProviderStatus
}
```

### AudioUploader
```typescript
interface AudioUploaderProps {
  onFileSelected: (audio: UploadedAudio) => void
  acceptedFormats: string[]
  maxSizeMb: number
  isLoading: boolean
}
```

### AudioPlayer
```typescript
interface AudioPlayerProps {
  audioUrl: string
  waveform?: WaveformData
  onPlay?: () => void
  onPause?: () => void
  onSeek?: (time: number) => void
  autoPlay?: boolean
}
```

---

## Key Features

### Real-time Monitoring
- WebSocket connection (persistent)
- 10-second update interval
- Auto-reconnect on disconnect (5s delay)
- Live health indicators

### Provider Switching
- 7 providers (4 STT + 3 TTS)
- <500ms switch time
- Fallback chain support
- Intelligent routing

### Testing Capabilities
- STT: Upload audio, get transcript + confidence
- TTS: Enter text, generate audio with controls
- Immediate results display
- Download capabilities

### Analytics
- 24h/7d/30d metrics
- Latency trends (line chart)
- Error rate breakdown (pie chart)
- Performance statistics
- Peak load analysis

---

## Quick Start Implementation

### 1. Type Safety First
```typescript
import type {
  ProviderInfo,
  ProviderStatus,
  VoiceProviderState
} from './controllers/voice-dashboard.types'
```

### 2. Initialize Store
```typescript
import { useVoiceProviderStore } from './controllers/voice-dashboard.store'

const store = useVoiceProviderStore()
store.initializeDashboard()
```

### 3. Connect to WebSocket
```typescript
useEffect(() => {
  store.connectWebSocket()
  return () => store.disconnectWebSocket()
}, [])
```

### 4. Render Components
```typescript
return (
  <VoiceDashboard>
    <ProviderStatusGrid />
    <ControlSection />
    <TestPanel />
    <MetricsSection />
  </VoiceDashboard>
)
```

---

## Data Flow Example: Provider Switching

```
User clicks "Switch" button
         ↓
   onSwitch callback
         ↓
store.setActiveSTTProvider(id)
         ↓
POST /api/voice/select
         ↓
Backend switches provider
         ↓
WebSocket broadcasts config-update
         ↓
store.handleWebSocketMessage()
         ↓
store.configuration updated
         ↓
Components subscribed to config rerender
         ↓
UI shows new active provider
```

**Time:** <500ms total

---

## Styling System

### Color Tokens
- **Healthy:** #22c55e (green)
- **Degraded:** #eab308 (yellow)
- **Error:** #ef4444 (red)
- **Active:** #3b82f6 (blue)

### Spacing (8px base)
- xs: 4px, sm: 8px, md: 16px
- lg: 24px, xl: 32px, 2xl: 48px

### Typography
- h1: 32px bold
- h2: 24px bold
- body: 14px regular
- mono: 12px monospace

### Responsive Breakpoints
- Mobile: <480px (1 column)
- Tablet: 480-1023px (2 columns)
- Desktop: 1024-1399px (3 columns)
- Wide: 1400px+ (3-4 columns)

---

## Testing Checklist

### Unit Tests
- [ ] Component rendering
- [ ] Props validation
- [ ] Event handlers
- [ ] Store actions
- [ ] Utility functions

### Integration Tests
- [ ] Component interactions
- [ ] Store and API mocking
- [ ] Data flow through store
- [ ] Error handling

### E2E Tests
- [ ] Full dashboard flow
- [ ] Provider switching
- [ ] Test execution
- [ ] Chart interactions
- [ ] Mobile responsiveness

### Performance Tests
- [ ] WebSocket update latency <100ms
- [ ] Component render <50ms
- [ ] Chart render <200ms
- [ ] Memory usage <100MB

### Accessibility Tests
- [ ] WCAG 2.1 AA compliance
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Color contrast (4.5:1)

---

## Common Issues & Solutions

### Issue: WebSocket Not Connecting
```
Check: Token validity, CORS headers, WSS vs WS
Fix: connectWebSocket() in useEffect, handle reconnection
```

### Issue: Memory Leak with WebSocket
```
Check: Cleanup function in useEffect
Fix: disconnectWebSocket() in cleanup
```

### Issue: Slow Provider Status Updates
```
Check: Update frequency, store subscription overhead
Fix: Use selector in Zustand, debounce renders
```

### Issue: Chart Not Rendering
```
Check: Empty metrics array, NaN values
Fix: Validate metrics before rendering, add loading state
```

### Issue: Audio Upload Failing
```
Check: File type, size, format
Fix: Validate before upload, show user-friendly errors
```

---

## Performance Optimization Tips

1. **Memoization**
   ```typescript
   const MemoCard = React.memo(ProviderCard, (prev, next) => {
     return prev.provider.id === next.provider.id
   })
   ```

2. **useCallback for Handlers**
   ```typescript
   const handleClick = useCallback(() => {
     // implementation
   }, [deps])
   ```

3. **Lazy Load Charts**
   ```typescript
   const Chart = React.lazy(() => import('./Chart'))
   ```

4. **Debounce Settings Updates**
   ```typescript
   const debouncedUpdate = debounce(updateSettings, 1000)
   ```

5. **Virtual Scrolling for Large Lists**
   ```typescript
   <FixedSizeList height={600} itemCount={1000} />
   ```

---

## Accessibility Features

- ✅ Keyboard navigation (Tab, Shift+Tab, Enter, Esc)
- ✅ Screen reader support (aria-label, role)
- ✅ Live regions for updates
- ✅ Color contrast ratios (4.5:1)
- ✅ Focus indicators visible
- ✅ Form labels properly linked
- ✅ WCAG 2.1 AA target

---

## Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 90+ | ✅ Full |
| Firefox | 88+ | ✅ Full |
| Safari | 14+ | ✅ Full |
| Edge | 90+ | ✅ Full |
| Mobile Safari | 14+ | ✅ Full |
| Chrome Mobile | 90+ | ✅ Full |

**Requirements:** WebSocket support, ES2020+ JavaScript

---

## Security Best Practices

1. **Authentication:** Bearer token required
2. **Validation:** File size, type, and content checks
3. **Rate Limiting:** 1000 req/min, 5 WS connections
4. **HTTPS Only:** WSS in production
5. **Error Messages:** Sanitized before display
6. **CORS:** Configured for your domain
7. **CSRF:** Token-based auth

---

## Deployment Checklist

- [ ] Backend endpoints implemented
- [ ] WebSocket server ready
- [ ] Frontend components built
- [ ] Store integrated
- [ ] API client configured
- [ ] Error handling working
- [ ] Performance optimized
- [ ] Accessibility tested
- [ ] Mobile responsive
- [ ] Dark/light mode working
- [ ] Tests passing (>80% coverage)
- [ ] Staging deployment tested
- [ ] Production deployment ready
- [ ] Monitoring configured
- [ ] Documentation updated

---

## Getting Started

1. **Read Architecture:** Start with `voice-dashboard-ui-architecture.md`
2. **Understand Types:** Review `voice-dashboard.types.ts`
3. **Study Store:** Review `voice-dashboard.store.ts` implementation
4. **Build Components:** Use `voice-dashboard-component-guide.md` patterns
5. **Implement API:** Follow `voice-dashboard-api-spec.md`
6. **Test:** Unit + integration + E2E tests
7. **Deploy:** Staging then production

---

## Document Navigation

```
📁 docs/
├── VOICE-DASHBOARD-IMPLEMENTATION-SUMMARY.md (this file's overview)
├── voice-dashboard-ui-architecture.md (complete blueprint)
├── voice-dashboard-component-guide.md (implementation patterns)
├── voice-dashboard-api-spec.md (API endpoints)
└── VOICE-DASHBOARD-QUICK-REFERENCE.md (quick lookup - you are here)

📁 ui/src/ui/
├── controllers/
│   ├── voice-dashboard.types.ts (TypeScript interfaces)
│   ├── voice-dashboard.store.ts (Zustand state)
│   └── voice.ts (existing controller)
├── components/
│   └── voice-dashboard/
│       ├── ProviderStatusSection/
│       ├── ControlSection/
│       ├── TestPanel/
│       ├── MetricsSection/
│       └── SettingsPanel/
└── hooks/
    ├── useVoiceProviderStore.ts
    ├── useHealthMonitor.ts
    ├── useAudioUpload.ts
    └── useAudioPlayback.ts
```

---

## Success Metrics

✅ All 7 providers visible in real-time
✅ Provider switching <500ms
✅ Test results instant
✅ Metrics update every 10s
✅ Mobile responsive
✅ WebSocket stable
✅ No memory leaks
✅ WCAG 2.1 AA compliant
✅ Dark/light mode
✅ <3s initial load
✅ 80%+ test coverage

---

**Last Updated:** January 16, 2025
**Version:** 1.0.0
**Status:** Ready for Implementation
