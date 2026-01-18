# Voice Orchestrator Integration Guide

## Overview

This document provides practical integration patterns for the Voice Orchestrator with CLI commands, plugins, and the dashboard. It includes code examples for common use cases.

## Quick Start

### Initialize the Orchestrator

```typescript
// src/main.ts or initialization file
import { VoiceOrchestrator } from './media/voice-providers/orchestrator.js'

// Create singleton instance
let orchestrator: VoiceOrchestrator | undefined

export async function getVoiceOrchestrator(): Promise<VoiceOrchestrator> {
  if (!orchestrator) {
    orchestrator = new VoiceOrchestrator()
    await orchestrator.initialize()
  }
  return orchestrator
}

// Graceful shutdown
process.on('exit', async () => {
  if (orchestrator) {
    await orchestrator.shutdown()
  }
})
```

## CLI Integration Patterns

### Pattern 1: Simple Transcription Command

```typescript
// src/commands/voice/transcribe.ts
import { readFileSync } from 'fs'
import { getVoiceOrchestrator } from '../../main.js'
import { note, error } from '../../terminal/index.js'

export async function transcribeCommand(
  filePath: string,
  options: {
    provider?: string
    preference?: 'fast' | 'accurate' | 'cheap'
    output?: 'text' | 'json'
    verbose?: boolean
  }
): Promise<void> {
  try {
    const orchestrator = await getVoiceOrchestrator()

    // Load audio file
    if (!filePath.endsWith('.wav') && !filePath.endsWith('.mp3')) {
      throw new Error('Unsupported audio format. Use .wav or .mp3')
    }

    const audioData = readFileSync(filePath)

    // Transcribe with orchestrator
    const result = await orchestrator.transcribe(audioData, {
      providerId: options.provider,
      providerPreference: options.preference,
      trackMetrics: true,
      onProviderSwitch: (from, to) => {
        if (options.verbose) {
          note(`Switched from ${from} to ${to}`, 'Provider Switch')
        }
      },
      onFallback: (provider, err) => {
        if (options.verbose) {
          note(`Fallback from ${provider}: ${err.message}`, 'Fallback')
        }
      },
    })

    // Output result
    if (options.output === 'json') {
      console.log(
        JSON.stringify(
          {
            text: result.text,
            confidence: result.confidence,
            provider: result.provider,
            duration: result.duration,
            language: result.language,
          },
          null,
          2
        )
      )
    } else {
      console.log(result.text)
    }
  } catch (err) {
    error(
      `Transcription failed: ${err instanceof Error ? err.message : String(err)}`,
      'Transcribe Error'
    )
    process.exit(1)
  }
}

// CLI command definition
export const transcribeCmd = {
  command: 'transcribe <file>',
  describe: 'Transcribe audio file to text',
  builder: (yargs: any) =>
    yargs
      .positional('file', {
        describe: 'Audio file path (.wav, .mp3)',
        type: 'string',
      })
      .option('provider', {
        alias: 'p',
        describe: 'Specific provider to use',
        type: 'string',
      })
      .option('preference', {
        alias: 'P',
        describe: 'Provider preference',
        choices: ['fast', 'accurate', 'cheap'],
      })
      .option('output', {
        alias: 'o',
        describe: 'Output format',
        choices: ['text', 'json'],
        default: 'text',
      })
      .option('verbose', {
        alias: 'v',
        describe: 'Verbose output',
        type: 'boolean',
      }),
  handler: (argv: any) =>
    transcribeCommand(argv.file, {
      provider: argv.provider,
      preference: argv.preference,
      output: argv.output,
      verbose: argv.verbose,
    }),
}
```

### Pattern 2: Provider Status Command

```typescript
// src/commands/voice/status.ts
import { getVoiceOrchestrator } from '../../main.js'
import { table as createTable } from '../../terminal/table.js'
import { note } from '../../terminal/index.js'

export async function statusCommand(
  options: {
    detailed?: boolean
    json?: boolean
  } = {}
): Promise<void> {
  const orchestrator = await getVoiceOrchestrator()
  const status = await orchestrator.getProviderStatus()

  if (options.json) {
    console.log(JSON.stringify(status, null, 2))
    return
  }

  // Overall status
  const statusColor =
    status.orchestratorStatus === 'ready'
      ? '\x1b[32m' // Green
      : status.orchestratorStatus === 'degraded'
        ? '\x1b[33m' // Yellow
        : '\x1b[31m' // Red

  console.log(
    `\n${statusColor}Orchestrator Status: ${status.orchestratorStatus.toUpperCase()}\x1b[0m\n`
  )

  // STT Providers Table
  if (status.sttProviders.length > 0) {
    console.log('Speech-to-Text (STT) Providers:')

    const sttData = status.sttProviders.map((provider) => ({
      ID: provider.id,
      State: getStateEmoji(provider.state) + ' ' + provider.state,
      'Circuit Breaker': provider.circuitBreaker.state,
      'Requests (Success/Failed)': `${provider.metrics.requestsSuccessful}/${provider.metrics.requestsFailed}`,
      'Error Rate': (provider.metrics.errorRate * 100).toFixed(1) + '%',
      'Avg Latency': provider.metrics.averageLatencyMs.toFixed(0) + 'ms',
      'P95 Latency': provider.metrics.p95LatencyMs.toFixed(0) + 'ms',
    }))

    console.log(createTable(sttData))
  }

  // TTS Providers Table
  if (status.ttsProviders.length > 0) {
    console.log('\nText-to-Speech (TTS) Providers:')

    const ttsData = status.ttsProviders.map((provider) => ({
      ID: provider.id,
      State: getStateEmoji(provider.state) + ' ' + provider.state,
      'Circuit Breaker': provider.circuitBreaker.state,
      'Requests (Success/Failed)': `${provider.metrics.requestsSuccessful}/${provider.metrics.requestsFailed}`,
      'Error Rate': (provider.metrics.errorRate * 100).toFixed(1) + '%',
      'Avg Latency': provider.metrics.averageLatencyMs.toFixed(0) + 'ms',
      'P95 Latency': provider.metrics.p95LatencyMs.toFixed(0) + 'ms',
    }))

    console.log(createTable(ttsData))
  }

  // Fallback Chains
  console.log('\nFallback Chains:')
  console.log('STT:', status.fallbackChains.stt.join(' → '))
  console.log('TTS:', status.fallbackChains.tts.join(' → '))

  if (options.detailed) {
    console.log('\nDetailed Metrics:')
    for (const provider of [
      ...status.sttProviders,
      ...status.ttsProviders,
    ]) {
      console.log(`\n  ${provider.id}:`)
      console.log(
        `    Total Requests: ${provider.metrics.requestsTotal}`
      )
      console.log(
        `    Success Rate: ${((1 - provider.metrics.errorRate) * 100).toFixed(2)}%`
      )
      console.log(
        `    Latency Range: ${provider.metrics.latencyMin}ms - ${provider.metrics.latencyMax}ms`
      )
      console.log(
        `    Circuit Breaker: ${provider.circuitBreaker.state} (${provider.circuitBreaker.failureCount} failures)`
      )
    }
  }

  console.log()
}

function getStateEmoji(state: string): string {
  switch (state) {
    case 'healthy':
      return '✓'
    case 'degraded':
      return '⚠'
    case 'unhealthy':
      return '✗'
    default:
      return '?'
  }
}

export const statusCmd = {
  command: 'status',
  describe: 'Show voice provider status',
  builder: (yargs: any) =>
    yargs
      .option('detailed', {
        alias: 'd',
        describe: 'Show detailed metrics',
        type: 'boolean',
      })
      .option('json', {
        describe: 'Output as JSON',
        type: 'boolean',
      }),
  handler: (argv: any) =>
    statusCommand({
      detailed: argv.detailed,
      json: argv.json,
    }),
}
```

### Pattern 3: Configuration Command

```typescript
// src/commands/voice/config.ts
import { writeFile, readFile } from 'fs/promises'
import { getVoiceOrchestrator } from '../../main.js'
import { CONFIG_PATH_CLAWDBOT } from '../../config/config.js'
import { select, confirm } from '@clack/prompts'
import { note, success } from '../../terminal/index.js'

export async function configCommand(
  action: 'show' | 'set' | 'reset',
  key?: string,
  value?: string
): Promise<void> {
  const orchestrator = await getVoiceOrchestrator()

  switch (action) {
    case 'show':
      await showConfig(orchestrator)
      break
    case 'set':
      await setConfig(orchestrator, key!, value)
      break
    case 'reset':
      await resetConfig(orchestrator)
      break
  }
}

async function showConfig(orchestrator: VoiceOrchestrator): Promise<void> {
  const config = await orchestrator.getConfiguration()
  console.log(JSON.stringify(config, null, 2))
}

async function setConfig(
  orchestrator: VoiceOrchestrator,
  key: string,
  value?: string
): Promise<void> {
  // Interactive selection if no value provided
  if (!value) {
    if (key === 'stt-provider') {
      const providers = await orchestrator.listAvailableProviders('stt')
      value = (await select({
        message: 'Select STT provider',
        options: providers.map((p) => ({
          label: p.id,
          value: p.id,
        })),
      })) as string
    } else if (key === 'tts-provider') {
      const providers = await orchestrator.listAvailableProviders('tts')
      value = (await select({
        message: 'Select TTS provider',
        options: providers.map((p) => ({
          label: p.id,
          value: p.id,
        })),
      })) as string
    }
  }

  // Apply configuration change
  const config = await orchestrator.getConfiguration()
  if (key === 'stt-provider') {
    await orchestrator.switchProvider('stt', value!)
  } else if (key === 'tts-provider') {
    await orchestrator.switchProvider('tts', value!)
  }

  success(`Configuration updated: ${key} = ${value}`)
}

async function resetConfig(orchestrator: VoiceOrchestrator): Promise<void> {
  const proceed = await confirm({
    message: 'Reset all voice configuration to defaults?',
  })

  if (proceed) {
    // Reset implementation would depend on config persistence
    success('Configuration reset to defaults')
  }
}

export const configCmd = {
  command: 'config <action> [key] [value]',
  describe: 'Manage voice orchestrator configuration',
  builder: (yargs: any) =>
    yargs
      .positional('action', {
        describe: 'Action to perform',
        choices: ['show', 'set', 'reset'],
      })
      .positional('key', {
        describe: 'Configuration key',
      })
      .positional('value', {
        describe: 'Configuration value',
      }),
  handler: (argv: any) =>
    configCommand(argv.action, argv.key, argv.value),
}
```

## Plugin Integration Pattern

### Registering a Custom Provider

```typescript
// plugins/my-tts-provider/index.ts
import type { VoiceOrchestrator } from '../../src/media/voice-providers/orchestrator.js'
import type { VoiceProviderExecutor } from '../../src/media/voice-providers/executor.js'

/**
 * Custom TTS provider implementation
 */
class MyCustomTTSProvider implements VoiceProviderExecutor {
  id = 'my-custom-tts'

  async initialize(): Promise<void> {
    // Setup your provider
  }

  async shutdown(): Promise<void> {
    // Cleanup
  }

  async synthesize(text: string, options?: any): Promise<AudioBuffer> {
    // Implementation
  }

  async synthesizeStream(
    textStream: ReadableStream<string>,
    options?: any
  ): AsyncIterable<AudioBuffer> {
    // Streaming implementation
  }

  async transcribe(audio: AudioBuffer, options?: any): Promise<any> {
    throw new Error('Not implemented')
  }

  async transcribeStream(audioStream: ReadableStream<AudioBuffer>): AsyncIterable<any> {
    throw new Error('Not implemented')
  }

  getCapabilities(): any {
    return {
      supportedFormats: ['pcm16'],
      supportedSampleRates: [16000],
      supportedLanguages: ['en'],
      supportsStreaming: true,
      maxConcurrentSessions: 5,
      estimatedLatencyMs: 500,
      requiresNetworkConnection: true,
    }
  }

  async isHealthy(): Promise<boolean> {
    // Health check
    return true
  }
}

/**
 * Plugin entry point
 */
export async function registerPlugin(
  orchestrator: VoiceOrchestrator
): Promise<void> {
  const provider = new MyCustomTTSProvider()
  await provider.initialize()

  // Register with orchestrator
  orchestrator.registerProvider('my-custom-tts', provider, {
    type: 'tts',
    priority: 10,
    deployment: 'cloud',
    enabled: true,
  })
}
```

## Dashboard Integration Pattern

### React Component for Voice Control

```typescript
// ui/src/ui/controllers/voice-controller.ts
import { VoiceOrchestrator } from '../../../src/media/voice-providers/orchestrator.js'

export class VoiceController {
  private orchestrator: VoiceOrchestrator | null = null

  async initialize(): Promise<void> {
    this.orchestrator = new VoiceOrchestrator()
    await this.orchestrator.initialize()
  }

  async getStatus() {
    if (!this.orchestrator) return null
    return await this.orchestrator.getProviderStatus()
  }

  async getMetrics(providerId?: string) {
    if (!this.orchestrator) return null
    return await this.orchestrator.getMetrics(providerId)
  }

  async transcribe(
    audioBuffer: Uint8Array,
    options?: any
  ): Promise<TranscriptionResult> {
    if (!this.orchestrator) {
      throw new Error('Orchestrator not initialized')
    }
    return await this.orchestrator.transcribe(
      {
        data: audioBuffer,
        format: 'pcm16',
        sampleRate: 16000,
        duration: 0,
        channels: 1,
      },
      options
    )
  }

  async synthesize(text: string, options?: any): Promise<Uint8Array> {
    if (!this.orchestrator) {
      throw new Error('Orchestrator not initialized')
    }
    const audio = await this.orchestrator.synthesize(text, options)
    return audio.data
  }

  async switchProvider(type: 'stt' | 'tts', providerId: string): Promise<void> {
    if (!this.orchestrator) return
    await this.orchestrator.switchProvider(type, providerId)
  }
}

// React hook
export function useVoiceController() {
  const [controller, setController] = useState<VoiceController | null>(null)
  const [status, setStatus] = useState<ProviderStatusReport | null>(null)

  useEffect(() => {
    const init = async () => {
      const vc = new VoiceController()
      await vc.initialize()
      setController(vc)

      // Poll status
      const pollStatus = async () => {
        const s = await vc.getStatus()
        setStatus(s)
      }
      await pollStatus()
      const interval = setInterval(pollStatus, 5000)
      return () => clearInterval(interval)
    }

    init()
  }, [])

  return {
    controller,
    status,
  }
}

// React component
export function VoiceProviderStatusPanel() {
  const { controller, status } = useVoiceController()

  if (!status) return <div>Loading...</div>

  return (
    <div className="voice-provider-panel">
      <h2>Voice Orchestrator</h2>

      {/* Overall Status */}
      <div className="orchestrator-status">
        <span className={`status-${status.orchestratorStatus}`}>
          {status.orchestratorStatus.toUpperCase()}
        </span>
      </div>

      {/* Provider Grid */}
      <div className="providers-grid">
        {[...status.sttProviders, ...status.ttsProviders].map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            onSwitch={() =>
              controller?.switchProvider(
                provider.type,
                provider.id
              )
            }
          />
        ))}
      </div>

      {/* Fallback Chains */}
      <div className="fallback-chains">
        <h3>Fallback Chains</h3>
        <div>
          <strong>STT:</strong> {status.fallbackChains.stt.join(' → ')}
        </div>
        <div>
          <strong>TTS:</strong> {status.fallbackChains.tts.join(' → ')}
        </div>
      </div>
    </div>
  )
}
```

## Voice Channel Integration

### Using Orchestrator in Voice Channels

```typescript
// src/media/voice-channels/call-handler.ts
import { getVoiceOrchestrator } from '../../main.js'

export class VoiceCallHandler {
  private orchestrator: VoiceOrchestrator | undefined

  async handleIncomingAudio(audioChunk: AudioBuffer): Promise<void> {
    if (!this.orchestrator) {
      this.orchestrator = await getVoiceOrchestrator()
    }

    // Use orchestrator for transcription with automatic fallback
    const result = await this.orchestrator.transcribe(audioChunk, {
      timeout: 10000,
      allowFallback: true,
      trackMetrics: true,
      onProviderSwitch: (from, to) => {
        console.log(`STT provider switched: ${from} → ${to}`)
      },
      onFallback: (provider, error) => {
        console.warn(`STT fallback from ${provider}: ${error.message}`)
      },
    })

    // Process transcription result
    await this.processUserMessage(result.text)
  }

  async sendVoiceResponse(text: string): Promise<void> {
    if (!this.orchestrator) {
      this.orchestrator = await getVoiceOrchestrator()
    }

    // Use orchestrator for synthesis with streaming if possible
    const audioBuffer = await this.orchestrator.synthesize(text, {
      voice: 'natural',
      speed: 1.0,
      timeout: 10000,
      allowFallback: true,
      trackMetrics: true,
    })

    // Stream audio to caller
    await this.streamAudio(audioBuffer)
  }

  private async processUserMessage(text: string): Promise<void> {
    // Process transcribed text
  }

  private async streamAudio(audio: AudioBuffer): Promise<void> {
    // Stream to caller
  }
}
```

## Error Handling Best Practices

### Comprehensive Error Handler

```typescript
// utils/voice-error-handler.ts
import { VoiceProviderError } from '../media/voice-providers/executor.js'

export async function handleVoiceOperation<T>(
  operation: () => Promise<T>,
  context: {
    operationType: 'transcribe' | 'synthesize'
    timeout?: number
    retryable?: boolean
  }
): Promise<T> {
  const startTime = Date.now()

  try {
    return await operation()
  } catch (error) {
    const elapsed = Date.now() - startTime

    if (error instanceof VoiceProviderError) {
      // Provider-specific error
      console.error(
        `${context.operationType} failed with provider ${error.provider}: ${error.message}`
      )

      // Log for metrics/monitoring
      logVoiceError({
        type: error.code || 'unknown',
        provider: error.provider,
        elapsed,
        operationType: context.operationType,
        retryable: context.retryable,
      })

      // User-friendly message
      const userMessage =
        context.operationType === 'transcribe'
          ? 'Failed to transcribe audio. Please try again.'
          : 'Failed to synthesize speech. Please try again.'

      throw new Error(userMessage)
    }

    // Generic error
    console.error(`Voice operation failed: ${error}`)
    throw error
  }
}

function logVoiceError(details: any): void {
  // Send to monitoring/logging service
}

// Usage example
export async function transcribeWithErrorHandling(
  audio: AudioBuffer
): Promise<string> {
  const result = await handleVoiceOperation(
    async () => {
      const orchestrator = await getVoiceOrchestrator()
      return await orchestrator.transcribe(audio)
    },
    {
      operationType: 'transcribe',
      timeout: 30000,
      retryable: true,
    }
  )
  return result.text
}
```

## Configuration File Examples

### Local Development Config

```yaml
# ~/.clawdbot/config.yaml
voice:
  orchestrator:
    enabled: true
    deploymentMode: docker

    providers:
      - id: faster-whisper-docker
        name: Faster-Whisper (Docker)
        type: stt
        priority: 1
        enabled: true
        deployment: docker

      - id: kokoro-system
        name: Kokoro (System)
        type: tts
        priority: 1
        enabled: true
        deployment: system

    sttFallbackChain:
      - faster-whisper-docker

    ttsFallbackChain:
      - kokoro-system

    healthCheck:
      enabled: true
      intervalMs: 60000
      strategies:
        metadata: true
        echo: true

    circuitBreaker:
      enabled: true
      failureThreshold: 5
      timeoutMs: 30000

    logging:
      level: debug
      providers: true
      fallbacks: true
```

### Production Config

```yaml
# ~/.clawdbot/config.yaml (production)
voice:
  orchestrator:
    enabled: true
    deploymentMode: hybrid

    providers:
      - id: openai-whisper
        name: OpenAI Whisper
        type: stt
        priority: 1
        enabled: true
        deployment: cloud

      - id: faster-whisper-system
        name: Faster-Whisper (Fallback)
        type: stt
        priority: 2
        enabled: true
        deployment: system

      - id: elevenlabs
        name: ElevenLabs TTS
        type: tts
        priority: 1
        enabled: true
        deployment: cloud

      - id: kokoro-system
        name: Kokoro (Fallback)
        type: tts
        priority: 2
        enabled: true
        deployment: system

    sttFallbackChain:
      - openai-whisper
      - faster-whisper-system

    ttsFallbackChain:
      - elevenlabs
      - kokoro-system

    healthCheck:
      enabled: true
      intervalMs: 30000
      unhealthyThreshold: 2
      strategies:
        metadata: true
        echo: true
        latency: true

    circuitBreaker:
      enabled: true
      failureThreshold: 3
      timeoutMs: 60000
      maxBackoffMs: 300000

    logging:
      level: info
      providers: true
      fallbacks: true
      providerSwitches: true
```

## Testing Patterns

### Unit Test Example

```typescript
// orchestrator.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { VoiceOrchestrator } from './orchestrator'

describe('VoiceOrchestrator', () => {
  let orchestrator: VoiceOrchestrator

  beforeEach(async () => {
    orchestrator = new VoiceOrchestrator()
    await orchestrator.initialize()
  })

  afterEach(async () => {
    await orchestrator.shutdown()
  })

  it('should select primary provider for transcription', async () => {
    const audio = createTestAudioBuffer()
    const result = await orchestrator.transcribe(audio)
    expect(result.text).toBeDefined()
    expect(result.provider).toBe('faster-whisper-docker')
  })

  it('should fallback to next provider on error', async () => {
    // Mock first provider to fail
    vi.mock('./providers/whisper', () => ({
      WhisperExecutor: vi.fn().mockImplementation(() => ({
        transcribe: vi.fn().mockRejectedValue(new Error('Provider error')),
      })),
    }))

    const audio = createTestAudioBuffer()
    const result = await orchestrator.transcribe(audio, { allowFallback: true })
    expect(result.provider).toBe('faster-whisper-system')
  })

  it('should respect timeout option', async () => {
    const audio = createTestAudioBuffer()
    const startTime = Date.now()

    await expect(
      orchestrator.transcribe(audio, { timeoutMs: 100 })
    ).rejects.toThrow()

    const elapsed = Date.now() - startTime
    expect(elapsed).toBeLessThan(200) // Should timeout quickly
  })

  it('should track metrics correctly', async () => {
    const audio = createTestAudioBuffer()
    await orchestrator.transcribe(audio)

    const metrics = await orchestrator.getMetrics('faster-whisper-docker')
    expect(metrics.requestsTotal).toBe(1)
    expect(metrics.requestsSuccessful).toBe(1)
  })
})
```

### Integration Test Example

```typescript
// orchestrator.integration.test.ts
describe('VoiceOrchestrator Integration', () => {
  it('should handle real audio transcription', async () => {
    const orchestrator = new VoiceOrchestrator()
    await orchestrator.initialize()

    const audioFile = './test-fixtures/sample-audio.wav'
    const audio = loadAudioFile(audioFile)

    const result = await orchestrator.transcribe(audio)
    expect(result.text).toContain('hello') // Example assertion

    await orchestrator.shutdown()
  })

  it('should handle real text synthesis', async () => {
    const orchestrator = new VoiceOrchestrator()
    await orchestrator.initialize()

    const audioBuffer = await orchestrator.synthesize('Hello, world!')
    expect(audioBuffer.data).toBeDefined()
    expect(audioBuffer.format).toBe('pcm16')

    await orchestrator.shutdown()
  })
})
```

## Monitoring & Metrics Export

### Metrics Export to Monitoring Service

```typescript
// services/metrics-exporter.ts
import { getVoiceOrchestrator } from '../main.js'

export async function exportVoiceMetrics(endpoint: string): Promise<void> {
  const orchestrator = await getVoiceOrchestrator()
  const status = await orchestrator.getProviderStatus()

  // Prepare metrics payload
  const metrics = {
    timestamp: Date.now(),
    orchestratorStatus: status.orchestratorStatus,
    providers: status.sttProviders
      .concat(status.ttsProviders)
      .map((provider) => ({
        id: provider.id,
        type: provider.type,
        state: provider.state,
        metrics: {
          requestsTotal: provider.metrics.requestsTotal,
          errorRate: provider.metrics.errorRate,
          averageLatency: provider.metrics.averageLatencyMs,
          p95Latency: provider.metrics.p95LatencyMs,
          uptime: provider.metrics.uptime,
        },
        circuitBreaker: {
          state: provider.circuitBreaker.state,
          failureCount: provider.circuitBreaker.failureCount,
        },
      })),
  }

  // Send to monitoring service
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metrics),
  })

  if (!response.ok) {
    throw new Error(`Failed to export metrics: ${response.statusText}`)
  }
}
```

## Summary

The Voice Orchestrator provides a comprehensive, production-ready interface for managing multiple STT/TTS providers. Key integration points include:

1. **CLI Commands**: Transcribe, synthesize, check status, configure providers
2. **Plugins**: Register custom providers with health checks
3. **Dashboard**: Real-time provider status, metrics, and manual switching
4. **Voice Channels**: Automatic fallback and error handling
5. **Monitoring**: Metrics export and health tracking

All integration patterns follow these principles:
- Always await orchestrator initialization
- Use `getVoiceOrchestrator()` for singleton access
- Handle errors gracefully with user-friendly messages
- Track metrics for monitoring and optimization
- Respect timeout and retry configuration
- Support streaming where possible for real-time applications
