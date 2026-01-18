/**
 * TTS Provider Plugins
 *
 * Exports all TTS provider plugin wrappers for use in the plugin registry.
 * Includes Docker mode support for all providers.
 */

export { BaseTTSPlugin } from './base.js';
export { KokoroTTSPlugin } from './kokoro.js';
export type { KokoroTTSConfig } from './kokoro.js';
export { CartesiaTTSPlugin } from './cartesia.js';
export { ElevenLabsTTSPlugin } from './elevenlabs.js';
export type { ElevenLabsTTSConfig } from './elevenlabs.js';
export { ChatterboxTTSPlugin } from './chatterbox.js';

// Docker mode handlers and utilities
export {
  TTS_DOCKER_IMAGES,
  isDockerAvailable,
  pullTTSImage,
  createVolumeDirectory,
  startTTSContainer,
  stopTTSContainer,
  checkTTSContainerHealth,
  initializeTTSDockerMode,
  getRunningTTSContainers,
  stopAllTTSContainers,
  type ContainerHealthStatus,
  type TTSDockerConfig,
} from './docker-handler.js';
