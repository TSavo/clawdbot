/**
 * Voice Settings Panel
 *
 * Main voice settings container component built with Lit.
 * Manages STT/TTS provider selection, configuration, and testing.
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  loadVoiceProviders,
  loadVoiceConfig,
  saveVoiceConfig,
  loadProviderStatus,
  loadProviderCapabilities,
  testTTSProvider,
  testSTTProvider,
  type VoiceProvider,
  type VoiceConfig,
  type ProviderStatus,
  type VoiceTestResult,
} from "../controllers/voice";
import type { ClawdbotApp } from "../app";

@customElement("voice-settings-panel")
export class VoiceSettingsPanel extends LitElement {
  static override styles = css`
    :host {
      display: block;
      --primary-color: #3b82f6;
      --success-color: #10b981;
      --error-color: #ef4444;
      --warning-color: #f59e0b;
      --bg-primary: #ffffff;
      --bg-secondary: #f9fafb;
      --text-primary: #111827;
      --text-secondary: #6b7280;
      --border-color: #e5e7eb;
      --shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .panel {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
      background: var(--bg-primary);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }

    .header {
      margin-bottom: 32px;
    }

    .title {
      font-size: 24px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 8px 0;
    }

    .description {
      font-size: 14px;
      color: var(--text-secondary);
      margin: 0;
    }

    .section {
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border-color);
    }

    .section:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 16px;
    }

    .provider-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }

    .provider-field {
      display: flex;
      flex-direction: column;
    }

    .field-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .field-value {
      font-size: 14px;
      color: var(--text-primary);
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--bg-secondary);
    }

    select {
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 14px;
      cursor: pointer;
    }

    select:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-badge.available {
      background: rgba(16, 185, 129, 0.1);
      color: var(--success-color);
    }

    .status-badge.unavailable {
      background: rgba(239, 68, 68, 0.1);
      color: var(--error-color);
    }

    .status-badge.error {
      background: rgba(245, 158, 11, 0.1);
      color: var(--warning-color);
    }

    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }

    .status-badge.available .status-indicator {
      background: var(--success-color);
    }

    .status-badge.unavailable .status-indicator,
    .status-badge.error .status-indicator {
      background: var(--error-color);
    }

    .button-group {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }

    button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary {
      background: var(--primary-color);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #2563eb;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }

    .btn-secondary {
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
    }

    .btn-secondary:hover:not(:disabled) {
      background: #f3f4f6;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .loading {
      display: inline-block;
      margin-left: 8px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .alert {
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 16px;
      font-size: 14px;
    }

    .alert.error {
      background: rgba(239, 68, 68, 0.1);
      color: var(--error-color);
      border-left: 3px solid var(--error-color);
    }

    .alert.success {
      background: rgba(16, 185, 129, 0.1);
      color: var(--success-color);
      border-left: 3px solid var(--success-color);
    }

    .alert.warning {
      background: rgba(245, 158, 11, 0.1);
      color: var(--warning-color);
      border-left: 3px solid var(--warning-color);
    }

    .capability-info {
      background: var(--bg-secondary);
      padding: 12px 16px;
      border-radius: 4px;
      margin-top: 8px;
      font-size: 13px;
      color: var(--text-secondary);
    }
  `;

  @property({ type: Object }) host?: ClawdbotApp;
  @state() private providers: VoiceProvider[] = [];
  @state() private config: VoiceConfig | null = null;
  @state() private loading = true;
  @state() private saving = false;
  @state() private error: string | null = null;
  @state() private success: string | null = null;
  @state() private providerStatuses: Map<string, ProviderStatus> = new Map();
  @state() private selectedSTTStatus: ProviderStatus | null = null;
  @state() private selectedTTSStatus: ProviderStatus | null = null;
  @state() private expandedProviders: Set<string> = new Set();

  override async connectedCallback() {
    super.connectedCallback();
    await this.loadData();
  }

  private async loadData() {
    if (!this.host) return;

    this.loading = true;
    this.error = null;

    try {
      const [providers, config] = await Promise.all([
        loadVoiceProviders(this.host),
        loadVoiceConfig(this.host),
      ]);

      this.providers = providers;
      this.config = config;

      // Load status for each provider
      await Promise.all(
        providers.map(async (provider) => {
          const status = await loadProviderStatus(this.host!, provider.id);
          if (status) {
            this.providerStatuses.set(provider.id, status);
          }
        }),
      );

      // Load current provider statuses
      if (config) {
        const sttStatus = await loadProviderStatus(
          this.host,
          config.sttProvider.provider,
        );
        if (sttStatus) this.selectedSTTStatus = sttStatus;

        const ttsStatus = await loadProviderStatus(
          this.host,
          config.ttsProvider.provider,
        );
        if (ttsStatus) this.selectedTTSStatus = ttsStatus;
      }
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : "Failed to load voice settings";
    } finally {
      this.loading = false;
    }
  }

  private async handleSTTProviderChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    if (!this.config) return;

    this.config = {
      ...this.config,
      sttProvider: {
        ...this.config.sttProvider,
        provider: select.value,
      },
    };

    // Load status for new provider
    if (this.host) {
      const status = await loadProviderStatus(this.host, select.value);
      if (status) this.selectedSTTStatus = status;
    }

    this.requestUpdate();
  }

  private async handleTTSProviderChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    if (!this.config) return;

    this.config = {
      ...this.config,
      ttsProvider: {
        ...this.config.ttsProvider,
        provider: select.value,
      },
    };

    // Load status for new provider
    if (this.host) {
      const status = await loadProviderStatus(this.host, select.value);
      if (status) this.selectedTTSStatus = status;
    }

    this.requestUpdate();
  }

  private async handleSave() {
    if (!this.config || !this.host) return;

    this.saving = true;
    this.error = null;
    this.success = null;

    try {
      const success = await saveVoiceConfig(this.host, this.config);
      if (success) {
        this.success = "Voice configuration saved successfully";
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } else {
        this.error = "Failed to save configuration";
      }
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : "Failed to save configuration";
    } finally {
      this.saving = false;
    }
  }

  private toggleProviderExpanded(providerId: string) {
    if (this.expandedProviders.has(providerId)) {
      this.expandedProviders.delete(providerId);
    } else {
      this.expandedProviders.add(providerId);
    }
    this.requestUpdate();
  }

  private renderProviderStatus() {
    if (!this.config) return html``;

    const sttProvider = this.providers.find(
      (p) => p.id === this.config!.sttProvider.provider,
    );
    const ttsProvider = this.providers.find(
      (p) => p.id === this.config!.ttsProvider.provider,
    );

    return html`
      <div class="section">
        <div class="section-title">Provider Status</div>

        ${sttProvider
          ? html`
              <div class="provider-row">
                <div class="provider-field">
                  <div class="field-label">STT Provider</div>
                  <div class="field-value">
                    ${sttProvider.name}
                    ${this.selectedSTTStatus
                      ? this.renderStatusBadge(
                          this.selectedSTTStatus.healthy ? "available" : "error",
                        )
                      : ""}
                  </div>
                </div>
              </div>
            `
          : ""}

        ${ttsProvider
          ? html`
              <div class="provider-row">
                <div class="provider-field">
                  <div class="field-label">TTS Provider</div>
                  <div class="field-value">
                    ${ttsProvider.name}
                    ${this.selectedTTSStatus
                      ? this.renderStatusBadge(
                          this.selectedTTSStatus.healthy ? "available" : "error",
                        )
                      : ""}
                  </div>
                </div>
              </div>
            `
          : ""}
      </div>
    `;
  }

  private renderStatusBadge(status: "available" | "unavailable" | "error") {
    const statusText = {
      available: "Available",
      unavailable: "Unavailable",
      error: "Error",
    };

    return html`
      <span class="status-badge ${status}">
        <span class="status-indicator"></span>
        ${statusText[status]}
      </span>
    `;
  }

  override render() {
    if (this.loading) {
      return html`
        <div class="panel">
          <div class="header">
            <h1 class="title">Voice Settings</h1>
            <p class="description">Loading voice provider configuration...</p>
          </div>
          <div class="loading">⏳</div>
        </div>
      `;
    }

    const sttProviders = this.providers.filter((p) => p.type === "stt");
    const ttsProviders = this.providers.filter((p) => p.type === "tts");

    return html`
      <div class="panel">
        <div class="header">
          <h1 class="title">Voice Settings</h1>
          <p class="description">
            Configure speech-to-text (STT) and text-to-speech (TTS) providers
          </p>
        </div>

        ${this.error
          ? html`<div class="alert error">${this.error}</div>`
          : ""}
        ${this.success
          ? html`<div class="alert success">${this.success}</div>`
          : ""}

        ${this.config
          ? html`
              <div class="section">
                <div class="section-title">Provider Selection</div>

                <div class="provider-row">
                  <div class="provider-field">
                    <label class="field-label">Speech-to-Text Provider</label>
                    <select
                      @change=${this.handleSTTProviderChange}
                      .value=${this.config.sttProvider.provider}
                    >
                      ${sttProviders.map(
                        (provider) =>
                          html`
                            <option value=${provider.id}>${provider.name}</option>
                          `,
                      )}
                    </select>
                  </div>

                  <div class="provider-field">
                    <label class="field-label">Text-to-Speech Provider</label>
                    <select
                      @change=${this.handleTTSProviderChange}
                      .value=${this.config.ttsProvider.provider}
                    >
                      ${ttsProviders.map(
                        (provider) =>
                          html`
                            <option value=${provider.id}>${provider.name}</option>
                          `,
                      )}
                    </select>
                  </div>
                </div>
              </div>

              ${this.renderProviderStatus()}

              <div class="button-group">
                <button
                  class="btn-primary"
                  @click=${this.handleSave}
                  ?disabled=${this.saving}
                >
                  ${this.saving ? html`Saving${html`<span class="loading">...</span>`}` : "Save Configuration"}
                </button>
                <button class="btn-secondary" @click=${this.loadData}>
                  Reload
                </button>
              </div>
            `
          : html`
              <div class="alert error">
                Failed to load voice configuration
              </div>
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "voice-settings-panel": VoiceSettingsPanel;
  }
}
