/**
 * Voice Dashboard Type Definitions
 *
 * Comprehensive types for the voice provider dashboard UI,
 * including components, state management, and API interactions.
 */

/**
 * Provider type (STT or TTS)
 */
export type ProviderType = "stt" | "tts";

/**
 * Provider mode (how it runs)
 */
export type ProviderMode = "docker" | "system" | "cloud";

/**
 * Health status of a provider
 */
export type HealthStatus = "healthy" | "degraded" | "error";

/**
 * Test status
 */
export type TestStatus = "idle" | "testing" | "success" | "error";

/**
 * Provider information
 */
export interface ProviderInfo {
  id: string;
  name: string;
  type: ProviderType;
  mode: ProviderMode;
  description: string;
  capabilities: ProviderCapability[];
  active: boolean;
  resourceRequirements?: ResourceRequirements;
  documentation?: string;
}

/**
 * Provider capability (models, voices, languages, etc.)
 */
export interface ProviderCapability {
  name: string;
  value: string | number | boolean;
  configurable: boolean;
}

/**
 * Resource requirements for a provider
 */
export interface ResourceRequirements {
  minMemoryMb?: number;
  minCpuCores?: number;
  gpuRequired?: boolean;
  networkBandwidth?: "low" | "medium" | "high";
}

/**
 * Real-time provider status
 */
export interface ProviderStatus {
  id: string;
  health: HealthStatus;
  available: boolean;
  healthy: boolean;
  lastChecked: number; // timestamp
  latency: number; // milliseconds
  errorRate: number; // percentage
  successRate: number; // percentage
  requestsProcessed: number;
  requestsFailed: number;
  warnings: string[];
  resourceUsage?: ResourceUsage;
}

/**
 * Current resource usage
 */
export interface ResourceUsage {
  memoryMb: number;
  cpuPercent: number;
  gpuPercent?: number;
  threadsActive?: number;
  uptime: number; // seconds
}

/**
 * Historical health check record
 */
export interface HealthCheckRecord {
  timestamp: number;
  health: HealthStatus;
  latency: number;
  errorRate: number;
}

/**
 * Provider metrics for analytics
 */
export interface ProviderMetrics {
  providerId: string;
  timestamp: number;
  latency: number;
  errorRate: number;
  successRate: number;
  requestCount: number;
  avgResponseTime: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
}

/**
 * Aggregated metrics summary
 */
export interface MetricsSummary {
  totalRequests: number;
  successRate: number;
  avgLatency: number;
  totalErrors: number;
  topProviderBySpeed: { providerId: string; latency: number };
  topProviderByAccuracy: { providerId: string; errorRate: number };
  peakLoadTime: { time: string; requestsPerMin: number };
}

/**
 * Voice test result (STT)
 */
export interface STTTestResult {
  success: boolean;
  providerId: string;
  timestamp: number;
  duration: number; // milliseconds
  latency: number; // milliseconds
  transcript: string;
  confidence: number; // 0-100
  language: string;
  error?: {
    code: string;
    message: string;
  };
  metadata?: {
    model?: string;
    audioFormat?: string;
    audioDuration?: number;
  };
}

/**
 * Voice test result (TTS)
 */
export interface TTSTestResult {
  success: boolean;
  providerId: string;
  timestamp: number;
  duration: number; // milliseconds
  latency: number; // milliseconds
  audioUrl?: string;
  audioSize?: number; // bytes
  audioFormat: string; // "mp3", "wav", etc.
  error?: {
    code: string;
    message: string;
  };
  metadata?: {
    voice?: string;
    sampleRate?: number;
    bitrate?: string;
  };
}

/**
 * Uploaded audio file
 */
export interface UploadedAudio {
  buffer: ArrayBuffer;
  filename: string;
  size: number;
  duration?: number;
  format: string;
}

/**
 * Audio playback state
 */
export interface AudioPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  speed: number;
}

/**
 * Waveform data for visualization
 */
export interface WaveformData {
  peaks: number[]; // normalized 0-1
  samples: number; // total sample count
  duration: number; // seconds
  sampleRate: number;
}

/**
 * Dashboard error message
 */
export interface ErrorMessage {
  id: string;
  message: string;
  severity: "info" | "warning" | "error";
  providerId?: string;
  timestamp: number;
  dismissible?: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
}

/**
 * Voice dashboard settings
 */
export interface VoiceDashboardSettings {
  healthCheckInterval: number; // milliseconds, 10s default
  maxConcurrentSessions: number; // default 8
  defaultFallbackBehavior: "strict" | "lenient" | "intelligent";
  loggingLevel: "debug" | "info" | "warning" | "error";
  enableNotifications: boolean;
  autoRefreshEnabled: boolean;
  autoRefreshInterval: number; // milliseconds
  theme: "light" | "dark" | "auto";
  metricsRetention: "24h" | "7d" | "30d" | "90d";
  timeZone: string;
}

/**
 * Fallback chain configuration
 */
export interface FallbackChain {
  type: ProviderType;
  providers: string[]; // provider IDs in order
  createdAt: number;
  modifiedAt: number;
}

/**
 * Voice configuration (active providers + fallback chains)
 */
export interface VoiceConfiguration {
  activeSTTProvider: string;
  activeTTSProvider: string;
  sttFallbackChain: FallbackChain;
  ttsFallbackChain: FallbackChain;
  settings: VoiceDashboardSettings;
}

/**
 * WebSocket message from backend
 */
export interface WebSocketMessage {
  type: "provider-status" | "metrics" | "test-result" | "error" | "config-update";
  timestamp: number;
  data: any;
}

/**
 * Provider status WebSocket message
 */
export interface ProviderStatusMessage extends WebSocketMessage {
  type: "provider-status";
  data: {
    providerId: string;
    status: ProviderStatus;
  };
}

/**
 * Metrics WebSocket message
 */
export interface MetricsMessage extends WebSocketMessage {
  type: "metrics";
  data: {
    metrics: ProviderMetrics[];
    summary: MetricsSummary;
  };
}

/**
 * Error WebSocket message
 */
export interface ErrorMessageWS extends WebSocketMessage {
  type: "error";
  data: {
    providerId?: string;
    code: string;
    message: string;
    severity: "warning" | "error" | "critical";
  };
}

/**
 * Configuration update WebSocket message
 */
export interface ConfigUpdateMessage extends WebSocketMessage {
  type: "config-update";
  data: VoiceConfiguration;
}

/**
 * Redux/Zustand store state
 */
export interface VoiceProviderState {
  // Provider data
  providers: ProviderInfo[];
  configuration: VoiceConfiguration | null;

  // Real-time status
  providerStatus: Map<string, ProviderStatus>;
  lastHealthCheck: number;

  // Metrics and analytics
  metrics: ProviderMetrics[];
  metricsSummary: MetricsSummary | null;
  metricsTimeRange: "24h" | "7d" | "30d";

  // Test results
  lastSTTTest: STTTestResult | null;
  lastTTSTest: TTSTestResult | null;
  testHistory: {
    stt: STTTestResult[];
    tts: TTSTestResult[];
  };

  // Health history
  healthHistory: Map<string, HealthCheckRecord[]>;

  // UI state
  selectedTab: "status" | "control" | "test" | "metrics";
  expandedProviderId: string | null;
  showSettings: boolean;
  theme: "light" | "dark";
  autoRefreshEnabled: boolean;
  isLoading: boolean;

  // Test UI state
  sttTestStatus: TestStatus;
  ttsTestStatus: TestStatus;
  uploadedAudio: UploadedAudio | null;

  // Errors
  errors: ErrorMessage[];

  // WebSocket connection
  wsConnected: boolean;
  wsError: string | null;
}

/**
 * Redux/Zustand store actions
 */
export interface VoiceProviderActions {
  // Initialization
  initializeDashboard(): Promise<void>;
  loadProviders(): Promise<void>;
  loadConfiguration(): Promise<void>;

  // Provider management
  setActiveSTTProvider(providerId: string): Promise<void>;
  setActiveTTSProvider(providerId: string): Promise<void>;
  updateFallbackChain(type: ProviderType, chain: string[]): Promise<void>;

  // Status updates
  updateProviderStatus(providerId: string, status: ProviderStatus): void;
  fetchAllProviderStatus(): Promise<void>;
  subscribeToStatusUpdates(): void;
  unsubscribeFromStatusUpdates(): void;

  // Metrics
  fetchMetrics(timeRange: "24h" | "7d" | "30d"): Promise<void>;
  setMetricsTimeRange(range: "24h" | "7d" | "30d"): void;

  // Health history
  fetchHealthHistory(providerId: string, hours: number): Promise<void>;

  // Testing
  uploadAudioFile(file: File): Promise<void>;
  clearUploadedAudio(): void;
  runSTTTest(providerId: string, language?: string): Promise<void>;
  runTTSTest(providerId: string, text: string, options?: any): Promise<void>;

  // Settings
  updateSettings(settings: Partial<VoiceDashboardSettings>): Promise<void>;
  loadSettings(): Promise<void>;

  // UI state
  setSelectedTab(tab: "status" | "control" | "test" | "metrics"): void;
  toggleExpandProvider(providerId: string | null): void;
  toggleSettingsPanel(): void;
  setTheme(theme: "light" | "dark"): void;
  setAutoRefresh(enabled: boolean): void;

  // Error management
  addError(error: Omit<ErrorMessage, "id" | "timestamp">): void;
  dismissError(errorId: string): void;
  clearAllErrors(): void;

  // WebSocket
  connectWebSocket(): void;
  disconnectWebSocket(): void;
  handleWebSocketMessage(message: WebSocketMessage): void;
}

/**
 * Component props interfaces
 */

export interface ProviderCardProps {
  provider: ProviderInfo;
  status: ProviderStatus | undefined;
  isActive: boolean;
  isExpanded: boolean;
  onExpand: (expanded: boolean) => void;
  onTest: () => void;
  onSwitch: () => void;
  onConfigure: () => void;
}

export interface ProviderSelectorProps {
  type: ProviderType;
  providers: ProviderInfo[];
  activeProviderId: string;
  onSelect: (providerId: string) => void;
  metrics?: ProviderMetrics;
  status?: ProviderStatus;
}

export interface FallbackChainDisplayProps {
  chain: string[];
  providers: ProviderInfo[];
  onAdd: () => void;
  onRemove: (providerId: string) => void;
  onReorder: (from: number, to: number) => void;
}

export interface AudioUploaderProps {
  onFileSelected: (audio: UploadedAudio) => void;
  acceptedFormats: string[];
  maxSizeMb: number;
  isLoading: boolean;
}

export interface AudioPlayerProps {
  audioUrl: string;
  waveform?: WaveformData;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
  autoPlay?: boolean;
}

export interface TestResultDisplayProps {
  result: STTTestResult | TTSTestResult;
  type: ProviderType;
}

export interface LatencyChartProps {
  metrics: ProviderMetrics[];
  providers: ProviderInfo[];
  timeRange: "24h" | "7d" | "30d";
  onTimeRangeChange: (range: "24h" | "7d" | "30d") => void;
}

export interface ErrorRatePieChartProps {
  metrics: ProviderMetrics[];
  providers: ProviderInfo[];
}

export interface StatisticsBarProps {
  summary: MetricsSummary;
  onExport?: () => void;
}

/**
 * API request/response types
 */

export interface GetStatusResponse {
  providers: ProviderStatus[];
  timestamp: number;
}

export interface GetProvidersResponse {
  providers: ProviderInfo[];
}

export interface SelectProviderRequest {
  type: ProviderType;
  providerId: string;
}

export interface SelectProviderResponse {
  success: boolean;
  message?: string;
}

export interface TestSTTRequest {
  providerId: string;
  audio: FormData; // File blob
  language?: string;
}

export interface TestTTSRequest {
  providerId: string;
  text: string;
  voice?: string;
  speed?: number;
  emotion?: string;
}

export interface GetMetricsResponse {
  metrics: ProviderMetrics[];
  summary: MetricsSummary;
  timeRange: string;
}

export interface GetHealthHistoryResponse {
  providerId: string;
  history: HealthCheckRecord[];
}

export interface UpdateSettingsRequest {
  settings: Partial<VoiceDashboardSettings>;
}

export interface UpdateSettingsResponse {
  success: boolean;
  settings: VoiceDashboardSettings;
}

/**
 * Utility types
 */

export type ChartTimeRange = "24h" | "7d" | "30d";
export type ThemeMode = "light" | "dark" | "auto";
export type NotificationType = "success" | "warning" | "error" | "info";

/**
 * Event emitter types for real-time updates
 */
export interface DashboardEventMap {
  "provider-status": ProviderStatus;
  "metrics-update": MetricsSummary;
  "test-complete": STTTestResult | TTSTestResult;
  "error": ErrorMessage;
  "config-change": VoiceConfiguration;
}
