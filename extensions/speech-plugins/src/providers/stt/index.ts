/**
 * STT Provider Plugin Exports
 *
 * Exports all STT provider plugin wrappers and system mode utilities.
 */

export { BaseSTTPlugin } from './base.js';
export { WhisperSTTPlugin } from './whisper.js';
export { FasterWhisperSTTPlugin } from './faster-whisper.js';
export { DeepgramSTTPlugin } from './deepgram.js';

// System mode support
export {
  initializeSystemMode,
  validateSystemModeConfig,
  detectBinary,
  getPackageManager,
  installSystemDependency,
  installPythonPackage,
  getProviderDependencies,
  listSupportedProviders,
  getPlatformInfo,
  type SystemModeConfig,
} from './system-mode.js';
