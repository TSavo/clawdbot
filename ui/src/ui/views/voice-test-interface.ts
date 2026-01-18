/**
 * Voice Test Interface
 *
 * Component for testing STT and TTS providers.
 * Supports TTS text synthesis with audio playback and STT audio recording.
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  testTTSProvider,
  testSTTProvider,
  type VoiceTestResult,
} from "../controllers/voice";
import type { ClawdbotApp } from "../app";

@customElement("voice-test-interface")
export class VoiceTestInterface extends LitElement {
  static override styles = css`
    :host {
      display: block;
      --primary-color: #3b82f6;
      --success-color: #10b981;
      --error-color: #ef4444;
      --bg-secondary: #f9fafb;
      --text-primary: #111827;
      --text-secondary: #6b7280;
      --border-color: #e5e7eb;
    }

    .test-section {
      padding: 16px;
      background: var(--bg-secondary);
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .test-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
    }

    .test-input {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    input[type="text"],
    textarea {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: white;
      color: var(--text-primary);
      font-size: 13px;
      font-family: inherit;
    }

    input[type="text"]:focus,
    textarea:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    textarea {
      resize: vertical;
      min-height: 60px;
    }

    button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      background: var(--primary-color);
      color: white;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    button:hover:not(:disabled) {
      background: #2563eb;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .test-result {
      padding: 12px;
      border-radius: 4px;
      margin-top: 12px;
      font-size: 13px;
    }

    .test-result.success {
      background: rgba(16, 185, 129, 0.1);
      color: var(--success-color);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .test-result.error {
      background: rgba(239, 68, 68, 0.1);
      color: var(--error-color);
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .result-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .result-row:last-child {
      margin-bottom: 0;
    }

    .result-label {
      font-weight: 500;
      opacity: 0.8;
    }

    .audio-player {
      margin-top: 8px;
      width: 100%;
    }

    .audio-player audio {
      width: 100%;
      max-width: 400px;
      margin-top: 8px;
    }

    .recording-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background: var(--error-color);
      color: white;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .recording-dot {
      width: 8px;
      height: 8px;
      background: white;
      border-radius: 50%;
      animation: pulse 1s ease-in-out infinite;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .transcript-display {
      padding: 8px 12px;
      background: white;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      margin-top: 8px;
      font-size: 13px;
      color: var(--text-primary);
      font-style: italic;
    }
  `;

  @property({ type: String }) sttProviderId = "";
  @property({ type: String }) ttsProviderId = "";
  @property({ type: Object }) host?: ClawdbotApp;

  @state() private ttsText = "Hello, this is a test of the text-to-speech system.";
  @state() private ttsTesting = false;
  @state() private ttsResult: VoiceTestResult | null = null;
  @state() private sttRecording = false;
  @state() private sttTesting = false;
  @state() private sttResult: VoiceTestResult | null = null;
  @state() private audioContext: AudioContext | null = null;
  @state() private mediaRecorder: MediaRecorder | null = null;
  @state() private audioChunks: BlobPart[] = [];

  private async handleTestTTS() {
    if (!this.host || !this.ttsProviderId || !this.ttsText.trim()) {
      return;
    }

    this.ttsTesting = true;
    this.ttsResult = null;

    try {
      const result = await testTTSProvider(
        this.host,
        this.ttsProviderId,
        this.ttsText,
      );

      if (result) {
        this.ttsResult = result;
        if (result.success && result.audio) {
          // Result will include audio data for playback
          this.requestUpdate();
        }
      }
    } catch (err) {
      this.ttsResult = {
        success: false,
        provider: this.ttsProviderId,
        type: "tts",
        duration: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    } finally {
      this.ttsTesting = false;
    }
  }

  private async handleStartSTTRecording() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true },
      });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstart = () => {
        this.sttRecording = true;
        this.requestUpdate();
      };

      this.mediaRecorder.onstop = () => {
        this.sttRecording = false;
        this.requestUpdate();
      };

      this.mediaRecorder.start();
    } catch (err) {
      this.sttResult = {
        success: false,
        provider: this.sttProviderId,
        type: "stt",
        duration: 0,
        error:
          err instanceof Error
            ? err.message
            : "Failed to access microphone",
      };
    }
  }

  private async handleStopSTTRecording() {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.stop();

    // Get stream tracks and stop them
    const stream = this.mediaRecorder.stream;
    stream.getTracks().forEach((track) => track.stop());

    // Process audio after recording stops
    setTimeout(() => {
      this.handleSubmitSTTRecording();
    }, 100);
  }

  private async handleSubmitSTTRecording() {
    if (!this.host || !this.sttProviderId || this.audioChunks.length === 0) {
      return;
    }

    this.sttTesting = true;
    this.sttResult = null;

    try {
      const audioBlob = new Blob(this.audioChunks, { type: "audio/wav" });
      const audioBuffer = await audioBlob.arrayBuffer();

      const result = await testSTTProvider(
        this.host,
        this.sttProviderId,
        audioBuffer,
      );

      if (result) {
        this.sttResult = result;
      }
    } catch (err) {
      this.sttResult = {
        success: false,
        provider: this.sttProviderId,
        type: "stt",
        duration: 0,
        error: err instanceof Error ? err.message : "Test failed",
      };
    } finally {
      this.sttTesting = false;
      this.audioChunks = [];
    }
  }

  private renderTTSTest() {
    return html`
      <div class="test-section">
        <div class="test-title">Text-to-Speech (TTS) Test</div>

        <div class="test-input">
          <textarea
            placeholder="Enter text to synthesize..."
            .value=${this.ttsText}
            @input=${(e: Event) =>
              (this.ttsText = (e.target as HTMLTextAreaElement).value)}
            ?disabled=${this.ttsTesting}
          ></textarea>
        </div>

        <button
          @click=${this.handleTestTTS}
          ?disabled=${!this.ttsProviderId || this.ttsTesting}
        >
          ${this.ttsTesting
            ? html`<span class="spinner"></span> Testing...`
            : "Test TTS"}
        </button>

        ${this.ttsResult
          ? html`
              <div class="test-result ${this.ttsResult.success ? "success" : "error"}">
                <div class="result-row">
                  <span class="result-label">Status:</span>
                  <span>${this.ttsResult.success ? "Success" : "Failed"}</span>
                </div>
                <div class="result-row">
                  <span class="result-label">Duration:</span>
                  <span>${this.ttsResult.duration}ms</span>
                </div>
                ${this.ttsResult.error
                  ? html`
                      <div class="result-row">
                        <span class="result-label">Error:</span>
                        <span>${this.ttsResult.error}</span>
                      </div>
                    `
                  : ""}
                ${this.ttsResult.audio
                  ? html`
                      <div class="audio-player">
                        <audio controls>
                          <source
                            src="data:audio/mpeg;base64,${btoa(
                              String.fromCharCode(
                                ...new Uint8Array(
                                  (this.ttsResult.audio as any).data,
                                ),
                              ),
                            )}"
                          />
                          Your browser does not support audio playback.
                        </audio>
                      </div>
                    `
                  : ""}
              </div>
            `
          : ""}
      </div>
    `;
  }

  private renderSTTTest() {
    return html`
      <div class="test-section">
        <div class="test-title">Speech-to-Text (STT) Test</div>

        <button
          @click=${this.sttRecording
            ? this.handleStopSTTRecording
            : this.handleStartSTTRecording}
          ?disabled=${!this.sttProviderId || this.sttTesting}
        >
          ${this.sttRecording
            ? html`
                <span class="recording-dot"></span>
                Stop Recording
              `
            : "Start Recording"}
        </button>

        ${this.sttRecording
          ? html`
              <div class="recording-indicator">
                <span class="recording-dot"></span>
                Recording...
              </div>
            `
          : ""}

        ${this.sttResult
          ? html`
              <div class="test-result ${this.sttResult.success ? "success" : "error"}">
                <div class="result-row">
                  <span class="result-label">Status:</span>
                  <span>${this.sttResult.success ? "Success" : "Failed"}</span>
                </div>
                <div class="result-row">
                  <span class="result-label">Duration:</span>
                  <span>${this.sttResult.duration}ms</span>
                </div>
                ${this.sttResult.error
                  ? html`
                      <div class="result-row">
                        <span class="result-label">Error:</span>
                        <span>${this.sttResult.error}</span>
                      </div>
                    `
                  : ""}
                ${this.sttResult.transcript
                  ? html`
                      <div class="transcript-display">
                        "${this.sttResult.transcript}"
                      </div>
                    `
                  : ""}
              </div>
            `
          : ""}
      </div>
    `;
  }

  override render() {
    return html` ${this.renderTTSTest()} ${this.renderSTTTest()} `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "voice-test-interface": VoiceTestInterface;
  }
}
