/**
 * Voice Provider Plugin Exports
 *
 * Exports all STT/TTS provider plugins for registration with the plugin registry.
 * Providers support multiple deployment modes: system (local binary), docker (containerized), and cloud (API).
 */
// STT Provider Plugins
/**
 * Whisper STT Provider (System Mode - Default)
 *
 * Local execution using whisper.cpp binary.
 * Requires whisper binary installed on system PATH or specified in binaryPath.
 *
 * Models: tiny, base, small, medium, large
 * Languages: 99+ languages
 * Formats: WAV, MP3, OGG, FLAC
 * Sample Rates: 16000 Hz recommended
 */
export const WHISPER_SYSTEM_PLUGIN = "whisper-system";
/**
 * Faster-Whisper STT Provider (Docker Mode)
 *
 * Containerized execution using faster-whisper with GPU acceleration.
 * Requires Docker installed and running.
 *
 * Models: tiny, base, small, medium, large (with optional quantization)
 * Languages: 99+ languages
 * Formats: WAV, MP3, OGG, FLAC
 * Sample Rates: 16000 Hz recommended
 */
export const FASTER_WHISPER_DOCKER_PLUGIN = "faster-whisper-docker";
/**
 * Deepgram STT Provider (Cloud Mode)
 *
 * Cloud API for high-accuracy transcription.
 * Requires Deepgram API key.
 *
 * Models: nova-2, enhanced, base
 * Languages: 30+ languages
 * Formats: WAV, MP3, OGG, FLAC, WebM
 * Sample Rates: 8000-48000 Hz
 * Features: Real-time streaming, speaker diarization, punctuation
 */
export const DEEPGRAM_CLOUD_PLUGIN = "deepgram-cloud";
// TTS Provider Plugins
/**
 * Kokoro TTS Provider (System Mode - Default)
 *
 * Local execution using Kokoro TTS binary.
 * Fast, high-quality synthesis with multiple voices.
 *
 * Voices: 6+ English voices (male/female)
 * Languages: English (more coming)
 * Formats: WAV, PCM
 * Sample Rates: 22050 Hz default, 8000-48000 Hz supported
 * Features: Fast synthesis, emotion control
 */
export const KOKORO_SYSTEM_PLUGIN = "kokoro-system";
/**
 * CartesiaAI TTS Provider (Cloud Mode)
 *
 * Cloud API for ultra-realistic voice synthesis.
 * Requires CartesiaAI API key.
 *
 * Voices: 50+ voices across languages
 * Languages: 14+ languages
 * Formats: WAV, MP3, PCM
 * Sample Rates: 8000-48000 Hz
 * Features: Real-time streaming, voice cloning, emotion control
 */
export const CARTESIA_CLOUD_PLUGIN = "cartesia-cloud";
/**
 * ElevenLabs TTS Provider (Cloud Mode)
 *
 * Cloud API for premium voice synthesis.
 * Requires ElevenLabs API key.
 *
 * Voices: 100+ pre-made voices + custom voice cloning
 * Languages: 29+ languages
 * Formats: MP3, PCM, mu-law
 * Sample Rates: 8000-44100 Hz
 * Features: Voice cloning, emotion control, multilingual
 */
export const ELEVENLABS_CLOUD_PLUGIN = "elevenlabs-cloud";
/**
 * Chatterbox TTS Provider (Docker Mode)
 *
 * Containerized TTS with VITS-based synthesis.
 * Requires Docker installed and running.
 *
 * Voices: Multiple voices per language
 * Languages: English, Spanish, French, German, more
 * Formats: WAV, PCM
 * Sample Rates: 22050 Hz default
 * Features: Fast synthesis, customizable models
 */
export const CHATTERBOX_DOCKER_PLUGIN = "chatterbox-docker";
/**
 * Get all available provider plugin identifiers
 */
export function getAllProviderPlugins() {
    return [
        // STT providers
        WHISPER_SYSTEM_PLUGIN,
        FASTER_WHISPER_DOCKER_PLUGIN,
        DEEPGRAM_CLOUD_PLUGIN,
        // TTS providers
        KOKORO_SYSTEM_PLUGIN,
        CARTESIA_CLOUD_PLUGIN,
        ELEVENLABS_CLOUD_PLUGIN,
        CHATTERBOX_DOCKER_PLUGIN,
    ];
}
/**
 * Get STT provider plugin identifiers
 */
export function getSTTProviderPlugins() {
    return [WHISPER_SYSTEM_PLUGIN, FASTER_WHISPER_DOCKER_PLUGIN, DEEPGRAM_CLOUD_PLUGIN];
}
/**
 * Get TTS provider plugin identifiers
 */
export function getTTSProviderPlugins() {
    return [
        KOKORO_SYSTEM_PLUGIN,
        CARTESIA_CLOUD_PLUGIN,
        ELEVENLABS_CLOUD_PLUGIN,
        CHATTERBOX_DOCKER_PLUGIN,
    ];
}
//# sourceMappingURL=index.js.map