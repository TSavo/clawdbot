/**
 * Voice Providers Plugin Registration
 *
 * Registers the speech-plugins providers with Clawdbot
 */

/**
 * Plugin registration function for Clawdbot
 * Called when the plugin is loaded by the plugin system
 */
export function registerVoiceProvidersPlugin(api: any) {
  // Plugin initialization
  // In a full implementation, this would:
  // - Register voice provider tools with api.registerTool()
  // - Register CLI commands with api.registerCommand()
  // - Set up configuration schema
  // - Register gateway methods if needed

  api.log?.info?.("Speech-plugins voice provider plugin loaded");

  return {
    initialized: true,
    name: "speech-plugins",
    version: "0.1.0",
  };
}

// Also export as default for plugin loader compatibility
export default registerVoiceProvidersPlugin;
