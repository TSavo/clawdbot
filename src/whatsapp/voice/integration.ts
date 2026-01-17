/**
 * WhatsApp Voice Message Integration
 *
 * Handles voice message detection, transcription, and response generation
 * with automatic voice/text response based on configuration.
 *
 * Follows the same pattern as Discord, Telegram, Slack, and Signal voice integration.
 *
 * WhatsApp Cloud API webhook structure:
 * - Message type: "audio"
 * - Contains media_id for the audio file
 * - Audio format: typically OGG/Opus (32kbps, 48kHz, mono)
 */

import type { RuntimeEnv } from '../../runtime.js';
import { WhatsAppVoiceMessageHandler, type WhatsAppVoiceFile } from './message-handler.js';
import { WhatsAppVoiceResponseHandler } from './response-handler.js';
import { logVerbose } from '../../globals.js';
import { VoiceProviderRegistry } from '../../media/voice-providers/registry.js';
import type { VoiceProvidersConfig } from '../../config/zod-schema.voice-providers.js';

/**
 * Check if a WhatsApp message contains audio attachment
 */
export function hasVoiceAttachment(message: { audio?: { media_id?: string; mime_type?: string } }): boolean {
  return message.audio !== undefined && message.audio.media_id !== undefined;
}

/**
 * Extract voice attachment from WhatsApp message
 *
 * WhatsApp webhook provides audio object with media_id and mime_type
 */
export function extractVoiceAttachment(message: {
  audio?: { media_id?: string; mime_type?: string };
}): WhatsAppVoiceFile | null {
  if (!message.audio || !message.audio.media_id) {
    return null;
  }

  return {
    id: message.audio.media_id,
    mimetype: message.audio.mime_type || 'audio/ogg',
    timestamp: Date.now(),
  };
}

/**
 * Check if a WhatsApp message contains voice attachments
 * Useful for filtering messages before full processing
 */
export function shouldHandleWhatsAppVoiceMessage(message: {
  audio?: { media_id?: string; mime_type?: string };
}): boolean {
  return hasVoiceAttachment(message);
}

/**
 * Handle WhatsApp voice message with transcription and voice response
 *
 * This function:
 * 1. Detects voice files in WhatsApp messages
 * 2. Downloads and transcribes the audio from WhatsApp Cloud API
 * 3. Generates a response using the configured agent
 * 4. Sends voice/text/both response based on configuration
 *
 * @param params Voice message handling parameters
 * @returns True if voice message was handled, false otherwise
 *
 * Example usage:
 * ```typescript
 * const handled = await handleWhatsAppVoiceMessage({
 *   message: { audio: { media_id: '123', mime_type: 'audio/ogg' } },
 *   apiToken: process.env.WHATSAPP_API_TOKEN,
 *   businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
 *   phoneNumber: user.phone,
 *   providersConfig: voiceConfig,
 *   replyFn: async (transcribed) => {
 *     // Generate response from transcribed text
 *     return await agent.chat(transcribed);
 *   },
 *   sendFn: async ({ voiceBuffer, text }) => {
 *     // Send response back to user
 *     await sendMessage(phoneNumber, { voice: voiceBuffer, text });
 *   },
 * });
 * ```
 */
export async function handleWhatsAppVoiceMessage(params: {
  message: { audio?: { media_id?: string; mime_type?: string } };
  apiToken: string;
  businessAccountId: string;
  phoneNumber?: string;
  providersConfig?: VoiceProvidersConfig;
  runtime?: RuntimeEnv;
  /**
   * Function to generate reply text from transcribed message
   * Should return the response text to be sent
   */
  replyFn: (transcribedText: string) => Promise<string>;
  /**
   * Function to send the final message(s) to WhatsApp
   * Receives text and/or voice response
   */
  sendFn: (params: { voiceBuffer?: Buffer; text?: string }) => Promise<void>;
  /**
   * Enable voice response synthesis (optional)
   */
  enableVoiceResponse?: boolean;
}): Promise<boolean> {
  const {
    message,
    apiToken,
    businessAccountId,
    phoneNumber,
    providersConfig,
    runtime,
    replyFn,
    sendFn,
    enableVoiceResponse,
  } = params;

  // Check for voice file
  const voiceFile = extractVoiceAttachment(message);
  if (!voiceFile) {
    return false;
  }

  logVerbose(
    `whatsapp-voice: detected voice file (id: ${voiceFile.id}, mime: ${voiceFile.mimetype})`,
  );

  // Initialize voice provider registry
  const registry = new VoiceProviderRegistry();
  if (providersConfig) {
    await registry.loadProviders(providersConfig);
  }

  try {
    // Create message handler to download audio
    const effectiveRuntime: RuntimeEnv = runtime || {
      log: console.log,
      error: console.error,
      exit: (code: number): never => {
        throw new Error(`exit ${code}`);
      },
    };
    const messageHandler = new WhatsAppVoiceMessageHandler(
      apiToken,
      businessAccountId,
      effectiveRuntime,
    );

    // Download the audio file from WhatsApp Cloud API
    const voiceContext = await messageHandler.downloadAudioFile(voiceFile);

    logVerbose(
      `whatsapp-voice: downloaded audio (format: ${voiceContext.format}, size: ${voiceContext.sizeBytes} bytes)`,
    );

    // Get STT provider with fallback
    const transcriber = await registry.getTranscriber();

    // Transcribe the audio
    const result = await transcriber.transcribe(voiceContext.audioPath as any, {
      format: voiceContext.format,
    });

    // Extract text from transcription result
    let transcribedText = '';
    if ('text' in result && typeof result.text === 'string') {
      transcribedText = result.text.trim();
    } else if ('transcript' in result && typeof result.transcript === 'string') {
      transcribedText = result.transcript.trim();
    }

    if (!transcribedText) {
      logVerbose('whatsapp-voice: empty transcription, skipping');
      await messageHandler.cleanup(voiceContext);
      return false;
    }

    logVerbose(`whatsapp-voice: transcribed text: "${transcribedText}"`);

    // Generate response text
    const responseText = await replyFn(transcribedText);
    if (!responseText) {
      logVerbose('whatsapp-voice: empty response text, skipping');
      await messageHandler.cleanup(voiceContext);
      return false;
    }

    logVerbose(`whatsapp-voice: sending response`);

    // Check if voice response is enabled
    if (enableVoiceResponse && phoneNumber) {
      // Try to send voice response
      try {
        const responseHandler = new WhatsAppVoiceResponseHandler(
          apiToken,
          businessAccountId,
          effectiveRuntime,
        );

        await responseHandler.sendVoiceResponse({
          phoneNumber,
          text: responseText,
          enableVoiceResponse: true,
        });
      } catch (voiceError) {
        // Voice synthesis failed, fallback to text
        logVerbose(
          `whatsapp-voice: voice synthesis failed, falling back to text: ${voiceError instanceof Error ? voiceError.message : String(voiceError)}`,
        );
        await sendFn({ text: responseText });
      }
    } else {
      // Send text-only response
      await sendFn({ text: responseText });
    }

    // Cleanup
    await messageHandler.cleanup(voiceContext);

    return true;
  } catch (error) {
    // Log error and fall back to text-only processing
    logVerbose(
      `whatsapp-voice: failed to handle voice message: ${error instanceof Error ? error.message : String(error)}`,
    );

    // Attempt text fallback if transcription succeeded but response failed
    try {
      await sendFn({
        text: 'Sorry, I encountered an error processing the voice message.',
      });
    } catch (fallbackError) {
      logVerbose(
        `whatsapp-voice: fallback text response failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
      );
    }

    return false;
  } finally {
    // Cleanup registry
    await registry.shutdown();
  }
}
