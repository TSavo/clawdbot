/**
 * Provider Registry Tests
 *
 * Tests the unified provider registry functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  UnifiedProviderRegistry,
  createProviderRegistry,
  getProviderRegistry,
  type DeploymentMode,
} from './provider-registry.js';

describe('UnifiedProviderRegistry', () => {
  let registry: UnifiedProviderRegistry;

  beforeEach(() => {
    registry = createProviderRegistry();
  });

  describe('provider discovery', () => {
    it('should discover all providers', () => {
      const providers = registry.getAllProviders();
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should separate STT and TTS providers', () => {
      const sttProviders = registry.getSTTProviders();
      const ttsProviders = registry.getTTSProviders();

      expect(sttProviders.every((p) => p.type === 'stt')).toBe(true);
      expect(ttsProviders.every((p) => p.type === 'tts')).toBe(true);
      expect(sttProviders.length).toBeGreaterThan(0);
      expect(ttsProviders.length).toBeGreaterThan(0);
    });

    it('should retrieve provider by ID', () => {
      const provider = registry.getProvider('whisper-stt');
      expect(provider).toBeDefined();
      expect(provider?.id).toBe('whisper-stt');
      expect(provider?.type).toBe('stt');
    });

    it('should return undefined for unknown provider', () => {
      const provider = registry.getProvider('unknown-provider');
      expect(provider).toBeUndefined();
    });
  });

  describe('mode filtering', () => {
    it('should filter providers by system mode', () => {
      const systemProviders = registry.getProvidersByMode('system');
      expect(systemProviders.length).toBeGreaterThan(0);
      expect(
        systemProviders.every((p) => p.modes.system?.available === true),
      ).toBe(true);
    });

    it('should filter providers by docker mode', () => {
      const dockerProviders = registry.getProvidersByMode('docker');
      expect(dockerProviders.length).toBeGreaterThan(0);
      expect(
        dockerProviders.every((p) => p.modes.docker?.available === true),
      ).toBe(true);
    });

    it('should filter providers by cloud mode', () => {
      const cloudProviders = registry.getProvidersByMode('cloud');
      expect(cloudProviders.length).toBeGreaterThan(0);
      expect(
        cloudProviders.every((p) => p.modes.cloud?.available === true),
      ).toBe(true);
    });

    it('should filter STT providers by mode', () => {
      const sttSystem = registry.getSTTProvidersByMode('system');
      expect(sttSystem.every((p) => p.type === 'stt')).toBe(true);
      expect(sttSystem.every((p) => p.modes.system?.available === true)).toBe(true);
    });

    it('should filter TTS providers by mode', () => {
      const ttsCloud = registry.getTTSProvidersByMode('cloud');
      expect(ttsCloud.every((p) => p.type === 'tts')).toBe(true);
      expect(ttsCloud.every((p) => p.modes.cloud?.available === true)).toBe(true);
    });
  });

  describe('provider validation', () => {
    it('should validate available provider in valid mode', () => {
      const validation = registry.validateProvider('whisper-stt', 'system');
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should reject unknown provider', () => {
      const validation = registry.validateProvider('unknown', 'system');
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should reject provider in unavailable mode', () => {
      const validation = registry.validateProvider('deepgram-stt', 'system');
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should indicate provider readiness', () => {
      const ready = registry.isProviderReady('whisper-stt', 'system');
      expect(typeof ready).toBe('boolean');
    });
  });

  describe('dependencies and requirements', () => {
    it('should return dependencies for system mode providers', () => {
      const deps = registry.getProviderDependencies('whisper-stt', 'system');
      expect(Array.isArray(deps)).toBe(true);
      expect(deps.includes('whisper.cpp')).toBe(true);
    });

    it('should return empty array for unavailable modes', () => {
      const deps = registry.getProviderDependencies('deepgram-stt', 'system');
      expect(Array.isArray(deps)).toBe(true);
      expect(deps.length).toBe(0);
    });

    it('should return environment variables for cloud providers', () => {
      const envVars = registry.getProviderEnvVars('deepgram-stt', 'cloud');
      expect(Array.isArray(envVars)).toBe(true);
      expect(envVars.includes('DEEPGRAM_API_KEY')).toBe(true);
    });

    it('should return empty for system mode cloud-only providers', () => {
      const envVars = registry.getProviderEnvVars('deepgram-stt', 'system');
      expect(Array.isArray(envVars)).toBe(true);
      expect(envVars.length).toBe(0);
    });
  });

  describe('provider discovery', () => {
    it('should discover available modes for provider', () => {
      const discovery = registry.discoverProvider('whisper-stt');
      expect(discovery.status).toBe('ready');
      expect(discovery.availableModes.includes('system')).toBe(true);
    });

    it('should mark cloud-only providers as discoverable', () => {
      const discovery = registry.discoverProvider('deepgram-stt');
      expect(discovery.availableModes.includes('cloud')).toBe(true);
    });

    it('should cache discovery results', () => {
      const discovery1 = registry.discoverProvider('whisper-stt');
      const discovery2 = registry.discoverProvider('whisper-stt');
      expect(discovery1).toBe(discovery2);
    });
  });

  describe('mode support matrix', () => {
    it('should generate support matrix', () => {
      const matrix = registry.generateModeSupportMatrix();
      expect(matrix.stt).toBeDefined();
      expect(matrix.tts).toBeDefined();
    });

    it('should show availability for each mode', () => {
      const matrix = registry.generateModeSupportMatrix();
      const whisperMatrix = matrix.stt['whisper-stt'];

      expect(whisperMatrix).toBeDefined();
      expect(typeof whisperMatrix.system).toBe('boolean');
      expect(typeof whisperMatrix.docker).toBe('boolean');
      expect(typeof whisperMatrix.cloud).toBe('boolean');
    });

    it('should indicate cloud-only providers correctly', () => {
      const matrix = registry.generateModeSupportMatrix();
      const deepgramMatrix = matrix.stt['deepgram-stt'];

      expect(deepgramMatrix.cloud).toBe(true);
      expect(deepgramMatrix.system).toBe(false);
      expect(deepgramMatrix.docker).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should export to JSON', () => {
      const json = registry.toJSON();
      expect(json.providers).toBeDefined();
      expect(json.stt).toBeDefined();
      expect(json.tts).toBeDefined();
      expect(json.modeMatrix).toBeDefined();
      expect(json.timestamp).toBeDefined();
    });

    it('should include all required fields in JSON export', () => {
      const json = registry.toJSON();
      expect(json.providers.length).toBeGreaterThan(0);
      expect(json.stt.every((p) => p.type === 'stt')).toBe(true);
      expect(json.tts.every((p) => p.type === 'tts')).toBe(true);
    });
  });

  describe('provider templates', () => {
    it('should generate configuration template for provider', () => {
      const template = registry.getProviderTemplate('whisper-stt', 'system');
      expect(template.id).toBe('whisper-stt');
      expect(template.type).toBe('stt');
      expect(template.mode).toBe('system');
      expect(template.dependencies).toBeDefined();
    });

    it('should include docker config for docker mode', () => {
      const template = registry.getProviderTemplate('whisper-stt', 'docker');
      expect(template.docker).toBeDefined();
    });

    it('should include API keys for cloud mode', () => {
      const template = registry.getProviderTemplate('deepgram-stt', 'cloud');
      expect(template.apiKeys).toBeDefined();
    });

    it('should return empty template for unknown provider', () => {
      const template = registry.getProviderTemplate('unknown', 'system');
      expect(Object.keys(template).length).toBe(0);
    });
  });

  describe('provider listing', () => {
    it('should list all provider IDs', () => {
      const ids = registry.listProviderIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.includes('whisper-stt')).toBe(true);
    });

    it('should list STT provider IDs', () => {
      const ids = registry.listSTTProviderIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.includes('whisper-stt')).toBe(true);
    });

    it('should list TTS provider IDs', () => {
      const ids = registry.listTTSProviderIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.includes('kokoro-tts')).toBe(true);
    });

    it('should not mix STT and TTS IDs', () => {
      const sttIds = registry.listSTTProviderIds();
      const ttsIds = registry.listTTSProviderIds();

      const overlap = sttIds.filter((id) => ttsIds.includes(id));
      expect(overlap.length).toBe(0);
    });
  });

  describe('provider priorities', () => {
    it('should sort providers by priority', () => {
      const providers = registry.getAllProviders();
      for (let i = 0; i < providers.length - 1; i++) {
        const current = providers[i].priority ?? 0;
        const next = providers[i + 1].priority ?? 0;
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('should maintain priority when filtering by type', () => {
      const stt = registry.getSTTProviders();
      for (let i = 0; i < stt.length - 1; i++) {
        const current = stt[i].priority ?? 0;
        const next = stt[i + 1].priority ?? 0;
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance when called multiple times', () => {
      const instance1 = getProviderRegistry();
      const instance2 = getProviderRegistry();
      expect(instance1).toBe(instance2);
    });

    it('should create fresh instances with factory', () => {
      const instance1 = createProviderRegistry();
      const instance2 = createProviderRegistry();
      expect(instance1).not.toBe(instance2);
      expect(instance1.getAllProviders().length).toBe(instance2.getAllProviders().length);
    });
  });

  describe('capabilities', () => {
    it('should include format capabilities', () => {
      const provider = registry.getProvider('whisper-stt');
      expect(provider?.capabilities?.formats).toBeDefined();
      expect(Array.isArray(provider?.capabilities?.formats)).toBe(true);
    });

    it('should include language capabilities', () => {
      const provider = registry.getProvider('whisper-stt');
      expect(provider?.capabilities?.languages).toBeDefined();
      expect(Array.isArray(provider?.capabilities?.languages)).toBe(true);
    });

    it('should include voices for TTS providers', () => {
      const provider = registry.getProvider('kokoro-tts');
      expect(provider?.capabilities?.voices).toBeDefined();
      expect(Array.isArray(provider?.capabilities?.voices)).toBe(true);
      expect(provider?.capabilities?.voices?.length).toBeGreaterThan(0);
    });

    it('should include features list', () => {
      const provider = registry.getProvider('whisper-stt');
      expect(provider?.capabilities?.features).toBeDefined();
      expect(Array.isArray(provider?.capabilities?.features)).toBe(true);
    });
  });
});
