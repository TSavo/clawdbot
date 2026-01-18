/**
 * Voice Dashboard Store (Zustand)
 *
 * Centralized state management for the voice provider dashboard.
 * Handles providers, status, metrics, testing, and UI state.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  VoiceProviderState,
  VoiceProviderActions,
  ProviderInfo,
  ProviderStatus,
  ProviderMetrics,
  MetricsSummary,
  STTTestResult,
  TTSTestResult,
  ErrorMessage,
  UploadedAudio,
  VoiceDashboardSettings,
  ProviderType,
  WebSocketMessage,
  HealthCheckRecord,
  VoiceConfiguration,
} from "./voice-dashboard.types";

/**
 * Default settings
 */
const DEFAULT_SETTINGS: VoiceDashboardSettings = {
  healthCheckInterval: 10000,
  maxConcurrentSessions: 8,
  defaultFallbackBehavior: "intelligent",
  loggingLevel: "info",
  enableNotifications: true,
  autoRefreshEnabled: true,
  autoRefreshInterval: 10000,
  theme: "auto",
  metricsRetention: "24h",
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

/**
 * Create the voice dashboard store with Zustand
 */
export const useVoiceProviderStore = create<VoiceProviderState & VoiceProviderActions>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    providers: [],
    configuration: null,
    providerStatus: new Map(),
    lastHealthCheck: 0,
    metrics: [],
    metricsSummary: null,
    metricsTimeRange: "24h",
    lastSTTTest: null,
    lastTTSTest: null,
    testHistory: { stt: [], tts: [] },
    healthHistory: new Map(),
    selectedTab: "status",
    expandedProviderId: null,
    showSettings: false,
    theme: "dark",
    autoRefreshEnabled: true,
    isLoading: false,
    sttTestStatus: "idle",
    ttsTestStatus: "idle",
    uploadedAudio: null,
    errors: [],
    wsConnected: false,
    wsError: null,
    wsInstance: null as WebSocket | null,

    // ===========================
    // Initialization Actions
    // ===========================

    initializeDashboard: async () => {
      set({ isLoading: true });
      try {
        await Promise.all([
          get().loadProviders(),
          get().loadConfiguration(),
          get().loadSettings(),
        ]);
        get().connectWebSocket();
        await get().fetchAllProviderStatus();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        get().addError({
          message: `Failed to initialize dashboard: ${message}`,
          severity: "error",
        });
      } finally {
        set({ isLoading: false });
      }
    },

    loadProviders: async () => {
      try {
        const response = await fetch("/api/voice/providers", {
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Failed to load providers: ${response.statusText}`);
        }

        const data = (await response.json()) as { providers: ProviderInfo[] };
        set({ providers: data.providers });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Error loading providers:", message);
        get().addError({
          message: `Error loading providers: ${message}`,
          severity: "error",
        });
      }
    },

    loadConfiguration: async () => {
      try {
        const response = await fetch("/api/voice/config", {
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Failed to load configuration: ${response.statusText}`);
        }

        const data = (await response.json()) as { config: VoiceConfiguration };
        set({ configuration: data.config });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Error loading configuration:", message);
      }
    },

    loadSettings: async () => {
      try {
        const response = await fetch("/api/voice/settings", {
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          const data = (await response.json()) as { settings: VoiceDashboardSettings };
          set({
            autoRefreshInterval: data.settings.autoRefreshInterval,
            theme: data.settings.theme,
            autoRefreshEnabled: data.settings.autoRefreshEnabled,
          });
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    },

    // ===========================
    // Provider Management Actions
    // ===========================

    setActiveSTTProvider: async (providerId: string) => {
      try {
        const response = await fetch("/api/voice/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "stt", providerId }),
        });

        if (!response.ok) {
          throw new Error(`Failed to select STT provider: ${response.statusText}`);
        }

        set((state) => ({
          configuration: state.configuration
            ? { ...state.configuration, activeSTTProvider: providerId }
            : null,
        }));

        get().addError({
          message: `STT provider switched to ${providerId}`,
          severity: "info",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        get().addError({
          message: `Failed to switch STT provider: ${message}`,
          severity: "error",
        });
      }
    },

    setActiveTTSProvider: async (providerId: string) => {
      try {
        const response = await fetch("/api/voice/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "tts", providerId }),
        });

        if (!response.ok) {
          throw new Error(`Failed to select TTS provider: ${response.statusText}`);
        }

        set((state) => ({
          configuration: state.configuration
            ? { ...state.configuration, activeTTSProvider: providerId }
            : null,
        }));

        get().addError({
          message: `TTS provider switched to ${providerId}`,
          severity: "info",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        get().addError({
          message: `Failed to switch TTS provider: ${message}`,
          severity: "error",
        });
      }
    },

    updateFallbackChain: async (type: ProviderType, chain: string[]) => {
      try {
        const response = await fetch("/api/voice/fallback-chain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, chain }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update fallback chain: ${response.statusText}`);
        }

        set((state) => ({
          configuration: state.configuration
            ? {
                ...state.configuration,
                [type === "stt" ? "sttFallbackChain" : "ttsFallbackChain"]: {
                  type,
                  providers: chain,
                  createdAt: Date.now(),
                  modifiedAt: Date.now(),
                },
              }
            : null,
        }));

        get().addError({
          message: `${type.toUpperCase()} fallback chain updated`,
          severity: "info",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        get().addError({
          message: `Failed to update fallback chain: ${message}`,
          severity: "error",
        });
      }
    },

    // ===========================
    // Status & Metrics Actions
    // ===========================

    updateProviderStatus: (providerId: string, status: ProviderStatus) => {
      set((state) => {
        const newStatus = new Map(state.providerStatus);
        newStatus.set(providerId, status);
        return { providerStatus: newStatus, lastHealthCheck: Date.now() };
      });
    },

    fetchAllProviderStatus: async () => {
      try {
        const response = await fetch("/api/voice/status", {
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch status: ${response.statusText}`);
        }

        const data = (await response.json()) as { providers: ProviderStatus[] };
        set((state) => {
          const newStatus = new Map(state.providerStatus);
          for (const status of data.providers) {
            newStatus.set(status.id, status);
          }
          return { providerStatus: newStatus, lastHealthCheck: Date.now() };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Error fetching provider status:", message);
      }
    },

    subscribeToStatusUpdates: () => {
      get().connectWebSocket();
    },

    unsubscribeFromStatusUpdates: () => {
      get().disconnectWebSocket();
    },

    fetchMetrics: async (timeRange: "24h" | "7d" | "30d") => {
      try {
        const response = await fetch(`/api/voice/metrics?timeRange=${timeRange}`, {
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch metrics: ${response.statusText}`);
        }

        const data = (await response.json()) as {
          metrics: ProviderMetrics[];
          summary: MetricsSummary;
        };

        set({
          metrics: data.metrics,
          metricsSummary: data.summary,
          metricsTimeRange: timeRange,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Error fetching metrics:", message);
      }
    },

    setMetricsTimeRange: (range: "24h" | "7d" | "30d") => {
      get().fetchMetrics(range);
    },

    fetchHealthHistory: async (providerId: string, hours: number) => {
      try {
        const response = await fetch(
          `/api/voice/health-history?providerId=${providerId}&hours=${hours}`,
          {
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch health history: ${response.statusText}`);
        }

        const data = (await response.json()) as { history: HealthCheckRecord[] };
        set((state) => {
          const newHistory = new Map(state.healthHistory);
          newHistory.set(providerId, data.history);
          return { healthHistory: newHistory };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Error fetching health history:", message);
      }
    },

    // ===========================
    // Testing Actions
    // ===========================

    uploadAudioFile: async (file: File) => {
      try {
        const buffer = await file.arrayBuffer();

        // Validate file size (50MB max)
        if (file.size > 50 * 1024 * 1024) {
          throw new Error("File size exceeds 50MB limit");
        }

        // Get audio duration if possible
        let duration: number | undefined;
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuffer = await audioContext.decodeAudioData(buffer);
          duration = audioBuffer.duration;
        } catch {
          // If we can't decode, continue without duration
        }

        set({
          uploadedAudio: {
            buffer,
            filename: file.name,
            size: file.size,
            duration,
            format: file.type,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        get().addError({
          message: `Failed to upload audio: ${message}`,
          severity: "error",
        });
      }
    },

    clearUploadedAudio: () => {
      set({ uploadedAudio: null });
    },

    runSTTTest: async (providerId: string, language?: string) => {
      const uploadedAudio = get().uploadedAudio;

      if (!uploadedAudio) {
        get().addError({
          message: "No audio file selected",
          severity: "warning",
        });
        return;
      }

      set({ sttTestStatus: "testing" });

      try {
        const formData = new FormData();
        formData.append("providerId", providerId);
        formData.append("audio", new Blob([uploadedAudio.buffer], { type: uploadedAudio.format }));
        if (language) {
          formData.append("language", language);
        }

        const response = await fetch("/api/voice/test/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Test failed: ${response.statusText}`);
        }

        const data = (await response.json()) as { result: STTTestResult };

        set((state) => ({
          lastSTTTest: data.result,
          sttTestStatus: "success",
          testHistory: {
            ...state.testHistory,
            stt: [data.result, ...state.testHistory.stt].slice(0, 50),
          },
        }));

        get().addError({
          message: `STT test completed with ${data.result.confidence}% confidence`,
          severity: "info",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({ sttTestStatus: "error" });
        get().addError({
          message: `STT test failed: ${message}`,
          severity: "error",
        });
      }
    },

    runTTSTest: async (providerId: string, text: string, options?: any) => {
      if (!text.trim()) {
        get().addError({
          message: "Text input is empty",
          severity: "warning",
        });
        return;
      }

      set({ ttsTestStatus: "testing" });

      try {
        const response = await fetch("/api/voice/test/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId,
            text,
            ...options,
          }),
        });

        if (!response.ok) {
          throw new Error(`Test failed: ${response.statusText}`);
        }

        const data = (await response.json()) as { result: TTSTestResult };

        set((state) => ({
          lastTTSTest: data.result,
          ttsTestStatus: "success",
          testHistory: {
            ...state.testHistory,
            tts: [data.result, ...state.testHistory.tts].slice(0, 50),
          },
        }));

        get().addError({
          message: `TTS test completed in ${data.result.latency}ms`,
          severity: "info",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({ ttsTestStatus: "error" });
        get().addError({
          message: `TTS test failed: ${message}`,
          severity: "error",
        });
      }
    },

    // ===========================
    // Settings Actions
    // ===========================

    updateSettings: async (settings: Partial<VoiceDashboardSettings>) => {
      try {
        const response = await fetch("/api/voice/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update settings: ${response.statusText}`);
        }

        set((state) => ({
          autoRefreshInterval: settings.autoRefreshInterval ?? state.autoRefreshInterval,
          theme: settings.theme ?? state.theme,
          autoRefreshEnabled: settings.autoRefreshEnabled ?? state.autoRefreshEnabled,
        }));

        get().addError({
          message: "Settings updated successfully",
          severity: "info",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        get().addError({
          message: `Failed to update settings: ${message}`,
          severity: "error",
        });
      }
    },

    // ===========================
    // UI State Actions
    // ===========================

    setSelectedTab: (tab) => {
      set({ selectedTab: tab });
    },

    toggleExpandProvider: (providerId: string | null) => {
      set({ expandedProviderId: providerId });
    },

    toggleSettingsPanel: () => {
      set((state) => ({ showSettings: !state.showSettings }));
    },

    setTheme: (theme: "light" | "dark") => {
      set({ theme });
      document.documentElement.setAttribute("data-theme", theme);
    },

    setAutoRefresh: (enabled: boolean) => {
      set({ autoRefreshEnabled: enabled });
    },

    // ===========================
    // Error Management Actions
    // ===========================

    addError: (error: Omit<ErrorMessage, "id" | "timestamp">) => {
      const errorMessage: ErrorMessage = {
        ...error,
        id: `${error.severity}-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        dismissible: error.dismissible ?? true,
      };

      set((state) => ({
        errors: [errorMessage, ...state.errors].slice(0, 10), // Keep last 10
      }));

      // Auto-dismiss after 5 seconds if dismissible
      if (errorMessage.dismissible) {
        setTimeout(() => {
          get().dismissError(errorMessage.id);
        }, 5000);
      }
    },

    dismissError: (errorId: string) => {
      set((state) => ({
        errors: state.errors.filter((e) => e.id !== errorId),
      }));
    },

    clearAllErrors: () => {
      set({ errors: [] });
    },

    // ===========================
    // WebSocket Actions
    // ===========================

    connectWebSocket: () => {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/voice/updates`;

      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          set({ wsConnected: true, wsError: null });
          console.log("Voice dashboard WebSocket connected");
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage;
            get().handleWebSocketMessage(message);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          set({ wsConnected: false, wsError: errorMsg });
          console.error("Voice dashboard WebSocket error:", error);
        };

        ws.onclose = () => {
          set({ wsConnected: false });
          console.log("Voice dashboard WebSocket disconnected");
          // Attempt reconnection after 5 seconds
          setTimeout(() => {
            get().connectWebSocket();
          }, 5000);
        };

        set({ wsInstance: ws });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({ wsConnected: false, wsError: message });
        console.error("Failed to connect WebSocket:", error);
      }
    },

    disconnectWebSocket: () => {
      const ws = get().wsInstance;
      if (ws) {
        ws.close();
        set({ wsInstance: null, wsConnected: false });
      }
    },

    handleWebSocketMessage: (message: WebSocketMessage) => {
      switch (message.type) {
        case "provider-status":
          get().updateProviderStatus(message.data.providerId, message.data.status);
          break;

        case "metrics":
          set({
            metrics: message.data.metrics,
            metricsSummary: message.data.summary,
          });
          break;

        case "error":
          get().addError({
            message: message.data.message,
            severity: message.data.severity,
            providerId: message.data.providerId,
          });
          break;

        case "config-update":
          set({ configuration: message.data });
          break;

        default:
          console.warn("Unknown WebSocket message type:", message.type);
      }
    },
  }))
);

/**
 * Helper hook to get active providers
 */
export const useActiveProviders = () => {
  const state = useVoiceProviderStore();
  const configuration = state.configuration;

  if (!configuration) {
    return { activeSTT: null, activeTTS: null };
  }

  const activeSTT = state.providers.find((p) => p.id === configuration.activeSTTProvider);
  const activeTTS = state.providers.find((p) => p.id === configuration.activeTTSProvider);

  return { activeSTT, activeTTS };
};

/**
 * Helper hook to get provider status
 */
export const useProviderStatus = (providerId: string) => {
  const status = useVoiceProviderStore((state) => state.providerStatus.get(providerId));
  return status;
};

/**
 * Helper hook to get health history for a provider
 */
export const useHealthHistory = (providerId: string) => {
  const history = useVoiceProviderStore((state) => state.healthHistory.get(providerId));
  return history;
};
