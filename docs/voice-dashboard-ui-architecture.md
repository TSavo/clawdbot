# Voice Provider Dashboard UI Architecture

## Overview

The voice provider dashboard (`/dashboard/voice`) is the central management interface for monitoring, controlling, and testing all 7 voice providers (4 STT + 3 TTS). This document defines the complete UI architecture, component hierarchy, data flow, and implementation patterns.

**Key objectives:**
- Real-time provider status monitoring with WebSocket updates
- Intuitive provider switching with instant latency feedback
- Built-in testing interface for STT and TTS providers
- Performance metrics and analytics visualization
- Responsive design (mobile, tablet, desktop)
- Dark/light mode support
- WCAG 2.1 AA accessibility

## Page Layout & Sections

### Section 1: Provider Status Board (30% height)
**Location:** Top of dashboard
**Purpose:** Quick visual health check of all providers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PROVIDER STATUS BOARD                              │
├────────────────────┬────────────────────┬────────────────────┐          │
│  Whisper (STT)     │ Faster-Whisper     │ Deepgram (STT)     │          │
│  Status: 🟢        │ Status: 🟢         │ Status: 🟡        │          │
│  Mode: System      │ Mode: GPU          │ Mode: Cloud       │          │
│  Latency: 2.3s     │ Latency: 0.8s      │ Latency: 0.2s     │          │
│  Error: 0.2%       │ Error: 0.1%        │ Error: 2.1%       │          │
│  [Test][Switch]    │ [Test][Switch]     │ [Test][Switch]    │          │
└────────────────────┴────────────────────┴────────────────────┘          │
├────────────────────┬────────────────────┬────────────────────┐          │
│ Kokoro (TTS)       │ ElevenLabs (TTS)   │ CartesiaAI (TTS)   │          │
│ Status: 🟢         │ Status: 🟢         │ Status: 🟢         │          │
│ Mode: System       │ Mode: Cloud        │ Mode: Cloud       │          │
│ Latency: 0.3s      │ Latency: 0.1s      │ Latency: 0.09s    │          │
│ Error: 0.0%        │ Error: 0.0%        │ Error: 0.0%       │          │
│ [Test][Settings]   │ [Test][Settings]   │ [Test][Settings]  │          │
└────────────────────┴────────────────────┴────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Section 2: Provider Control Panel (35% height)
**Location:** Middle-left section
**Purpose:** Select and configure active STT/TTS providers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROVIDER CONTROL PANEL                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ STT Provider Selection                                                  │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ Faster-Whisper (GPU)  [⌄ Open menu]          [Active] [Configure]  │ │
│ │                                                                     │
│ │ Metrics:                                                            │ │
│ │  • Avg Latency: 0.8s        • Success Rate: 99.9%                 │ │
│ │  • Max Concurrent: 8        • Model: base                          │ │
│ │                                                                     │ │
│ │ Fallback Chain:  Faster-Whisper → Whisper → Deepgram             │ │
│ │ [+ Add Provider] [Clear Chain]                                    │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ TTS Provider Selection                                                  │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ ElevenLabs (Cloud)  [⌄ Open menu]           [Active] [Configure]   │ │
│ │                                                                     │
│ │ Metrics:                                                            │
│ │  • Avg Latency: 0.1s        • Success Rate: 100%                  │ │
│ │  • Max Concurrent: 32       • Voice: Aria                         │ │
│ │                                                                     │
│ │ Fallback Chain:  ElevenLabs → CartesiaAI → Kokoro                │ │
│ │ [+ Add Provider] [Clear Chain]                                    │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Section 3: Test Panel (35% height)
**Location:** Middle-right section
**Purpose:** Real-time testing of STT and TTS providers

**STT Test Tab:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Test Transcription]  [Test Synthesis]                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Audio Input:                                                            │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ Drag audio file here or [Choose File]                             │ │
│ │                                                                   │ │
│ │ Supported: .wav, .mp3, .ogg, .flac, .m4a                        │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ Options:                                                                │
│ Language: [Auto-detect ⌄]  Provider: [Active STT ⌄]                  │
│                                                                         │
│ [Run Test]  [Clear]                                                    │
│                                                                         │
│ Result:                                                                 │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ ✓ Success                                                         │ │
│ │                                                                   │ │
│ │ Transcription:                                                    │ │
│ │ "Hello, this is a test. Testing voice transcription."           │ │
│ │                                                                   │ │
│ │ Confidence: 92%     │ Duration: 2.34s   │ Latency: 0.8s         │ │
│ │ Provider: Faster-Whisper                                         │ │
│ │                                                                   │ │
│ │ [Copy] [Download] [Play Original]                               │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**TTS Test Tab:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Test Transcription]  [Test Synthesis]                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Text Input:                                                             │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ Type text here or paste from clipboard...                        │ │
│ │                                                                   │ │
│ │ Hello, this is a test of the text to speech provider. It        │ │
│ │ demonstrates how the voice sounds with natural inflection.      │ │
│ │                                                                   │ │
│ │ Character count: 145/5000                                        │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ Options:                                                                │
│ Voice: [Aria ⌄]  Language: [English ⌄]  Provider: [Active TTS ⌄]     │
│ Speed: [1.0x ─●───────────────────── 2.0x]                            │
│ Emotion: [Neutral ⌄]                                                  │
│                                                                         │
│ [Generate Audio]  [Clear]                                              │
│                                                                         │
│ Result:                                                                 │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ ✓ Success                                                         │ │
│ │                                                                   │ │
│ │ [▶ Play]  [⏸ Pause]  [⏹ Stop]                                   │ │
│ │ ─────────●────────────────── 1.23s / 2.45s                     │ │
│ │                                                                   │ │
│ │ Audio Waveform:                                                 │ │
│ │ [████████████████████▌░░░░░░░░░░░░░░░░░░░░░░]                 │ │
│ │                                                                   │ │
│ │ Duration: 2.45s     │ Latency: 0.15s    │ Provider: ElevenLabs  │ │
│ │ Format: MP3 (128kbps)  │ Sample Rate: 24kHz                     │ │
│ │                                                                   │ │
│ │ [Play Again] [Download WAV] [Copy Audio URL] [Regenerate]       │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Section 4: Metrics & Analytics (35% height)
**Location:** Bottom section
**Purpose:** Historical performance analysis and statistics

```
┌────────────────────────────────────────┬────────────────────────────────┐
│ LATENCY PERFORMANCE (24H)             │ ERROR RATE BY PROVIDER         │
│                                        │                                │
│ 2.5s ┐                                │ Whisper         ████ 0.2%     │
│      │     ╱╲           ╱╲            │ Faster-Whisper  ██ 0.1%       │
│ 2.0s ┤    ╱  ╲         ╱  ╲           │ Deepgram        ████████ 2.1% │
│      │   ╱    ╲       ╱    ╲          │ Kokoro          ░ 0.0%        │
│ 1.5s ┤  ╱      ╲     ╱      ╲         │ ElevenLabs      ░ 0.0%        │
│      │ ╱        ╲   ╱        ╲        │ CartesiaAI      ░ 0.0%        │
│ 1.0s ┤          ╲ ╱          ╲        │                                │
│      │                        ╲       │ [Click to drill down]           │
│ 0.5s ┤                         ╲      │                                │
│      │                                │                                │
│ 0.0s └────────────────────────────────│                                │
│      0h    6h    12h    18h    24h   │                                │
│                                        │                                │
│ [◉ Whisper ○ Faster-W. ◉ Deepgram]  │                                │
│ [◉ Kokoro ◉ ElevenLabs ◉ CartesiaAI]│                                │
│                                        │                                │
└────────────────────────────────────────┴────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ STATISTICS SUMMARY                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Total Requests: 45,234  │ Success Rate: 99.8%  │ Avg Latency: 234ms  │
│                                                                         │
│ Top Provider (Speed): CartesiaAI (89ms)    │ Top Provider (Accuracy): │
│ Deepgram (99.2%)                                                       │
│                                                                         │
│ Peak Load Time: 14:32 (3,421 req/min)     │ Lowest Error Rate:       │
│ Kokoro & ElevenLabs (0.0%)                                             │
│                                                                         │
│ [Export Data]  [View Full Report]  [Refresh]                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```typescript
VoiceDashboard (main container)
├── Header
│   ├── Title "Voice Provider Dashboard"
│   ├── RefreshButton (manual + auto-refresh control)
│   └── SettingsButton (global settings)
│
├── ProviderStatusSection (30% height)
│   ├── ProviderStatusGrid (responsive 3-col grid)
│   │   ├── ProviderCard (×7)
│   │   │   ├── StatusIndicator (colored dot + label)
│   │   │   ├── ProviderInfo (name, type, mode)
│   │   │   ├── MetricsDisplay
│   │   │   │   ├── LatencyBadge
│   │   │   │   ├── ErrorRateBadge
│   │   │   │   └── LastCheckTime
│   │   │   └── ActionButtons
│   │   │       ├── QuickTestButton
│   │   │       ├── SwitchButton
│   │   │       └── SettingsButton
│   │   └── HealthMonitor (WebSocket listener)
│   │
│   └── RefreshControl
│       ├── ManualRefreshButton
│       ├── AutoRefreshToggle (10s default)
│       └── RefreshStatus
│
├── ControlSection (35% height)
│   ├── STTSelectorCard
│   │   ├── ProviderDropdown
│   │   │   ├── ProviderListItem (×N)
│   │   │   │   ├── ProviderName + Mode
│   │   │   │   ├── CurrentLatency
│   │   │   │   ├── HealthStatus
│   │   │   │   └── ModelInfo
│   │   │   └── SearchFilter
│   │   ├── MetricsPreview (inline)
│   │   ├── FallbackChainDisplay
│   │   │   ├── ChainVisualization
│   │   │   ├── AddButton
│   │   │   └── RemoveButton
│   │   └── ConfigButton
│   │
│   └── TTSSelectorCard (same structure as STT)
│
├── TestPanel (35% height)
│   ├── TabNavigation
│   │   ├── STTTestTab (active/inactive)
│   │   └── TTSTestTab (active/inactive)
│   │
│   ├── STTTestContainer
│   │   ├── AudioUploader
│   │   │   ├── DragDropZone
│   │   │   ├── FileInput
│   │   │   └── FilePreview
│   │   ├── LanguageSelector
│   │   ├── ProviderSelector
│   │   ├── TestButton (loading state)
│   │   ├── ResultDisplay
│   │   │   ├── StatusBadge (success/error)
│   │   │   ├── TranscriptionText
│   │   │   ├── ConfidenceScore
│   │   │   ├── MetricsRow
│   │   │   └── ActionButtons
│   │   └── AudioWaveformViewer
│   │
│   └── TTSTestContainer
│       ├── TextInput (textarea with char counter)
│       ├── VoiceSelector
│       ├── LanguageSelector
│       ├── ProviderSelector
│       ├── VoiceControls
│       │   ├── SpeedSlider
│       │   └── EmotionSelector
│       ├── GenerateButton (loading state)
│       ├── AudioPlayer
│       │   ├── PlayButton
│       │   ├── PauseButton
│       │   ├── ProgressBar
│       │   ├── TimeDisplay (current/total)
│       │   └── VolumeControl
│       ├── AudioWaveformViewer
│       ├── ResultDisplay
│       │   ├── StatusBadge
│       │   ├── MetricsRow
│       │   └── ActionButtons
│       └── DownloadOptions
│
├── MetricsSection (35% height)
│   ├── LatencyChart
│   │   ├── LineChart (7 lines, one per provider)
│   │   ├── TimeRangeSelector (24h/7d/30d)
│   │   ├── LegendWithToggle
│   │   ├── HoverTooltip
│   │   └── PerformanceTargetLine
│   │
│   ├── ErrorRatePie
│   │   ├── PieChart
│   │   ├── LegendWithCounts
│   │   └── DrilldownPopover
│   │
│   ├── StatisticsBar
│   │   ├── TotalRequests
│   │   ├── SuccessRate
│   │   ├── AverageLatency
│   │   ├── TopProviderBySpeed
│   │   └── TopProviderByAccuracy
│   │
│   └── MetricsExport
│       ├── ExportButton
│       └── ViewFullReportLink
│
└── SettingsPanel (collapsible footer)
    ├── HealthCheckInterval (dropdown)
    ├── MaxConcurrentSessions (input)
    ├── DefaultFallbackBehavior (dropdown)
    ├── LoggingLevel (dropdown)
    ├── EnableNotifications (toggle)
    ├── DarkMode (toggle)
    └── SaveButton

Overlays / Modals:
├── ProviderConfigModal
│   ├── ProviderDetails
│   ├── AdvancedSettings
│   ├── ResourceUsageMonitor
│   └── SaveButton
│
├── FallbackChainEditor
│   ├── ChainVisualization
│   ├── ProviderSelector
│   ├── ReorderButtons
│   └── SaveButton
│
└── ErrorNotification
    ├── ErrorMessage
    ├── DismissButton
    └── RetryButton
```

## State Management & Data Flow

### Redux/Zustand Store Schema

```typescript
// Voice Provider Store
interface VoiceProviderState {
  // Provider Data
  providers: ProviderInfo[];
  activeSTTProvider: string; // provider ID
  activeTTSProvider: string;
  sttFallbackChain: string[];
  ttsFallbackChain: string[];

  // Real-time Status
  providerStatus: Map<string, ProviderStatus>;
  lastHealthCheck: number;
  healthCheckInterval: number; // ms

  // Metrics
  metrics: ProviderMetrics[];
  metricsTimeRange: "24h" | "7d" | "30d";

  // Test Results
  lastSTTTest?: VoiceTestResult;
  lastTTSTest?: VoiceTestResult;
  isTestingSTT: boolean;
  isTestingTTS: boolean;

  // UI State
  selectedTab: "status" | "control" | "test" | "metrics";
  expandedCardId?: string;
  showSettings: boolean;
  theme: "light" | "dark";
  autoRefreshEnabled: boolean;

  // Errors
  errors: ErrorMessage[];
}

// Actions
interface VoiceProviderActions {
  // Provider management
  setActiveSTTProvider(providerId: string): void;
  setActiveTTSProvider(providerId: string): void;
  updateFallbackChain(type: "stt" | "tts", chain: string[]): void;

  // Status updates
  updateProviderStatus(providerId: string, status: ProviderStatus): void;
  fetchAllProviderStatus(): Promise<void>;

  // Metrics
  fetchMetrics(timeRange: string): Promise<void>;
  setMetricsTimeRange(range: string): void;

  // Testing
  runSTTTest(providerId: string, audioBuffer: ArrayBuffer): Promise<void>;
  runTTSTest(providerId: string, text: string, options?: any): Promise<void>;

  // UI
  toggleSettingsPanel(): void;
  setTheme(theme: "light" | "dark"): void;
  addError(error: ErrorMessage): void;
  clearError(errorId: string): void;

  // WebSocket
  connectHealthMonitor(): void;
  disconnectHealthMonitor(): void;
}
```

### WebSocket Real-time Updates

**Connection:** `WebSocket /ws/voice/updates`

**Message Schema:**
```typescript
interface VoiceUpdateMessage {
  type: "provider-status" | "metrics" | "test-result" | "error";
  timestamp: number;

  // For provider-status
  providerId?: string;
  status?: ProviderStatus;

  // For metrics
  metrics?: ProviderMetrics[];

  // For test-result
  testResult?: VoiceTestResult;

  // For error
  error?: {
    providerId: string;
    message: string;
    severity: "warning" | "error";
  };
}
```

**Update Frequency:**
- Provider status: every 10 seconds
- Metrics: every minute
- Test results: on-demand
- Errors: real-time

### API Endpoints

```typescript
// Get all provider statuses
GET /api/voice/status
Response: {
  providers: ProviderStatus[];
  timestamp: number;
}

// Get provider capabilities
GET /api/voice/providers/:providerId/capabilities
Response: {
  voices?: Voice[];
  languages?: string[];
  models?: string[];
  maxConcurrent?: number;
  [key: string]: any;
}

// Select active provider
POST /api/voice/select
Body: {
  type: "stt" | "tts";
  providerId: string;
}
Response: { success: boolean; }

// Test STT
POST /api/voice/test/transcribe
Content-Type: multipart/form-data
Body: { audio: File; providerId: string; language?: string; }
Response: VoiceTestResult

// Test TTS
POST /api/voice/test/synthesize
Body: {
  providerId: string;
  text: string;
  voice?: string;
  speed?: number;
  emotion?: string;
}
Response: { success: boolean; audioUrl: string; metadata: {...} }

// Get metrics
GET /api/voice/metrics?timeRange=24h&providers=all
Response: {
  metrics: ProviderMetrics[];
  summary: MetricsSummary;
}

// Get provider health history
GET /api/voice/health-history?providerId=:id&hours=24
Response: {
  history: HealthCheckRecord[];
}

// Update settings
POST /api/voice/settings
Body: VoiceDashboardSettings
Response: { success: boolean; }

// Health check (heartbeat)
GET /api/voice/health
Response: { status: "healthy" | "degraded" | "error"; }
```

## Responsive Design Breakpoints

```typescript
enum Breakpoint {
  Mobile = 480,      // single column
  Tablet = 768,      // two columns
  Desktop = 1024,    // three columns
  Wide = 1400,       // max width
}

// Grid layouts
Mobile (< 480px):
  Provider Status: 1 column (full width)
  Control Panel + Test Panel: stacked vertically
  Metrics: 1 column charts

Tablet (480px - 1023px):
  Provider Status: 2 columns
  Control Panel + Test Panel: side-by-side (50/50)
  Metrics: 2 columns charts

Desktop (1024px - 1399px):
  Provider Status: 3 columns
  Control Panel: 45% width
  Test Panel: 55% width (scrollable)
  Metrics: 2 column grid

Wide (1400px+):
  Provider Status: 3-4 columns
  Control Panel: 30% width
  Test Panel: 40% width
  Metrics: full width 2 columns
```

## Color Palette & Design Tokens

```typescript
// Status colors (used consistently across all indicators)
const StatusColors = {
  healthy: "#22c55e",      // green-500
  degraded: "#eab308",     // yellow-500
  error: "#ef4444",        // red-500
  active: "#3b82f6",       // blue-500
  inactive: "#9ca3af",     // gray-400
};

// Semantic colors
const SemanticColors = {
  success: "#10b981",      // emerald-500
  warning: "#f59e0b",      // amber-500
  danger: "#dc2626",       // red-600
  info: "#0ea5e9",         // sky-500
  neutral: "#6b7280",      // gray-500
};

// Spacing (8px base unit)
const Spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  "2xl": "48px",
};

// Typography
const Typography = {
  h1: { fontSize: "32px", fontWeight: "bold", lineHeight: "40px" },
  h2: { fontSize: "24px", fontWeight: "bold", lineHeight: "32px" },
  h3: { fontSize: "20px", fontWeight: "bold", lineHeight: "28px" },
  h4: { fontSize: "16px", fontWeight: "600", lineHeight: "24px" },
  body: { fontSize: "14px", fontWeight: "400", lineHeight: "22px" },
  sm: { fontSize: "12px", fontWeight: "400", lineHeight: "18px" },
  mono: { fontSize: "12px", fontFamily: "monospace", lineHeight: "18px" },
};

// Shadow (depth layers)
const Shadows = {
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
};

// Animations
const Animations = {
  fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
  standard: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
  slow: "500ms cubic-bezier(0.4, 0, 0.2, 1)",
};
```

## Implementation Patterns

### Component Template (React/TypeScript)

```typescript
// ProviderCard.tsx
import React, { useEffect, useState } from "react";
import { useVoiceProviderStore } from "../store";

interface ProviderCardProps {
  providerId: string;
  onQuickTest?: () => void;
  onSwitch?: () => void;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  providerId,
  onQuickTest,
  onSwitch,
}) => {
  const { providers, providerStatus } = useVoiceProviderStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const provider = providers.find((p) => p.id === providerId);
  const status = providerStatus.get(providerId);

  if (!provider) return null;

  const statusColor =
    status?.healthy
      ? status.available
        ? "green"
        : "yellow"
      : "red";

  return (
    <div className={`provider-card status-${statusColor}`}>
      <div className="card-header">
        <div className="status-indicator" style={{ backgroundColor: statusColor }} />
        <h4>{provider.name}</h4>
        <span className="provider-type">{provider.type.toUpperCase()}</span>
      </div>

      <div className="card-body">
        <p>Mode: {provider.mode}</p>
        <p>Latency: {status?.latency || "N/A"}ms</p>
        <p>Error Rate: {status?.errorRate || "N/A"}%</p>
        <p>Last Check: {formatTime(status?.lastChecked)}</p>
      </div>

      <div className="card-footer">
        <button onClick={onQuickTest} className="btn-sm">
          Test
        </button>
        <button onClick={onSwitch} className="btn-sm">
          {provider.active ? "Active" : "Switch"}
        </button>
      </div>

      {isExpanded && (
        <div className="card-expanded">
          <ResourceUsageMonitor providerId={providerId} />
          <HealthTimeline providerId={providerId} />
        </div>
      )}
    </div>
  );
};
```

### WebSocket Connection Hook

```typescript
// useHealthMonitor.ts
import { useEffect, useCallback } from "react";
import { useVoiceProviderStore } from "../store";

export const useHealthMonitor = () => {
  const { updateProviderStatus, addError } = useVoiceProviderStore();

  useEffect(() => {
    const ws = new WebSocket(`${window.location.origin.replace("http", "ws")}/ws/voice/updates`);

    ws.onopen = () => {
      console.log("Health monitor connected");
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "provider-status") {
        updateProviderStatus(message.providerId, message.status);
      } else if (message.type === "error") {
        addError({
          id: `${message.providerId}-${Date.now()}`,
          message: message.error.message,
          severity: message.error.severity,
          providerId: message.providerId,
        });
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      addError({
        id: `ws-error-${Date.now()}`,
        message: "Health monitor connection lost",
        severity: "error",
      });
    };

    ws.onclose = () => {
      console.log("Health monitor disconnected");
      // Attempt reconnection after 5s
      setTimeout(() => {
        useHealthMonitor();
      }, 5000);
    };

    return () => ws.close();
  }, [updateProviderStatus, addError]);
};
```

### Audio Upload Handler

```typescript
// useAudioUpload.ts
import { useCallback } from "react";

interface UploadedAudio {
  buffer: ArrayBuffer;
  filename: string;
  size: number;
  duration?: number;
}

export const useAudioUpload = () => {
  const handleFile = useCallback(async (file: File): Promise<UploadedAudio> => {
    // Validate file type
    const allowedTypes = ["audio/wav", "audio/mpeg", "audio/ogg", "audio/flac", "audio/mp4"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error(`Unsupported audio format: ${file.type}`);
    }

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      throw new Error("File size exceeds 50MB limit");
    }

    const arrayBuffer = await file.arrayBuffer();

    // Get audio duration if possible
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    return {
      buffer: arrayBuffer,
      filename: file.name,
      size: file.size,
      duration: audioBuffer.duration,
    };
  }, []);

  return { handleFile };
};
```

## Accessibility (WCAG 2.1 AA)

### Key Requirements

1. **Keyboard Navigation:**
   - All interactive elements (buttons, inputs, dropdowns) must be focusable
   - Tab order must follow logical flow
   - Escape key closes modals/dropdowns
   - Enter key confirms actions

2. **Screen Reader Support:**
   - All images use descriptive alt text
   - Form labels explicitly linked to inputs
   - Live regions for status updates
   - Semantic HTML (button, input, select, etc.)
   - ARIA roles where semantic elements unavailable

3. **Color Contrast:**
   - Text: 4.5:1 ratio (normal) or 3:1 (large)
   - Status indicators: supported by icon/text not color alone
   - Charts: legend with text labels

4. **Focus Management:**
   - Visible focus indicators (outline or highlight)
   - Modal opens: focus moves to modal
   - Modal closes: focus returns to trigger button
   - Loading states announced to screen readers

### ARIA Implementation

```typescript
// ProviderStatusCard accessibility
<div
  role="status"
  aria-label={`${provider.name} provider status: ${status.health}`}
  aria-live="polite"
  aria-atomic="true"
>
  <span aria-hidden="true" className={`status-dot status-${status.health}`} />
  <span className="sr-only">
    {status.health === "healthy" ? "Healthy" : status.health === "degraded" ? "Degraded" : "Error"}
  </span>
  <h3>{provider.name}</h3>
  <p aria-describedby={`latency-${provider.id}`}>Latency</p>
  <p id={`latency-${provider.id}`}>{status.latency}ms</p>
</div>
```

## Testing Strategy

### Unit Tests (Vitest)
- Component rendering
- Props validation
- Event handlers
- Store actions
- API call mocking

### Integration Tests
- Component interactions
- WebSocket connection/disconnection
- Data flow through store
- Error handling

### E2E Tests (Playwright)
- Full dashboard flow
- Provider switching
- Test execution
- Chart interactions
- Responsive layout

### Performance Tests
- WebSocket update latency (<100ms)
- Provider card render time (<50ms)
- Chart render time (<200ms)
- Memory usage under sustained updates

## Error Handling & Recovery

```typescript
// Error types and handling
enum VoiceErrorType {
  ProviderUnavailable = "PROVIDER_UNAVAILABLE",
  TestFailed = "TEST_FAILED",
  WebSocketError = "WEBSOCKET_ERROR",
  APIError = "API_ERROR",
  ValidationError = "VALIDATION_ERROR",
}

interface VoiceError {
  type: VoiceErrorType;
  message: string;
  providerId?: string;
  retryable: boolean;
  suggestions: string[];
}

// Auto-retry logic
const retryWithBackoff = async (
  fn: () => Promise<any>,
  maxRetries = 3,
  delayMs = 1000
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
    }
  }
};
```

## Performance Optimization

1. **Lazy Loading:**
   - Metrics charts load on-demand
   - Provider details in expandable sections
   - Test results cached client-side

2. **Virtual Scrolling:**
   - For provider lists > 50 items
   - Charts with >1000 data points

3. **Memoization:**
   - useMemo for expensive calculations
   - useCallback for event handlers
   - Stable object references in store

4. **Debouncing:**
   - Search input: 300ms
   - Chart resize: 500ms
   - Settings changes: 1000ms

5. **Image Optimization:**
   - Waveform SVG (not canvas) for crisp rendering
   - Icons as inline SVG
   - Lazy load provider logos

## File Organization

```
ui/src/
├── pages/
│   └── voice-dashboard/
│       ├── VoiceDashboard.tsx (main page)
│       └── voice-dashboard.module.css
│
├── components/
│   ├── voice-dashboard/
│   │   ├── ProviderStatusSection/
│   │   │   ├── ProviderStatusSection.tsx
│   │   │   ├── ProviderStatusGrid.tsx
│   │   │   ├── ProviderCard.tsx
│   │   │   ├── StatusIndicator.tsx
│   │   │   └── styles.module.css
│   │   │
│   │   ├── ControlSection/
│   │   │   ├── ControlSection.tsx
│   │   │   ├── ProviderSelector.tsx
│   │   │   ├── FallbackChainDisplay.tsx
│   │   │   ├── MetricsPreview.tsx
│   │   │   └── styles.module.css
│   │   │
│   │   ├── TestPanel/
│   │   │   ├── TestPanel.tsx
│   │   │   ├── STTTest/
│   │   │   │   ├── AudioUploader.tsx
│   │   │   │   ├── ResultDisplay.tsx
│   │   │   │   └── styles.module.css
│   │   │   ├── TTSTest/
│   │   │   │   ├── TextInput.tsx
│   │   │   │   ├── AudioPlayer.tsx
│   │   │   │   ├── ResultDisplay.tsx
│   │   │   │   └── styles.module.css
│   │   │   └── AudioWaveform.tsx
│   │   │
│   │   ├── MetricsSection/
│   │   │   ├── MetricsSection.tsx
│   │   │   ├── LatencyChart.tsx
│   │   │   ├── ErrorRatePie.tsx
│   │   │   ├── StatisticsBar.tsx
│   │   │   └── styles.module.css
│   │   │
│   │   ├── SettingsPanel/
│   │   │   ├── SettingsPanel.tsx
│   │   │   ├── SettingsForm.tsx
│   │   │   └── styles.module.css
│   │   │
│   │   └── modals/
│   │       ├── ProviderConfigModal.tsx
│   │       ├── FallbackChainEditor.tsx
│   │       └── ErrorNotification.tsx
│
├── hooks/
│   ├── useVoiceProviderStore.ts
│   ├── useHealthMonitor.ts
│   ├── useAudioUpload.ts
│   ├── useAudioPlayback.ts
│   ├── useWebSocket.ts
│   └── useResponsive.ts
│
├── store/
│   ├── voiceProviderStore.ts (Zustand)
│   ├── types.ts
│   └── actions.ts
│
├── api/
│   ├── client.ts (fetch wrapper)
│   ├── voice.ts (voice endpoints)
│   └── types.ts
│
├── utils/
│   ├── formatting.ts (latency, time, etc.)
│   ├── validation.ts
│   ├── audio.ts
│   └── constants.ts
│
└── styles/
    ├── theme.css (colors, tokens)
    ├── responsive.css (breakpoints)
    └── animations.css
```

## Success Criteria

- ✅ All 7 providers visible with real-time status
- ✅ Provider switching completes <500ms
- ✅ Test results displayed instantly
- ✅ Metrics updated every 10 seconds
- ✅ Mobile responsive (tested on 320px-1400px)
- ✅ WebSocket connection stable (reconnect on 5s)
- ✅ No console errors or memory leaks
- ✅ WCAG 2.1 AA accessibility compliance
- ✅ Dark/light mode fully functional
- ✅ Performance budget: <3s initial load, <100ms interactions
- ✅ 80%+ test coverage for components

## Migration Path from V2

If migrating from an existing dashboard implementation:

1. Keep existing API endpoints unchanged
2. Implement new components in parallel under `/src/components/voice-dashboard`
3. Test new components with existing backend
4. Swap routing from old to new dashboard
5. Deprecate old dashboard code
6. Remove old components after validation

## References

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Web Accessibility Guidelines (WCAG 2.1)](https://www.w3.org/WAI/WCAG21/quickref)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
