/**
 * Speech Plugins - STT/TTS Plugin System
 *
 * Provides a pluggable interface for integrating multiple speech-to-text (STT)
 * and text-to-speech (TTS) providers in a unified way.
 *
 * Features:
 * - Provider interfaces for STT and TTS with comprehensive capabilities
 * - Plugin registry for managing multiple providers
 * - Support for both local and remote providers
 * - Cross-provider compatibility and audio format handling
 * - Streaming support where available
 * - Configuration validation and schema support
 */

// Interfaces
export type {
  STTCapabilities,
  STTProviderMetadata,
  STTTranscriptSegment,
  STTStreamEvent,
  STTStreamCallback,
  STTProvider,
} from "./interfaces/stt-provider.js";

export type {
  TTSCapabilities,
  TTSVoice,
  TTSProviderMetadata,
  TTSSynthesisOptions,
  TTSStreamEvent,
  TTSStreamCallback,
  TTSProvider,
} from "./interfaces/tts-provider.js";

export type {
  ProviderConfig,
  PluginRegistry,
  RegistryEventListener,
} from "./interfaces/plugin-registry.js";

// Plugin registration
export { registerVoiceProvidersPlugin } from "./plugin-registration.js";

// NOTE: Provider classes and registries are NOT re-exported from the plugin entry point
// This prevents circular dependencies and module resolution issues when loading as a plugin.
// They are available for direct import if needed (e.g., from extensions, internal modules)

// Default export for plugin system
export { registerVoiceProvidersPlugin as default } from "./plugin-registration.js";
