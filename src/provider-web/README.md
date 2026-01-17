# Voice Provider Management Dashboard

A comprehensive React dashboard for managing and monitoring STT (Speech-To-Text) and TTS (Text-To-Speech) voice providers with real-time health monitoring, performance metrics, and testing capabilities.

## Features

### Core Capabilities

- **Real-time Provider Monitoring**: Live status updates via WebSocket for all voice providers
- **Provider Management**: Switch between STT and TTS providers with fallback chain configuration
- **Voice Testing**: Built-in testing interface for both STT transcription and TTS synthesis
- **Performance Analytics**: Detailed metrics including latency, error rates, and success rates
- **Health Monitoring**: System-wide health tracking with resource usage monitoring
- **Configuration Management**: Customizable settings for health checks, concurrency, and logging

### Components

#### VoiceDashboard
The main dashboard component that orchestrates all sub-components and manages the overall user interface.

**Features:**
- Tab-based navigation (Overview, Test, Metrics, Settings)
- Real-time provider status cards
- Error handling and loading states
- Responsive design

**Usage:**
```tsx
import { VoiceDashboard } from './components/voice';

export default function App() {
  return <VoiceDashboard />;
}
```

#### ProviderStatusCard
Displays real-time status and metrics for individual voice providers.

**Props:**
- `provider`: VoiceProvider - Provider information
- `healthStatus`: ApiProviderStatus - Current health status
- `metrics`: ProviderMetrics - Performance metrics
- `isActive`: boolean - Whether this provider is currently active
- `onQuickTest`: () => void - Callback for quick test button
- `onSwitch`: () => void - Callback for switching to this provider

**Features:**
- Real-time status indicator with color coding
- Latency badge with trend indicators
- Error rate display
- Quick action buttons (Test, Switch, Settings)
- Hover tooltips with detailed metrics

#### ProviderSelector
Component for selecting and configuring STT and TTS providers.

**Props:**
- `onSTTChange`: (providerId: string) => void
- `onTTSChange`: (providerId: string) => void
- `onFallbackChainUpdate`: (chain: string[]) => void

**Features:**
- Separate selectors for STT and TTS
- Visual fallback chain representation
- Performance comparison preview
- Language support indicators

#### VoiceTestPanel
Provides testing interface for both STT and TTS functionality.

**Features:**

**STT Test Tab:**
- Drag-and-drop audio file upload
- Language selection
- Real-time transcription results
- Confidence score display
- Audio waveform visualization

**TTS Test Tab:**
- Text input with character counter
- Voice selector
- Speed and pitch controls
- Language selection
- Audio player with download option
- Real-time synthesis results

#### MetricsDisplay
Comprehensive metrics visualization and analysis.

**Features:**
- Latency trend charts (24h timeline)
- Error rate pie charts
- Statistical summaries (avg, min, max, p95)
- Provider comparison table
- Time range selection (1h, 24h, 7d)
- Configurable refresh intervals
- Metrics export functionality

#### HealthMonitor
Real-time system health monitoring with WebSocket integration.

**Features:**
- Connection status indicator
- Overall health percentage
- Individual provider health details
- Resource usage monitoring
- Warning and error display
- Expandable details view

#### VoiceSettings
Configuration management for voice provider system.

**Features:**
- Health check interval slider
- Max concurrent sessions selector
- Fallback behavior toggle
- Logging level selection
- Settings persistence
- Reset to defaults

### Store (Zustand)

Centralized state management using Zustand with the following structure:

```typescript
interface VoiceStore {
  // State
  providers: ApiVoiceProvider[];
  activeSTT: string | null;
  activeTTS: string | null;
  config: ApiVoiceConfig | null;
  healthStatus: Record<string, ApiProviderStatus>;
  metrics: ProviderMetrics[];
  testResult: TestResult | null;
  loading: boolean;
  error: string | null;
  wsConnected: boolean;

  // Actions
  setProviders(providers: ApiVoiceProvider[]): void;
  setActiveSTT(id: string): void;
  setActiveTTS(id: string): void;
  setConfig(config: ApiVoiceConfig): void;
  updateHealthStatus(status: ApiProviderStatus): void;
  updateMetrics(metrics: ProviderMetrics[]): void;
  setTestResult(result: TestResult | null): void;
  setLoading(loading: boolean): void;
  setError(error: string | null): void;
  setWSConnected(connected: boolean): void;
  reset(): void;
}
```

### Hooks

#### useVoiceProviders
Fetches and initializes voice providers on component mount.

```typescript
const { refetch } = useVoiceProviders();
```

#### useProviderMetrics
Collects and updates provider metrics at specified intervals.

```typescript
const { refresh } = useProviderMetrics(10000); // 10s interval
```

#### useHealthStatus
Manages WebSocket connection for real-time health updates.

```typescript
useHealthStatus();
```

#### useVoiceTest
Handles STT and TTS testing with loading and error states.

```typescript
const { testSTT, testTTS, loading, error } = useVoiceTest({
  onSuccess: (result) => console.log(result),
  onError: (error) => console.error(error),
});
```

### API Integration

The dashboard communicates with the backend through a set of well-defined API endpoints:

**Endpoints:**
- `GET /api/voice/providers` - Get all providers
- `GET /api/voice/providers/:id/status` - Get provider status
- `GET /api/voice/providers/:id/capabilities` - Get capabilities
- `GET /api/voice/config` - Get voice configuration
- `POST /api/voice/config` - Update voice configuration
- `POST /api/voice/test-stt` - Test STT
- `POST /api/voice/test-tts` - Test TTS
- `GET /api/voice/health` - Get system health
- `WS /api/voice/health-stream` - WebSocket for health updates

## Styling

The dashboard includes comprehensive CSS with:

- **Responsive Design**: Mobile-first approach with breakpoints at 768px and 480px
- **Dark Mode Support**: CSS custom properties for theme switching
- **Accessibility**: Proper color contrast ratios and semantic HTML
- **Animations**: Smooth transitions and micro-interactions
- **Component Styles**: Self-contained component styling

### CSS Architecture

- CSS custom properties for colors, spacing, and shadows
- Mobile-first responsive design
- Dark mode support via `prefers-color-scheme`
- Consistent spacing and typography
- Smooth transitions and animations

## Usage Example

```typescript
import React from 'react';
import { VoiceDashboard } from './components/voice';
import './styles/voice-dashboard.css';

export default function VoiceApp() {
  return (
    <div className="app">
      <VoiceDashboard />
    </div>
  );
}
```

## Performance Targets

- **Initial Load**: <1 second
- **Metric Updates**: <100ms
- **Provider Switching**: <500ms
- **Test Execution**: <2 seconds
- **WebSocket Latency**: <50ms

## Testing

Comprehensive test suite included covering:

- Component rendering
- Provider status display
- Provider selection and switching
- STT/TTS testing functionality
- Metrics display and export
- Health monitoring
- Settings management
- Tab navigation
- Error handling
- Responsive design
- Performance benchmarks
- Accessibility

**Run tests:**
```bash
pnpm test src/provider-web/components/voice/__tests__/VoiceDashboard.test.tsx
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android)

## Accessibility

The dashboard implements:

- Semantic HTML structure
- Keyboard navigation support
- ARIA labels and roles
- Sufficient color contrast (WCAG AA)
- Focus indicators
- Screen reader support

## Responsive Breakpoints

- **Desktop**: 1024px+ (3-column grid)
- **Tablet**: 768px-1023px (2-column grid)
- **Mobile**: <768px (1-column, stacked layout)

## Future Enhancements

- [ ] Custom metric visualizations
- [ ] Provider-specific configuration UI
- [ ] Advanced filtering and search
- [ ] Custom alerts and notifications
- [ ] Batch operations on providers
- [ ] Historical data retention
- [ ] Provider comparison reports
- [ ] Custom dashboard layouts
- [ ] Integration with monitoring systems
- [ ] Webhook support for events

## File Structure

```
src/provider-web/
├── api/
│   └── voice-api.ts              # API integration
├── components/
│   └── voice/
│       ├── VoiceDashboard.tsx     # Main dashboard
│       ├── ProviderStatusCard.tsx # Status card
│       ├── ProviderSelector.tsx   # Provider selection
│       ├── VoiceTestPanel.tsx     # Test interface
│       ├── MetricsDisplay.tsx     # Metrics visualization
│       ├── HealthMonitor.tsx      # Health monitoring
│       ├── VoiceSettings.tsx      # Settings management
│       ├── index.ts               # Component exports
│       └── __tests__/
│           └── VoiceDashboard.test.tsx
├── hooks/
│   ├── useVoiceProviders.ts
│   ├── useProviderMetrics.ts
│   ├── useHealthStatus.ts
│   └── useVoiceTest.ts
├── store/
│   └── voice-store.ts             # Zustand store
├── styles/
│   └── voice-dashboard.css        # Styling
└── README.md                       # This file
```

## Dependencies

- React 18+
- Zustand 4+ (State management)
- TypeScript 5+ (Type safety)

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Type Checking

```bash
pnpm build
```

### Linting

```bash
pnpm lint
pnpm format
```

## Contributing

When contributing to the Voice Provider Dashboard:

1. Follow the existing code style and patterns
2. Ensure all tests pass
3. Add tests for new functionality
4. Update documentation as needed
5. Keep components focused and reusable

## License

Part of the Clawdbot project. See LICENSE for details.
