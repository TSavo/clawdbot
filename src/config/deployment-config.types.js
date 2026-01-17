/**
 * Deployment Configuration Types
 *
 * Defines TypeScript interfaces for voice provider deployment modes
 * (Docker, System, Cloud) with comprehensive configuration options.
 *
 * Architecture:
 * - BaseDeploymentConfig: Common settings (timeout, retries, health checks)
 * - Mode-specific configs: Docker, System, Cloud
 * - Provider-specific overrides: Whisper, Faster-Whisper, Kokoro, ElevenLabs, etc.
 *
 * All providers inherit from BaseDeploymentConfig and extend with mode-specific fields.
 */
export {};
//# sourceMappingURL=deployment-config.types.js.map