/**
 * OpenAI TTS Provider - Backwards Compatibility Wrapper
 *
 * This module re-exports the plugin version for backwards compatibility.
 * New code should import from ../plugins/tts-openai instead.
 *
 * @deprecated Use `../plugins/tts-openai` or `../plugins` instead
 */
export { OpenAITTSProvider, OPENAI_TTS_VOICES, chunkAudio, mulawToLinear, pcmToMulaw, resample24kTo8k, } from "../plugins/tts-openai/index.js";
