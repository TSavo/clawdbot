/**
 * Plugin System Interfaces
 *
 * Defines base plugin interfaces for STT and TTS providers.
 * Plugins can be dynamically loaded and registered at runtime.
 */
/**
 * Plugin registry error.
 */
export class PluginRegistryError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "PluginRegistryError";
    }
}
