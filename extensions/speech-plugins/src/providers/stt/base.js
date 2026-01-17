/**
 * Base STT Plugin Wrapper
 *
 * Provides common functionality for wrapping STT executor implementations
 * and adapting them to the STTProvider interface.
 */
/**
 * Base class for STT plugin wrappers
 *
 * Bridges the gap between executor implementations and the STTProvider interface.
 */
export class BaseSTTPlugin {
    constructor(deploymentConfig) {
        this.executor = null;
        this.initialized = false;
        this.deploymentConfig = deploymentConfig;
    }
    /**
     * Map executor capabilities to STTCapabilities
     */
    mapCapabilities(executorCaps) {
        return {
            formats: executorCaps.supportedFormats.map((f) => f.toString()),
            sampleRates: executorCaps.supportedSampleRates,
            supportsStreaming: executorCaps.supportsStreaming,
            supportsPartialTranscripts: executorCaps.supportsStreaming,
            languages: executorCaps.supportedLanguages,
            maxDurationSeconds: null, // Unlimited by default
        };
    }
    /**
     * Initialize the provider with configuration
     */
    async initialize(config) {
        if (this.initialized) {
            return;
        }
        // Create executor instance
        this.executor = this.createExecutor();
        // Initialize executor with deployment config if available
        if (this.executor && typeof this.executor.initialize === 'function') {
            await this.executor.initialize();
        }
        this.initialized = true;
    }
    /**
     * Transcribe audio from buffer
     */
    async transcribe(audioBuffer, options) {
        if (!this.executor) {
            throw new Error('Executor not initialized. Call initialize() first.');
        }
        // Convert Buffer to AudioBuffer format expected by executor
        const executorAudio = {
            data: new Uint8Array(audioBuffer),
            format: this.parseAudioFormat(options?.format),
            sampleRate: options?.sampleRate ?? 16000,
            duration: this.estimateDuration(audioBuffer.length, options?.sampleRate ?? 16000),
            channels: 1,
        };
        // Execute transcription
        const result = await this.executor.transcribe(executorAudio, {
            language: options?.language,
            format: this.parseAudioFormat(options?.format),
        });
        // Convert to STTTranscriptSegment format
        return [
            {
                text: result.text,
                confidence: result.confidence ?? 0.0,
                startMs: 0,
                endMs: result.duration,
                isFinal: true,
                language: result.language,
            },
        ];
    }
    /**
     * Transcribe audio from stream with callbacks
     */
    async transcribeStream(stream, callbacks, options) {
        if (!this.executor) {
            throw new Error('Executor not initialized. Call initialize() first.');
        }
        try {
            // Convert NodeJS.ReadableStream to ReadableStream<AudioBuffer>
            const audioStream = this.convertToAudioStream(stream, options?.format, options?.sampleRate);
            // Process stream chunks
            const iterator = this.executor.transcribeStream(audioStream, {
                language: options?.language,
                format: this.parseAudioFormat(options?.format),
            });
            const segments = [];
            for await (const chunk of iterator) {
                const segment = this.convertChunkToSegment(chunk);
                segments.push(segment);
                // Trigger callbacks
                if (chunk.partial && callbacks.onPartial) {
                    callbacks.onPartial(chunk.text);
                }
                if (callbacks.onTranscript) {
                    const event = {
                        type: 'transcript',
                        segments: [segment],
                    };
                    callbacks.onTranscript(event);
                }
            }
            // Trigger completion callback
            if (callbacks.onComplete) {
                callbacks.onComplete(segments);
            }
            // Send final completion event
            if (callbacks.onTranscript) {
                const event = {
                    type: 'complete',
                    segments,
                };
                callbacks.onTranscript(event);
            }
        }
        catch (error) {
            const errorEvent = {
                type: 'error',
                error: {
                    code: 'TRANSCRIPTION_FAILED',
                    message: error instanceof Error ? error.message : String(error),
                },
            };
            if (callbacks.onError) {
                callbacks.onError(errorEvent.error);
            }
            if (callbacks.onTranscript) {
                callbacks.onTranscript(errorEvent);
            }
            throw error;
        }
    }
    /**
     * Clean up resources
     */
    async shutdown() {
        if (this.executor && typeof this.executor.shutdown === 'function') {
            await this.executor.shutdown();
        }
        this.initialized = false;
        this.executor = null;
    }
    /**
     * Convert string format to AudioFormat enum
     */
    parseAudioFormat(format) {
        // Import AudioFormat enum from executor
        const { AudioFormat } = require('../../../../../src/media/voice-providers/executor.js');
        if (!format)
            return AudioFormat.PCM_16;
        switch (format.toLowerCase()) {
            case 'wav':
            case 'pcm16':
            case 'pcm_16':
                return AudioFormat.PCM_16;
            case 'opus':
                return AudioFormat.OPUS;
            case 'aac':
                return AudioFormat.AAC;
            case 'mp3':
                return AudioFormat.MP3;
            case 'ogg':
            case 'vorbis':
                return AudioFormat.VORBIS;
            default:
                return AudioFormat.PCM_16;
        }
    }
    /**
     * Estimate audio duration from buffer length and sample rate
     */
    estimateDuration(bufferLength, sampleRate) {
        // Assume PCM_16 format (2 bytes per sample)
        const sampleCount = bufferLength / 2;
        return (sampleCount / sampleRate) * 1000; // Return in milliseconds
    }
    /**
     * Convert NodeJS.ReadableStream to ReadableStream<AudioBuffer>
     */
    convertToAudioStream(nodeStream, format, sampleRate) {
        const audioFormat = this.parseAudioFormat(format);
        const rate = sampleRate ?? 16000;
        return new ReadableStream({
            start: async (controller) => {
                nodeStream.on('data', (chunk) => {
                    const audioBuffer = {
                        data: new Uint8Array(chunk),
                        format: audioFormat,
                        sampleRate: rate,
                        duration: this.estimateDuration(chunk.length, rate),
                        channels: 1,
                    };
                    controller.enqueue(audioBuffer);
                });
                nodeStream.on('end', () => {
                    controller.close();
                });
                nodeStream.on('error', (error) => {
                    controller.error(error);
                });
            },
        });
    }
    /**
     * Convert TranscriptionChunk to STTTranscriptSegment
     */
    convertChunkToSegment(chunk) {
        return {
            text: chunk.text,
            confidence: 0.0, // Not available in chunk
            startMs: chunk.timestamp,
            endMs: chunk.timestamp,
            isFinal: !chunk.partial,
        };
    }
}
//# sourceMappingURL=base.js.map