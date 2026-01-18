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
export type { STTCapabilities, STTProviderMetadata, STTTranscriptSegment, STTStreamEvent, STTStreamCallback, STTProvider, } from "./interfaces/stt-provider.js";
export type { TTSCapabilities, TTSVoice, TTSProviderMetadata, TTSSynthesisOptions, TTSStreamEvent, TTSStreamCallback, TTSProvider, } from "./interfaces/tts-provider.js";
export type { ProviderConfig, PluginRegistry, RegistryEventListener, } from "./interfaces/plugin-registry.js";
export { createMockSTTProvider, createMockTTSProvider, createMockAudioBuffer, createMockWAVFile, createMockStream, createErrorSTTProvider, createErrorTTSProvider, } from "./test-utils/mocks.js";
export { generateSineWave, generateWhiteNoise, generateSpeechPattern, createWAVBuffer, AudioFixtures, AudioBufferUtils, } from "./test-utils/audio-fixtures.js";
export { BaseTTSPlugin, KokoroTTSPlugin, CartesiaTTSPlugin, ElevenLabsTTSPlugin, ChatterboxTTSPlugin, } from "./providers/tts/index.js";
export type { KokoroTTSConfig, ElevenLabsTTSConfig, } from "./providers/tts/index.js";
export { SimplePluginRegistry, expandEnvVars, validateDeploymentConfig } from "./registry/plugin-registry.js";
export type { ProviderFactory } from "./registry/plugin-registry.js";
export type { DeploymentConfig, ProviderPluginConfig } from "./providers/index.js";
export { WHISPER_SYSTEM_PLUGIN, FASTER_WHISPER_DOCKER_PLUGIN, DEEPGRAM_CLOUD_PLUGIN, KOKORO_SYSTEM_PLUGIN, CARTESIA_CLOUD_PLUGIN, ELEVENLABS_CLOUD_PLUGIN, CHATTERBOX_DOCKER_PLUGIN, getAllProviderPlugins, getSTTProviderPlugins, getTTSProviderPlugins, } from "./providers/index.js";
//# sourceMappingURL=index.d.ts.map