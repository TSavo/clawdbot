/**
 * Voice Settings Example Implementation
 *
 * Complete example of integrating all voice provider management components
 * into a single page. This demonstrates the full workflow for managing
 * voice providers, testing them, and configuring fallback chains.
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  loadVoiceProviders,
  loadVoiceConfig,
  saveVoiceConfig,
  loadProviderStatus,
  type VoiceProvider,
  type VoiceConfig,
  type ProviderStatus,
} from "../controllers/voice";
import type { ClawdbotApp } from "../app";

/**
 * Complete voice settings page with all components integrated
 */
@customElement("voice-settings-page")
export class VoiceSettingsPage extends LitElement {
  static override styles = css`
    :host {
      display: block;
      --primary-color: #3b82f6;
      --bg-primary: #ffffff;
      --bg-secondary: #f9fafb;
      --text-primary: #111827;
      --text-secondary: #6b7280;
      --border-color: #e5e7eb;
    }

    .page-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 24px;
    }

    .page-header {
      margin-bottom: 32px;
    }

    .page-title {
      font-size: 32px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 8px 0;
    }

    .page-subtitle {
      font-size: 16px;
      color: var(--text-secondary);
      margin: 0;
    }

    .tabs {
      display: flex;
      gap: 0;
      border-bottom: 2px solid var(--border-color);
      margin-bottom: 24px;
    }

    .tab {
      padding: 12px 16px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }

    .tab:hover {
      color: var(--text-primary);
    }

    .tab.active {
      color: var(--primary-color);
      border-bottom-color: var(--primary-color);
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    .section {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 16px 0;
    }

    .provider-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .provider-card {
      padding: 16px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
    }

    .card-title {
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
    }

    .status-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }

    .status-card {
      padding: 12px;
      background: var(--bg-secondary);
      border-radius: 4px;
      border-left: 3px solid var(--primary-color);
    }

    .status-label {
      font-size: 12px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .status-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .loading-spinner {
      text-align: center;
      padding: 24px;
      color: var(--text-secondary);
    }

    .action-buttons {
      display: flex;
      gap: 8px;
      margin-top: 16px;
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
    }

    button:hover:not(:disabled) {
      background: #2563eb;
    }

    button.secondary {
      background: transparent;
      color: var(--primary-color);
      border: 1px solid var(--primary-color);
    }

    button.secondary:hover {
      background: rgba(59, 130, 246, 0.05);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  @property({ type: Object }) host?: ClawdbotApp;

  @state() private activeTab = "overview";
  @state() private providers: VoiceProvider[] = [];
  @state() private config: VoiceConfig | null = null;
  @state() private statuses: Map<string, ProviderStatus> = new Map();
  @state() private loading = true;
  @state() private saving = false;

  override async connectedCallback() {
    super.connectedCallback();
    await this.loadData();
  }

  private async loadData() {
    if (!this.host) return;

    this.loading = true;

    try {
      const [providers, config] = await Promise.all([
        loadVoiceProviders(this.host),
        loadVoiceConfig(this.host),
      ]);

      this.providers = providers;
      this.config = config;

      // Load status for all providers
      await Promise.all(
        providers.map(async (provider) => {
          const status = await loadProviderStatus(this.host!, provider.id);
          if (status) {
            this.statuses.set(provider.id, status);
          }
        }),
      );
    } catch (err) {
      console.error("Failed to load voice settings:", err);
    } finally {
      this.loading = false;
    }
  }

  private async handleSave() {
    if (!this.config || !this.host) return;

    this.saving = true;

    try {
      await saveVoiceConfig(this.host, this.config);
      // Show success message
      alert("Voice configuration saved successfully!");
    } catch (err) {
      console.error("Failed to save configuration:", err);
      alert("Failed to save configuration");
    } finally {
      this.saving = false;
    }
  }

  private renderOverviewTab() {
    if (this.loading) {
      return html`
        <div class="section">
          <div class="loading-spinner">Loading voice settings...</div>
        </div>
      `;
    }

    const sttProvider = this.providers.find(
      (p) => p.id === this.config?.sttProvider.provider,
    );
    const ttsProvider = this.providers.find(
      (p) => p.id === this.config?.ttsProvider.provider,
    );
    const sttStatus = sttProvider
      ? this.statuses.get(sttProvider.id)
      : null;
    const ttsStatus = ttsProvider
      ? this.statuses.get(ttsProvider.id)
      : null;

    return html`
      <div class="section">
        <div class="section-title">System Status</div>
        <div class="status-summary">
          <div class="status-card">
            <div class="status-label">STT Provider</div>
            <div class="status-value">${sttProvider?.name || "Not configured"}</div>
          </div>
          <div class="status-card">
            <div class="status-label">TTS Provider</div>
            <div class="status-value">${ttsProvider?.name || "Not configured"}</div>
          </div>
          <div class="status-card">
            <div class="status-label">System Status</div>
            <div class="status-value">
              ${sttStatus?.healthy && ttsStatus?.healthy ? "Healthy" : "Check providers"}
            </div>
          </div>
          <div class="status-card">
            <div class="status-label">Fallback Chain</div>
            <div class="status-value">
              ${this.config?.fallbackChain?.length || 0} provider(s)
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Active Providers</div>
        <div class="provider-grid">
          ${this.providers
            .filter((p) => p.status === "available")
            .map(
              (provider) => html`
                <div class="provider-card">
                  <div class="card-title">${provider.name}</div>
                  <div>${provider.description}</div>
                  <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                    ${provider.capabilities.join(", ")}
                  </div>
                </div>
              `,
            )}
        </div>
      </div>
    `;
  }

  private renderConfigurationTab() {
    if (!this.config) return html``;

    return html`
      <voice-settings-panel .host=${this.host}></voice-settings-panel>

      <div class="action-buttons">
        <button
          @click=${this.handleSave}
          ?disabled=${this.saving}
        >
          ${this.saving ? "Saving..." : "Save Configuration"}
        </button>
        <button class="secondary" @click=${() => this.loadData()}>
          Reload
        </button>
      </div>
    `;
  }

  private renderTestingTab() {
    if (!this.config) return html``;

    return html`
      <div class="section">
        <div class="section-title">Provider Testing</div>
        <voice-test-interface
          sttProviderId=${this.config.sttProvider.provider}
          ttsProviderId=${this.config.ttsProvider.provider}
          .host=${this.host}
        ></voice-test-interface>
      </div>
    `;
  }

  private renderStatusTab() {
    return html`
      <div class="section">
        <div class="section-title">Provider Status</div>
        ${this.providers.map(
          (provider) => html`
            <provider-status-display
              providerId=${provider.id}
              providerName=${provider.name}
              .host=${this.host}
            ></provider-status-display>
          `,
        )}
      </div>
    `;
  }

  private renderFallbackTab() {
    if (!this.config) return html``;

    return html`
      <div class="section">
        <div class="section-title">Fallback Chain Management</div>
        <fallback-chain-manager
          .providers=${this.providers}
          .chainProviders=${this.config.fallbackChain || []}
          @chain-updated=${(e: CustomEvent) => {
            if (this.config) {
              this.config.fallbackChain = e.detail.chain;
            }
          }}
        ></fallback-chain-manager>
      </div>
    `;
  }

  override render() {
    return html`
      <div class="page-container">
        <div class="page-header">
          <h1 class="page-title">Voice Provider Management</h1>
          <p class="page-subtitle">
            Configure speech-to-text and text-to-speech providers, manage failover chains,
            and test provider capabilities
          </p>
        </div>

        <div class="tabs">
          <button
            class="tab ${this.activeTab === "overview" ? "active" : ""}"
            @click=${() => (this.activeTab = "overview")}
          >
            Overview
          </button>
          <button
            class="tab ${this.activeTab === "configuration" ? "active" : ""}"
            @click=${() => (this.activeTab = "configuration")}
          >
            Configuration
          </button>
          <button
            class="tab ${this.activeTab === "testing" ? "active" : ""}"
            @click=${() => (this.activeTab = "testing")}
          >
            Testing
          </button>
          <button
            class="tab ${this.activeTab === "status" ? "active" : ""}"
            @click=${() => (this.activeTab = "status")}
          >
            Status
          </button>
          <button
            class="tab ${this.activeTab === "fallback" ? "active" : ""}"
            @click=${() => (this.activeTab = "fallback")}
          >
            Fallback Chain
          </button>
        </div>

        <div class="tab-content ${this.activeTab === "overview" ? "active" : ""}">
          ${this.renderOverviewTab()}
        </div>

        <div class="tab-content ${this.activeTab === "configuration" ? "active" : ""}">
          ${this.renderConfigurationTab()}
        </div>

        <div class="tab-content ${this.activeTab === "testing" ? "active" : ""}">
          ${this.renderTestingTab()}
        </div>

        <div class="tab-content ${this.activeTab === "status" ? "active" : ""}">
          ${this.renderStatusTab()}
        </div>

        <div class="tab-content ${this.activeTab === "fallback" ? "active" : ""}">
          ${this.renderFallbackTab()}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "voice-settings-page": VoiceSettingsPage;
  }
}
