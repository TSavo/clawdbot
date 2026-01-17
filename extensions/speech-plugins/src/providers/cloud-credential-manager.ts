/**
 * Cloud Credential Manager
 *
 * Handles secure storage, retrieval, and validation of API credentials
 * for cloud-based voice providers.
 *
 * Features:
 * - Encrypted credential storage
 * - Credential validation
 * - Environment variable fallback
 * - Token refresh management
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface CloudCredential {
  provider: string;
  apiKey: string;
  endpoint?: string;
  token?: string;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface CredentialStore {
  version: string;
  credentials: Map<string, CloudCredential>;
  lastUpdated: number;
}

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const CREDENTIAL_FILE_NAME = 'cloud-credentials.enc';
const CREDENTIAL_DIR = path.join(os.homedir(), '.clawdbot', 'credentials');

/**
 * Cloud Credential Manager
 *
 * Provides secure credential storage and retrieval for cloud voice providers.
 */
export class CloudCredentialManager {
  private store: CredentialStore;
  private encryptionKey: Buffer | null = null;
  private storePath: string;

  constructor(storePath?: string) {
    this.storePath = storePath || path.join(CREDENTIAL_DIR, CREDENTIAL_FILE_NAME);
    this.store = {
      version: '1.0',
      credentials: new Map(),
      lastUpdated: Date.now(),
    };
  }

  /**
   * Initialize credential manager and load existing credentials
   */
  async initialize(encryptionKey?: string): Promise<void> {
    // Create credential directory if it doesn't exist
    if (!fs.existsSync(CREDENTIAL_DIR)) {
      fs.mkdirSync(CREDENTIAL_DIR, { recursive: true, mode: 0o700 });
    }

    // Set up encryption key
    if (encryptionKey) {
      // Derive key from provided password
      this.encryptionKey = crypto
        .pbkdf2Sync(encryptionKey, Buffer.alloc(16), 100000, 32, 'sha256');
    } else {
      // Try to load from environment
      const envKey = process.env.CLAWDBOT_CREDENTIAL_KEY;
      if (envKey) {
        this.encryptionKey = crypto
          .pbkdf2Sync(envKey, Buffer.alloc(16), 100000, 32, 'sha256');
      } else {
        // Use default key (not recommended for production)
        this.encryptionKey = crypto
          .pbkdf2Sync('default-clawdbot-key', Buffer.alloc(16), 100000, 32, 'sha256');
      }
    }

    // Load existing credentials if file exists
    if (fs.existsSync(this.storePath)) {
      try {
        const encryptedData = fs.readFileSync(this.storePath);
        await this.decryptStore(encryptedData);
      } catch (error) {
        console.warn('Failed to load existing credentials:', error);
        // Start with fresh store on decrypt failure
        this.store = {
          version: '1.0',
          credentials: new Map(),
          lastUpdated: Date.now(),
        };
      }
    }
  }

  /**
   * Store a credential securely
   */
  async storeCredential(credential: CloudCredential): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('Credential manager not initialized');
    }

    // Validate credential
    if (!credential.provider || !credential.apiKey) {
      throw new Error('Invalid credential: provider and apiKey are required');
    }

    // Store credential
    this.store.credentials.set(credential.provider, credential);
    this.store.lastUpdated = Date.now();

    // Persist to disk
    await this.persistStore();
  }

  /**
   * Retrieve a credential
   */
  async getCredential(provider: string): Promise<CloudCredential | null> {
    const credential = this.store.credentials.get(provider);

    if (!credential) {
      // Try environment variables as fallback
      return this.getCredentialFromEnv(provider);
    }

    // Check if token is expired
    if (credential.expiresAt && credential.expiresAt < Date.now()) {
      console.warn(`Credential for ${provider} has expired`);
      return null;
    }

    return credential;
  }

  /**
   * Get credential from environment variables
   */
  private getCredentialFromEnv(provider: string): CloudCredential | null {
    const envKeyMap: Record<string, string> = {
      deepgram: 'DEEPGRAM_API_KEY',
      elevenlabs: 'ELEVENLABS_API_KEY',
      cartesia: 'CARTESIA_API_KEY',
    };

    const envKey = envKeyMap[provider];
    if (!envKey) {
      return null;
    }

    const apiKey = process.env[envKey];
    if (!apiKey) {
      return null;
    }

    return {
      provider,
      apiKey,
      metadata: { source: 'environment' },
    };
  }

  /**
   * Validate API key by making a test request
   */
  async validateCredential(
    provider: string,
    credential: CloudCredential,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      switch (provider.toLowerCase()) {
        case 'deepgram':
          return await this.validateDeepgramKey(credential);
        case 'elevenlabs':
          return await this.validateElevenLabsKey(credential);
        case 'cartesia':
          return await this.validateCartesiaKey(credential);
        default:
          return { valid: false, error: `Unknown provider: ${provider}` };
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Validate Deepgram API key
   */
  private async validateDeepgramKey(credential: CloudCredential): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      const endpoint = credential.endpoint || 'https://api.deepgram.com/v1/models';
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${credential.apiKey}`,
        },
      });

      return {
        valid: response.ok,
        error: !response.ok ? `HTTP ${response.status}` : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Validate ElevenLabs API key
   */
  private async validateElevenLabsKey(credential: CloudCredential): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      const endpoint = credential.endpoint || 'https://api.elevenlabs.io/v1/voices';
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'xi-api-key': credential.apiKey,
        },
      });

      return {
        valid: response.ok,
        error: !response.ok ? `HTTP ${response.status}` : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Validate CartesiaAI API key
   */
  private async validateCartesiaKey(credential: CloudCredential): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      const endpoint = credential.endpoint || 'wss://api.cartesia.ai/websocket';
      // For WebSocket, we can only validate the URL is reachable
      // Full validation would require opening WebSocket and authentication
      const response = await fetch(endpoint.replace('wss://', 'https://').replace('/websocket', '/health'), {
        method: 'GET',
        headers: {
          'X-API-Key': credential.apiKey,
        },
      });

      return {
        valid: response.ok || response.status === 404, // 404 is acceptable if endpoint doesn't have health check
        error: !response.ok && response.status !== 404 ? `HTTP ${response.status}` : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update token with refresh mechanism
   */
  async updateToken(
    provider: string,
    newToken: string,
    expiresIn: number,
  ): Promise<void> {
    const credential = this.store.credentials.get(provider);
    if (!credential) {
      throw new Error(`Credential for ${provider} not found`);
    }

    credential.token = newToken;
    credential.expiresAt = Date.now() + expiresIn * 1000;

    await this.storeCredential(credential);
  }

  /**
   * List all stored credentials (provider names only)
   */
  async listCredentials(): Promise<string[]> {
    return Array.from(this.store.credentials.keys());
  }

  /**
   * Delete a credential
   */
  async deleteCredential(provider: string): Promise<void> {
    this.store.credentials.delete(provider);
    this.store.lastUpdated = Date.now();
    await this.persistStore();
  }

  /**
   * Clear all credentials
   */
  async clearAll(): Promise<void> {
    this.store.credentials.clear();
    this.store.lastUpdated = Date.now();
    await this.persistStore();
  }

  /**
   * Encrypt and persist store to disk
   */
  private async persistStore(): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set');
    }

    try {
      // Serialize store
      const storeData = {
        version: this.store.version,
        credentials: Array.from(this.store.credentials.entries()),
        lastUpdated: this.store.lastUpdated,
      };

      const plaintext = JSON.stringify(storeData);

      // Generate IV and encrypt
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Combine IV, auth tag, and encrypted data
      const combined = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'hex'),
      ]);

      // Write to file with secure permissions
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }

      fs.writeFileSync(this.storePath, combined, { mode: 0o600 });
    } catch (error) {
      throw new Error(
        `Failed to persist credentials: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Decrypt store from disk
   */
  private async decryptStore(encryptedData: Buffer): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set');
    }

    try {
      // Extract IV (first 12 bytes), auth tag (next 16 bytes), and encrypted data (rest)
      const iv = encryptedData.subarray(0, 12);
      const authTag = encryptedData.subarray(12, 28);
      const encrypted = encryptedData.subarray(28);

      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted).toString('utf8');
      decrypted += decipher.final().toString('utf8');

      const storeData = JSON.parse(decrypted);

      // Reconstruct store with Map
      this.store = {
        version: storeData.version || '1.0',
        credentials: new Map(storeData.credentials || []),
        lastUpdated: storeData.lastUpdated || Date.now(),
      };
    } catch (error) {
      throw new Error(
        `Failed to decrypt credentials: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get store path for testing
   */
  getStorePath(): string {
    return this.storePath;
  }
}

/**
 * Singleton instance for application-wide use
 */
let credentialManager: CloudCredentialManager | null = null;

export async function getCredentialManager(): Promise<CloudCredentialManager> {
  if (!credentialManager) {
    credentialManager = new CloudCredentialManager();
    await credentialManager.initialize();
  }
  return credentialManager;
}

export function setCredentialManager(manager: CloudCredentialManager): void {
  credentialManager = manager;
}
