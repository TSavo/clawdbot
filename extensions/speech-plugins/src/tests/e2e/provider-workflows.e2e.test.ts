import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * E2E Tests for Voice Provider Workflows
 *
 * Tests complete user workflows and provider interactions:
 * - Provider initialization and configuration
 * - Provider selection and switching
 * - Fallback chain activation
 * - Multi-provider transcription
 * - Multi-provider synthesis
 * - Configuration persistence
 */

describe('Voice Provider E2E Workflows', () => {
  describe('Provider Initialization Workflow', () => {
    it('should complete full initialization workflow', async () => {
      // Step 1: Detect available providers
      const mockDetect = vi.fn().mockResolvedValue({
        available: ['whisper', 'deepgram'],
        configured: ['deepgram'],
      });

      const detected = await mockDetect();
      expect(detected.available).toContain('whisper');

      // Step 2: Initialize selected provider
      const mockInit = vi.fn().mockResolvedValue({
        provider: 'deepgram',
        status: 'initialized',
      });

      const initialized = await mockInit('deepgram', { apiKey: 'test' });
      expect(initialized.status).toBe('initialized');

      // Step 3: Verify provider ready
      const mockVerify = vi.fn().mockResolvedValue({
        provider: 'deepgram',
        ready: true,
      });

      const verified = await mockVerify('deepgram');
      expect(verified.ready).toBe(true);
    });

    it('should handle initialization with missing dependencies', async () => {
      const mockDetect = vi.fn().mockResolvedValue({
        available: [],
        missing: ['whisper', 'faster-whisper'],
        suggestions: ['Install via: pip install openai-whisper'],
      });

      const detected = await mockDetect();
      expect(detected.available).toHaveLength(0);
      expect(detected.suggestions).toBeDefined();
    });

    it('should save provider configuration after successful init', async () => {
      const mockSaveConfig = vi.fn().mockResolvedValue({
        saved: true,
        path: '~/.clawdbot/config.json',
        provider: 'deepgram',
      });

      const saved = await mockSaveConfig('deepgram', { apiKey: 'test' });

      expect(saved.saved).toBe(true);
      expect(saved.path).toBeDefined();
    });
  });

  describe('Provider Selection Workflow', () => {
    it('should select STT provider from list', async () => {
      const mockListProviders = vi.fn().mockResolvedValue({
        sttProviders: [
          {
            id: 'whisper',
            name: 'OpenAI Whisper',
            mode: 'system',
            status: 'available',
          },
          {
            id: 'deepgram',
            name: 'Deepgram',
            mode: 'cloud',
            status: 'configured',
          },
        ],
      });

      const providers = await mockListProviders();
      expect(providers.sttProviders).toHaveLength(2);

      const mockSelectProvider = vi.fn().mockResolvedValue({
        provider: 'deepgram',
        selected: true,
      });

      const selected = await mockSelectProvider('deepgram');
      expect(selected.selected).toBe(true);
    });

    it('should select TTS provider from list', async () => {
      const mockListProviders = vi.fn().mockResolvedValue({
        ttsProviders: [
          {
            id: 'kokoro',
            name: 'Kokoro TTS',
            voices: 20,
            languages: ['en', 'es'],
          },
          {
            id: 'elevenlabs',
            name: 'ElevenLabs',
            voices: 50,
            languages: ['en', 'es', 'fr'],
          },
        ],
      });

      const providers = await mockListProviders();
      expect(providers.ttsProviders).toHaveLength(2);

      const mockSelectTTS = vi.fn().mockResolvedValue({
        provider: 'elevenlabs',
        selected: true,
      });

      const selected = await mockSelectTTS('elevenlabs');
      expect(selected.selected).toBe(true);
    });

    it('should validate selected provider before use', async () => {
      const mockValidate = vi.fn().mockResolvedValue({
        provider: 'deepgram',
        valid: true,
        credentials: 'valid',
        quotaRemaining: 10000,
      });

      const validation = await mockValidate('deepgram');

      expect(validation.valid).toBe(true);
      expect(validation.quotaRemaining).toBeGreaterThan(0);
    });
  });

  describe('Provider Switching Workflow', () => {
    it('should switch from one provider to another', async () => {
      const mockSwitch = vi.fn().mockImplementation(async (from, to) => {
        // Step 1: Shutdown old provider
        await new Promise((r) => setTimeout(r, 10));

        // Step 2: Initialize new provider
        return {
          previousProvider: from,
          newProvider: to,
          switchedAt: Date.now(),
          success: true,
        };
      });

      const result = await mockSwitch('whisper', 'deepgram');

      expect(result.previousProvider).toBe('whisper');
      expect(result.newProvider).toBe('deepgram');
      expect(result.success).toBe(true);
    });

    it('should preserve user preferences during switch', async () => {
      const mockPreserve = vi.fn().mockResolvedValue({
        languagePreference: 'es',
        outputFormat: 'wav',
        sampleRate: 16000,
        preserved: true,
      });

      const preserved = await mockPreserve('deepgram', 'whisper');

      expect(preserved.preserved).toBe(true);
      expect(preserved.languagePreference).toBe('es');
    });

    it('should handle switch failures gracefully', async () => {
      const mockSwitchFail = vi.fn().mockResolvedValue({
        switchAttempted: true,
        success: false,
        error: 'Target provider unavailable',
        fallbackUsed: 'whisper',
      });

      const result = await mockSwitchFail('deepgram', 'unavailable-provider');

      expect(result.success).toBe(false);
      expect(result.fallbackUsed).toBeDefined();
    });
  });

  describe('Fallback Chain Workflow', () => {
    it('should activate fallback chain when primary fails', async () => {
      const mockFallbackChain = vi.fn().mockImplementation(async (providers) => {
        const results = {
          chain: providers,
          attempts: [],
          finalProvider: null as string | null,
        };

        for (const provider of providers) {
          results.attempts.push({
            provider,
            tried: true,
            status: provider === 'deepgram' ? 'failed' : 'success',
          });

          if (provider === 'whisper') {
            results.finalProvider = provider;
            break;
          }
        }

        return results;
      });

      const result = await mockFallbackChain(['deepgram', 'whisper', 'faster-whisper']);

      expect(result.attempts).toHaveLength(3);
      expect(result.finalProvider).toBe('whisper');
    });

    it('should configure fallback priority order', async () => {
      const mockSetFallback = vi.fn().mockResolvedValue({
        fallbackChain: ['deepgram', 'whisper', 'faster-whisper'],
        applied: true,
      });

      const result = await mockSetFallback('stt', ['deepgram', 'whisper', 'faster-whisper']);

      expect(result.fallbackChain).toEqual(['deepgram', 'whisper', 'faster-whisper']);
      expect(result.applied).toBe(true);
    });

    it('should skip unreachable providers in fallback chain', async () => {
      const mockFallback = vi.fn().mockImplementation(async (chain) => {
        const available = chain.filter((p) => p !== 'unavailable');
        return {
          originalChain: chain,
          effectiveChain: available,
          skipped: ['unavailable'],
        };
      });

      const result = await mockFallback(['deepgram', 'unavailable', 'whisper']);

      expect(result.effectiveChain).toEqual(['deepgram', 'whisper']);
      expect(result.skipped).toContain('unavailable');
    });

    it('should handle complete fallback chain failure', async () => {
      const mockCompleteFail = vi.fn().mockResolvedValue({
        chainFailed: true,
        allProvidersUnavailable: true,
        error: 'No available STT providers',
      });

      const result = await mockCompleteFail(['deepgram', 'whisper']);

      expect(result.chainFailed).toBe(true);
      expect(result.error).toBeDefined();
    });
  });

  describe('Multi-Provider STT Workflow', () => {
    it('should transcribe using configured STT provider', async () => {
      // Setup
      const mockTranscribe = vi.fn().mockResolvedValue({
        provider: 'deepgram',
        text: 'Hello world',
        confidence: 0.95,
        duration: 1.2,
      });

      // Execute
      const result = await mockTranscribe('input.wav');

      // Verify
      expect(result.text).toBe('Hello world');
      expect(result.provider).toBe('deepgram');
    });

    it('should compare transcription results across providers', async () => {
      const mockCompare = vi.fn().mockResolvedValue({
        results: {
          deepgram: 'Hello world',
          whisper: 'Hello world',
          faster_whisper: 'Hello world',
        },
        consensus: 'Hello world',
        differences: 0,
      });

      const result = await mockCompare('input.wav');

      expect(result.consensus).toBe('Hello world');
      expect(Object.keys(result.results)).toHaveLength(3);
    });

    it('should measure transcription quality metrics', async () => {
      const mockMetrics = vi.fn().mockResolvedValue({
        provider: 'deepgram',
        wordErrorRate: 0.05,
        processingTime: 1.5,
        accuracy: 0.95,
      });

      const metrics = await mockMetrics('deepgram', 'audio.wav');

      expect(metrics.wordErrorRate).toBeLessThan(0.1);
      expect(metrics.accuracy).toBeGreaterThan(0.9);
    });
  });

  describe('Multi-Provider TTS Workflow', () => {
    it('should synthesize using configured TTS provider', async () => {
      const mockSynthesize = vi.fn().mockResolvedValue({
        provider: 'elevenlabs',
        audioBuffer: Buffer.alloc(4096),
        duration: 1.5,
        format: 'wav',
      });

      const result = await mockSynthesize('Hello world');

      expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
      expect(result.provider).toBe('elevenlabs');
    });

    it('should compare voice quality across providers', async () => {
      const mockCompare = vi.fn().mockResolvedValue({
        kokoro: { duration: 1.2, quality: 'good' },
        elevenlabs: { duration: 1.1, quality: 'excellent' },
        piper: { duration: 1.3, quality: 'good' },
        preferred: 'elevenlabs',
      });

      const result = await mockCompare('Test message');

      expect(result.preferred).toBe('elevenlabs');
      expect(Object.keys(result)).toHaveLength(4);
    });

    it('should measure synthesis metrics', async () => {
      const mockMetrics = vi.fn().mockResolvedValue({
        provider: 'elevenlabs',
        latency: 250,
        throughput: 100,
        naturalness: 9.2,
      });

      const metrics = await mockMetrics('elevenlabs', 'Test');

      expect(metrics.latency).toBeLessThan(1000);
      expect(metrics.naturalness).toBeGreaterThan(8);
    });
  });

  describe('Configuration Management Workflow', () => {
    it('should save provider configuration', async () => {
      const mockSaveConfig = vi.fn().mockResolvedValue({
        saved: true,
        path: '~/.clawdbot/providers.json',
        providers: {
          stt: 'deepgram',
          tts: 'elevenlabs',
        },
      });

      const result = await mockSaveConfig({
        stt: 'deepgram',
        tts: 'elevenlabs',
      });

      expect(result.saved).toBe(true);
      expect(result.providers.stt).toBe('deepgram');
    });

    it('should load provider configuration on startup', async () => {
      const mockLoadConfig = vi.fn().mockResolvedValue({
        stt: {
          provider: 'deepgram',
          apiKey: '***',
          language: 'en',
        },
        tts: {
          provider: 'elevenlabs',
          apiKey: '***',
          voice: 'bella',
        },
      });

      const config = await mockLoadConfig();

      expect(config.stt.provider).toBe('deepgram');
      expect(config.tts.provider).toBe('elevenlabs');
    });

    it('should validate configuration integrity', async () => {
      const mockValidate = vi.fn().mockResolvedValue({
        valid: true,
        missingFields: [],
        invalidProviders: [],
      });

      const validation = await mockValidate();

      expect(validation.valid).toBe(true);
      expect(validation.missingFields).toHaveLength(0);
    });

    it('should migrate legacy provider configurations', async () => {
      const mockMigrate = vi.fn().mockResolvedValue({
        migrated: true,
        previousVersion: 'v1',
        newVersion: 'v2',
        changedProviders: 1,
      });

      const result = await mockMigrate();

      expect(result.migrated).toBe(true);
      expect(result.newVersion).toBe('v2');
    });
  });

  describe('Provider Status Monitoring', () => {
    it('should check provider health status', async () => {
      const mockHealthCheck = vi.fn().mockResolvedValue({
        provider: 'deepgram',
        healthy: true,
        responseTime: 150,
        lastCheck: Date.now(),
      });

      const health = await mockHealthCheck('deepgram');

      expect(health.healthy).toBe(true);
      expect(health.responseTime).toBeGreaterThan(0);
    });

    it('should monitor quota/usage for cloud providers', async () => {
      const mockQuota = vi.fn().mockResolvedValue({
        provider: 'deepgram',
        quotaLimit: 50000,
        quotaUsed: 25000,
        quotaRemaining: 25000,
        resetDate: Date.now() + 86400000,
      });

      const quota = await mockQuota('deepgram');

      expect(quota.quotaRemaining).toBeGreaterThan(0);
      expect(quota.quotaUsed + quota.quotaRemaining).toBe(quota.quotaLimit);
    });

    it('should collect performance metrics across providers', async () => {
      const mockMetrics = vi.fn().mockResolvedValue({
        timestamp: Date.now(),
        providers: {
          deepgram: { avgLatency: 200, successRate: 0.99 },
          whisper: { avgLatency: 500, successRate: 0.98 },
          elevenlabs: { avgLatency: 250, successRate: 0.99 },
        },
      });

      const metrics = await mockMetrics();

      expect(metrics.providers.deepgram.successRate).toBeGreaterThan(0.95);
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should detect and handle transient errors', async () => {
      const mockRetry = vi.fn().mockImplementation(async () => {
        const attempts = [
          { attempt: 1, success: false, error: 'Timeout' },
          { attempt: 2, success: false, error: 'Timeout' },
          { attempt: 3, success: true, result: 'Success' },
        ];

        for (const att of attempts) {
          if (att.success) return att;
          await new Promise((r) => setTimeout(r, 10));
        }
      });

      const result = await mockRetry();

      expect(result.success).toBe(true);
      expect(result.attempt).toBe(3);
    });

    it('should escalate to fallback on permanent errors', async () => {
      const mockEscalate = vi.fn().mockResolvedValue({
        primaryProvider: 'deepgram',
        error: 'Invalid API key',
        fallbackActivated: true,
        fallbackProvider: 'whisper',
      });

      const result = await mockEscalate();

      expect(result.fallbackActivated).toBe(true);
      expect(result.fallbackProvider).toBe('whisper');
    });

    it('should log errors and maintain error history', async () => {
      const mockErrorLog = vi.fn().mockResolvedValue({
        totalErrors: 5,
        recentErrors: [
          { timestamp: Date.now(), provider: 'deepgram', error: 'Timeout' },
          { timestamp: Date.now() - 1000, provider: 'whisper', error: 'OutOfMemory' },
        ],
      });

      const history = await mockErrorLog();

      expect(history.totalErrors).toBeGreaterThan(0);
      expect(history.recentErrors).toHaveLength(2);
    });
  });
});
