# Voice Providers System Architecture Diagrams

## 1. Current Schema vs. Required Structure

### Current Schema (BROKEN)
```
VoiceProviderEntry
├─ id: string
├─ name: string (MISSING in schema!)
├─ type: enum ["stt" | "tts"]  ← Forces binary choice
├─ enabled: boolean
├─ priority: number
└─ config: Record<string, unknown>  ← No type safety!
   └─ No way to express STT AND TTS together
```

### Required Structure (TO IMPLEMENT)
```
VoiceProviderEntry
├─ id: string
├─ name: string  ← ADD: Used throughout
├─ type: enum ["stt" | "tts"]  ← Primary channel indicator
├─ enabled: boolean
├─ priority: number
├─ stt?: STTProviderConfig  ← ADD: Optional STT
│  ├─ type: enum ["local", "whisper", "faster-whisper", "openai", "google", "azure"]
│  ├─ model?: string  ← ADD: Missing
│  ├─ modelSize?: enum ["tiny", "small", "base", "medium", "large"]
│  ├─ service?: string
│  ├─ language?: string
│  ├─ apiKey?: string
│  └─ ...
└─ tts?: TTSProviderConfig  ← ADD: Optional TTS
   ├─ type: enum ["local", "kokoro", "piper", "elevenlabs", "openai", "google", "azure"]
   ├─ model?: string  ← ADD: Missing
   ├─ voice?: string
   ├─ speed?: number (0.5-2.0)
   ├─ service?: string
   ├─ language?: string  ← ADD: Missing
   ├─ apiKey?: string
   └─ ...
```

---

## 2. Error Cascade Map

```
Root Cause: Schema Too Strict
│
├─ Missing "local" in type enums
│  ├─ onboarding.voice-providers.ts:354 ──→ type: "local" rejected
│  └─ onboarding.voice-providers.ts:376 ──→ type: "local" rejected
│
├─ No stt/tts properties on VoiceProviderEntry
│  ├─ loader.ts:88-147 ──→ 30+ "Property X does not exist" errors
│  ├─ migration.ts:50, 138-166 ──→ Cannot create entries with STT/TTS
│  ├─ voice.ts:63-75 ──→ Cannot read provider.stt/tts
│  └─ onboarding.ts:277-278 ──→ Cannot set stt/tts properties
│
├─ Missing properties in VoiceProvidersConfig
│  ├─ loader.ts:177 ──→ systemCapabilities not allowed
│  ├─ loader.ts:229-230 ──→ defaultSttProviderId/defaultTtsProviderId not allowed
│  ├─ migration.ts:66, 235-240 ──→ defaultTtsProviderId not allowed
│  └─ migration.ts:243-244 ──→ audio/migrationMetadata not allowed
│
└─ Missing properties in STT/TTS configs
   ├─ TTSProviderConfigSchema missing "model"
   ├─ TTSProviderConfigSchema missing "language"
   └─ STTProviderConfigSchema type enum missing "local"
```

---

## 3. Type Hierarchy Flow

```
┌────────────────────────────────────────────────────────┐
│                Level 1: Base Configs                   │
│                (Zod Schemas)                           │
├────────────────────────────────────────────────────────┤
│ STTProviderConfig        │      TTSProviderConfig      │
├─ type: string enum       ├─ type: string enum          │
├─ service?: string        ├─ service?: string           │
├─ modelSize?: enum        ├─ model?: string (ADD)       │
├─ apiKey?: string         ├─ voice?: string             │
├─ model?: string          ├─ speed?: number (0.5-2.0)   │
├─ language?: string       ├─ apiKey?: string            │
│                          └─ language?: string (ADD)    │
└──────┬──────────────────────────────┬──────────────────┘
       │                              │
┌──────▼──────────────────────────────▼──────────────────┐
│          Level 2: Provider Entry                       │
│          (Combines both configs)                       │
├────────────────────────────────────────────────────────┤
│ VoiceProviderEntry                                     │
├─ id: string                                            │
├─ name: string (ADD)                                    │
├─ type: "stt" | "tts"                                   │
├─ enabled: boolean = true                               │
├─ priority: number = 0                                  │
├─ stt?: STTProviderConfig (ADD)                         │
└─ tts?: TTSProviderConfig (ADD)                         │
       ├─ Optional: can have just stt                    │
       ├─ Optional: can have just tts                    │
       └─ Flexible: can have both                        │
└──────┬────────────────────────────────────────────────┘
       │
┌──────▼────────────────────────────────────────────────┐
│        Level 3: Configuration Container                │
│        (Metadata & Defaults)                           │
├────────────────────────────────────────────────────────┤
│ VoiceProvidersConfig                                   │
├─ enabled: boolean = false                              │
├─ providers: VoiceProviderEntry[] = []                  │
├─ defaultSttProviderId?: string (ADD)                   │
├─ defaultTtsProviderId?: string (ADD)                   │
├─ fallbackChain?: string[]                              │
├─ autoDetectCapabilities: boolean = true                │
├─ systemCapabilities?: SystemCapability (ADD)           │
├─ audio?: AudioConfig (ADD)                             │
└─ migrationMetadata?: MigrationMetadata (ADD)           │
```

---

## 4. Data Flow: Onboarding Wizard

```
┌─ User selects provider type (Local vs Cloud)
│
├─ LOCAL STT PATH
│  ├─ Detect system capabilities
│  ├─ Offer model options (whisper, faster-whisper)
│  ├─ Select model size (tiny, small, base, medium, large)
│  └─ Return STTProviderConfig {
│      type: "local",      ← CURRENTLY REJECTED!
│      model: "whisper",
│      modelSize: "small",
│      language: "en"
│    }
│
├─ CLOUD STT PATH
│  ├─ Select cloud service (OpenAI, Google, Azure)
│  ├─ Prompt for API key
│  └─ Return STTProviderConfig {
│      type: "openai",
│      service: "openai",
│      apiKey: "sk-...",
│      model: "whisper-1",
│      language: "en"
│    }
│
├─ LOCAL TTS PATH
│  ├─ Offer model options (kokoro, piper)
│  ├─ Select voice (depends on model)
│  └─ Return TTSProviderConfig {
│      type: "local",      ← CURRENTLY REJECTED!
│      model: "kokoro",
│      voice: "af_heart",
│      language: "en"      ← CURRENTLY MISSING!
│    }
│
├─ CLOUD TTS PATH
│  ├─ Select cloud service (ElevenLabs, Google, Azure, OpenAI)
│  ├─ Prompt for API key
│  ├─ Prompt for voice ID
│  └─ Return TTSProviderConfig {
│      type: "elevenlabs",
│      service: "elevenlabs",
│      voice: "rachel",
│      apiKey: "sk-...",
│      speed: 1,
│      language: "en"      ← CURRENTLY MISSING!
│    }
│
└─ CREATE PROVIDER ENTRY (onboarding.ts:394-395)
   const provider = createProviderEntry(providerId, sttConfig, ttsConfig)
   └─ PROBLEM: Can't create entry with both stt and tts!
      return {
        id: providerId,
        priority: 1,
        enabled: true,
        stt: sttConfig,    ← Schema forbids this!
        tts: ttsConfig     ← Schema forbids this!
      };
```

---

## 5. Error Classification

```
Error Category          Count  Affected Files              Schema Fix
─────────────────────────────────────────────────────────────────────
"Property X does not    30     loader.ts:88-147           Add stt/tts
 exist on type..."            migration.ts:138-166        to schema
                              voice.ts:63-75
                              onboarding.ts:277-278

Missing "local"         5      onboarding.ts:354,376       Add "local"
enum value                     loader.ts:89,120           to type
                                                           enums

Missing properties      20     loader.ts:177               Add to
in VoiceProviderConfig         migration.ts:66,235-240    config
                              voice.ts:229-230           schemas

Type incompatibility    15     loader.ts:28,47            Fix return
empty objects                  migration.ts:39,215       types

Cannot read             20     migration.ts:18-21         Not a schema
legacy config                  gateway.talk not in        issue - code
                              GatewayConfig             handles it

Possibly undefined      11     loader.ts:224,229          Add null
access                        migration.ts:229,235      checks or
                                                        proper init

Missing "name" field    2      onboarding.ts:403         Add name to
on entry                      loader.ts:403            entry schema

Model/language in       8      onboarding.ts:379        Add missing
TTS config                    loader.ts:122,126       properties
                             migration.ts:54,122
                             voice.ts:299

"local" not in enum     5      onboarding.ts:354,376   Add "local"
                                                       to enums
```

---

## 6. State Transitions: Provider Lifecycle

```
┌─ No Voice Config
│  └─ User runs onboarding wizard
│
├─→ SELECT PROVIDER TYPE
│   └─ local | cloud
│
├─→ CONFIGURE STT (optional)
│   ├─ Choose model/service
│   ├─ Gather credentials
│   └─ Create STTProviderConfig
│
├─→ CONFIGURE TTS (optional)
│   ├─ Choose model/service
│   ├─ Gather credentials
│   └─ Create TTSProviderConfig
│
├─→ CREATE PROVIDER ENTRY
│   ├─ id: string (from wizard)
│   ├─ name: string (NEEDED - currently missing)
│   ├─ type: "stt" | "tts" (primary channel)
│   ├─ stt?: STTProviderConfig (NEEDED - currently forbidden)
│   ├─ tts?: TTSProviderConfig (NEEDED - currently forbidden)
│   └─ enabled: true, priority: 1
│
├─→ STORE IN CONFIG
│   └─ cfg.voice.providers = {
│      enabled: true,
│      providers: [entry],
│      defaultSttProviderId: (if stt),
│      defaultTtsProviderId: (if tts),
│      systemCapabilities: {...},  ← NEEDED
│      migrationMetadata: {...}    ← NEEDED
│    }
│
└─→ PROVIDER READY
   ├─ Available for voice commands
   ├─ Fallback chain configured
   └─ System capabilities tracked
```

---

## 7. Schema Validation Gates

```
Current (BROKEN)                    After Fix (CORRECT)
────────────────────────────────    ─────────────────────────────

Provider with STT only:             Provider with STT only:
┌─ id: "s2t-1"                      ┌─ id: "s2t-1"
├─ type: "stt"                      ├─ name: "Whisper"
├─ enabled: true                    ├─ type: "stt"
├─ config: {}        ← Vague!       ├─ enabled: true
└─ [REJECTED]                       ├─ stt: { type: "local", ... }
   ✗ No way to                      └─ [ACCEPTED]
   express                            ✓ Clear structure
   STT config

Provider with both:                 Provider with both:
┌─ id: "primary"                    ┌─ id: "primary"
├─ type: "stt"       ← Problem!     ├─ name: "Hybrid"
├─ config: {}                       ├─ type: "stt"
└─ [REJECTED]                       ├─ enabled: true
   ✗ type forces                    ├─ stt: { ... }
   binary choice,                   ├─ tts: { ... }
   can't express both               └─ [ACCEPTED]
                                      ✓ Both channels
                                      supported

Legacy migration:                   Legacy migration:
gateway.talk = {...}                gateway.talk = {...}
  └─ Convert to                       └─ Convert to
  [REJECTED]                        ┌─ id: "migrated"
  ✗ New structure                   ├─ name: "Migrated"
  incompatible                      ├─ type: "tts"
  with old config                   ├─ tts: { ... }
                                    └─ [ACCEPTED]
                                      ✓ Proper mapping
```

---

## 8. Enum Values Comparison

### STT Type Enum

| Current | Should Be | Used By |
|---------|-----------|---------|
| whisper | whisper | onboarding (explicit) |
| faster-whisper | faster-whisper | onboarding (explicit) |
| openai | openai | onboarding (explicit) |
| google | google | onboarding (implicit) |
| azure | azure | onboarding (implicit) |
| | **local** | ❌ onboarding:354 - MISSING! |

### TTS Type Enum

| Current | Should Be | Used By |
|---------|-----------|---------|
| kokoro | kokoro | onboarding (explicit) |
| piper | piper | onboarding (explicit) |
| elevenlabs | elevenlabs | onboarding (explicit) |
| openai | openai | onboarding (implicit) |
| google | google | onboarding (implicit) |
| azure | azure | onboarding (implicit) |
| | **local** | ❌ onboarding:376 - MISSING! |

---

## 9. Implementation Dependency Graph

```
Step 1: STT/TTS Type Enums
├─ Add "local" to STTProviderConfigSchema.type
└─ Add "local" to TTSProviderConfigSchema.type
   ↓ (5 errors fixed)

Step 2: Config Property Additions
├─ Add model: string to TTSProviderConfigSchema
├─ Add language: string to STTProviderConfigSchema
└─ Add language: string to TTSProviderConfigSchema
   ↓ (8 errors fixed)

Step 3: VoiceProviderEntry Redesign
├─ Add name: string
├─ Remove config: Record<string, unknown>
├─ Add stt?: STTProviderConfig
└─ Add tts?: TTSProviderConfig
   ↓ (35 errors fixed)

Step 4: VoiceProvidersConfig Expansion
├─ Add defaultSttProviderId?: string
├─ Add defaultTtsProviderId?: string
├─ Add systemCapabilities?: object
├─ Add audio?: object
└─ Add migrationMetadata?: object
   ↓ (25 errors fixed)

Step 5: Return Type Corrections
├─ loader.ts return statements
└─ migration.ts return statements
   ↓ (15 errors fixed)

Step 6: Type Checking
└─ pnpm build
   ↓ Final: 0 errors ✓
```

---

## 10. Before/After Code Examples

### Example 1: Creating Provider Entry

```typescript
// BEFORE (BROKEN)
const provider: VoiceProviderEntry = {
  id: "primary",
  type: "stt",          // ← Can't indicate both channels
  enabled: true,
  priority: 1,
  config: {             // ← No type safety
    type: "local",
    model: "whisper"
  },
  stt: { ... },         // ✗ TS2353: 'stt' does not exist
  tts: { ... }          // ✗ TS2353: 'tts' does not exist
};

// AFTER (FIXED)
const provider: VoiceProviderEntry = {
  id: "primary",
  name: "Primary Provider",  // ✓ Now required
  type: "stt",               // ✓ Primary channel
  enabled: true,
  priority: 1,
  stt: {                     // ✓ Now exists
    type: "local",           // ✓ "local" now valid
    model: "whisper",
    language: "en"           // ✓ Now allowed
  },
  tts: {                     // ✓ Now exists
    type: "kokoro",
    model: "kokoro",         // ✓ Now allowed
    voice: "af",
    language: "en",          // ✓ Now allowed
    speed: 1
  }
};
```

### Example 2: Type Guards

```typescript
// BEFORE (BROKEN - always errors)
if (provider.stt) {  // ✗ TS2339: Property 'stt' does not exist
  console.log(provider.stt.type);
}

// AFTER (FIXED)
if (provider.stt) {  // ✓ Now valid
  console.log(provider.stt.type);  // ✓ Safe access
}
if (provider.tts) {  // ✓ Now valid
  console.log(provider.tts.model);  // ✓ Safe access
}
```

### Example 3: Migration

```typescript
// BEFORE (BROKEN)
const result: VoiceProvidersConfig = {
  providers: entries,
  defaultTtsProviderId: "el1",  // ✗ Property doesn't exist
  systemCapabilities: caps      // ✗ Property doesn't exist
};

// AFTER (FIXED)
const result: VoiceProvidersConfig = {
  enabled: true,
  providers: entries,
  defaultTtsProviderId: "el1",  // ✓ Now exists
  systemCapabilities: caps,     // ✓ Now exists
  autoDetectCapabilities: true
};
```

---

## Summary

The voice providers system has a **schema-code mismatch** where:

1. **Schema is too generic** - uses `Record<string, unknown>` instead of typed properties
2. **Code expects typed properties** - all code assumes `stt` and `tts` exist
3. **Enums are incomplete** - "local" is missing from provider type enums
4. **Required fields are missing** - name, model, language, defaults, metadata

**The fix requires updating the schema to match what the code needs** - no algorithm changes, no breaking changes, just proper type definitions.
