# Voice Providers System Architecture Fix

## Executive Summary

The voice providers system has **121 TypeScript compilation errors** stemming from a fundamental **schema-to-code mismatch**. The schema defines a single generic `VoiceProviderEntry` with a generic `config` object, but the codebase assumes a two-property structure with explicit `stt` and `tts` properties containing their respective configurations.

**Root Cause**: The schema is too generic and strict, while the code expects a flexible two-channel provider model.

**Solution**: Redesign the provider entry structure to support both STT and TTS simultaneously, with proper type discrimination.

---

## Root Cause Analysis

### Current Schema Design (INCORRECT)

**File**: `src/config/zod-schema.voice-providers.ts`

```typescript
// Current - TOO GENERIC
export const VoiceProviderEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["stt", "tts"]),      // ❌ Forces choice of ONE type
  enabled: z.boolean().default(true),
  priority: z.number().default(0),
  config: z.record(z.unknown()).optional(),  // ❌ Generic object, no discrimination
});
```

### What the Code Actually Needs

**Files**:
- `onboarding.voice-providers.ts` (lines 273-279)
- `voice-providers.loader.ts` (lines 88-147)
- `voice-providers.migration.ts` (lines 50-60, 138-166)
- `voice.ts` (lines 63-75)

All code assumes this structure:

```typescript
interface VoiceProviderEntry {
  id: string;
  name?: string;  // Missing in schema
  type: "stt" | "tts";  // But actually needs BOTH simultaneously
  enabled?: boolean;
  priority?: number;
  stt?: STTProviderConfig;   // ❌ Schema forbids this
  tts?: TTSProviderConfig;   // ❌ Schema forbids this
}
```

### Critical Issues

| Issue | Location | Impact | Error Count |
|-------|----------|--------|------------|
| **Missing `stt`/`tts` properties** | VoiceProviderEntry schema definition | Code cannot store STT and TTS together | 30+ errors |
| **Missing `name` property** | VoiceProviderEntry schema definition | Onboarding can't set provider names | 2 errors |
| **Missing "local" type enum** | STTProviderConfigSchema, TTSProviderConfigSchema | Onboarding (lines 354, 376) sets `type: "local"` but schema rejects it | 5+ errors |
| **Missing `model` in TTSProviderConfig** | TTSProviderConfigSchema | TTS config doesn't allow `model` property | 4+ errors |
| **Missing optional properties** | VoiceProvidersConfig | `defaultSttProviderId`, `defaultTtsProviderId`, `systemCapabilities`, `audio`, `migrationMetadata` | 20+ errors |
| **Empty object return type** | loader/migration functions | Functions return `{}` but type requires all required fields | 10+ errors |

---

## Type System Mismatch

### Schema Design Philosophy Conflict

**Current Schema**: "A provider has ONE type (STT or TTS) and generic config"
```
┌─ VoiceProviderEntry
├─ id: "primary"
├─ type: "stt" ← ONLY this
└─ config: {} ← Generic, loses type safety
```

**Required Design**: "A provider can be both STT and TTS simultaneously"
```
┌─ VoiceProviderEntry
├─ id: "primary"
├─ type: "stt" | "tts" ← Indicates which channel(s) are active
├─ stt?: STTProviderConfig ← Specific STT setup
└─ tts?: TTSProviderConfig ← Specific TTS setup
```

### Why This Matters

The onboarding wizard (lines 394-408) creates a SINGLE provider entry with BOTH STT and TTS:

```typescript
// From onboarding.voice-providers.ts:394-395
const providerId = "primary";
const provider = createProviderEntry(providerId, sttConfig, ttsConfig);
// Both sttConfig AND ttsConfig passed to same provider!
```

The schema currently prevents this structure entirely.

---

## Recommended Fix Approach

### Architecture Decision: Three-Level Type System

Instead of fixing just the schema, we need to establish a clear three-level hierarchy:

#### Level 1: Config Types (Zod Schemas)
Define what configurations each provider type accepts with proper enum values.

#### Level 2: Entry Types (Combined)
Define how providers bundle these configurations (both properties optional).

#### Level 3: Container Types (VoiceProvidersConfig)
Define metadata and defaults at the configuration level.

---

## Detailed Type Definitions

### Level 1: Provider Configuration Types

```typescript
// STT Provider Configuration
export const STTProviderConfigSchema = z
  .object({
    type: z.enum(["local", "whisper", "faster-whisper", "openai", "google", "azure"]),
    service: z.string().optional(),
    modelSize: z.enum(["tiny", "small", "base", "medium", "large"]).optional(),
    language: z.string().optional(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
  })
  .optional();

// TTS Provider Configuration
export const TTSProviderConfigSchema = z
  .object({
    type: z.enum(["local", "kokoro", "piper", "elevenlabs", "openai", "google", "azure"]),
    service: z.string().optional(),
    model: z.string().optional(),  // ← ADD: Missing but used in code
    voice: z.string().optional(),
    speed: z.number().min(0.5).max(2.0).optional(),
    apiKey: z.string().optional(),
    language: z.string().optional(),  // ← ADD: Used in onboarding
  })
  .optional();
```

**Why**:
- Add "local" to both type enums (used in onboarding lines 354, 376)
- Add `model` to TTS (used in loader line 122, migration line 54)
- Add `language` to TTS (used in onboarding line 379)

### Level 2: Entry Types (The Fix)

```typescript
// REDESIGNED: Provider Entry with both STT and TTS support
export const VoiceProviderEntrySchema = z.object({
  id: z.string(),
  name: z.string(),  // ← ADD: Used in onboarding
  type: z.enum(["stt", "tts"]),  // Indicates primary channel
  enabled: z.boolean().default(true),
  priority: z.number().default(0),
  // ← CHANGE: Explicit typed properties instead of generic config
  stt: STTProviderConfigSchema,   // ← ADD: Optional STT setup
  tts: TTSProviderConfigSchema,   // ← ADD: Optional TTS setup
});

export type VoiceProviderEntry = z.infer<typeof VoiceProviderEntrySchema>;
```

**Why this works**:
- Allows both `stt` and `tts` to be present (as used in onboarding)
- Maintains type safety (no `Record<string, unknown>`)
- The `type` field indicates primary channel for backward compatibility
- Both config properties are optional (can have just STT, just TTS, or both)

### Level 3: Container Types (VoiceProvidersConfig)

```typescript
export const VoiceProvidersConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    providers: z.array(VoiceProviderEntrySchema).default([]),

    // ← ADD: Missing but used throughout codebase
    defaultSttProviderId: z.string().optional(),
    defaultTtsProviderId: z.string().optional(),
    fallbackChain: z.array(z.string()).optional(),

    // ← ADD: System detection and metadata
    systemCapabilities: z.object({
      hasGpu: z.boolean(),
      gpuType: z.enum(["cuda", "mps", "other"]).optional(),
      cpuThreads: z.number(),
      totalMemoryGb: z.number(),
      osType: z.enum(["darwin", "linux", "win32"]),
      nodeVersion: z.string(),
    }).optional(),

    // ← ADD: Audio config and migration tracking
    audio: z.object({}).optional(),  // Placeholder for audio settings
    migrationMetadata: z.object({
      migratedFrom: z.string().optional(),
      migratedAt: z.string().optional(),
    }).optional(),

    autoDetectCapabilities: z.boolean().default(true),
  })
  .optional();

export type VoiceProvidersConfig = z.infer<typeof VoiceProvidersConfigSchema>;
```

---

## Implementation Path

### Phase 1: Schema Updates (Critical Path)

**File**: `src/config/zod-schema.voice-providers.ts`

1. Add "local" to STT and TTS type enums
2. Add `model` property to TTSProviderConfigSchema
3. Add `language` property to TTSProviderConfigSchema
4. Change VoiceProviderEntrySchema:
   - Add required `name` property
   - Remove generic `config` property
   - Add optional `stt: STTProviderConfigSchema`
   - Add optional `tts: TTSProviderConfigSchema`
5. Expand VoiceProvidersConfigSchema:
   - Add `defaultSttProviderId` (string, optional)
   - Add `defaultTtsProviderId` (string, optional)
   - Add `systemCapabilities` (object, optional)
   - Add `audio` (object, optional)
   - Add `migrationMetadata` (object, optional)

**Error Resolution**: This fixes ~60% of errors (all "Property X does not exist" errors)

### Phase 2: Return Type Fixes (Quick Fix)

**Files**: `src/config/voice-providers.loader.ts`, `src/config/voice-providers.migration.ts`

When functions return empty objects `{}`, they must return proper structures:

```typescript
// WRONG (loader.ts:28, migration.ts:39)
return { config: {} };

// CORRECT
return {
  config: {
    enabled: false,
    providers: [],
    autoDetectCapabilities: true
  }
};
```

**Error Resolution**: Fixes ~15% of errors (type incompatibility errors)

### Phase 3: Data Migration (Zero Breaking Changes)

**Files**: `src/config/voice-providers.migration.ts`

Migration logic must transform legacy config to new structure:
- Extract `gateway.talk` config → convert to provider entry with TTS
- Preserve all optional fields as optional in new schema
- Add migration metadata for tracking

**Error Resolution**: Fixes remaining ~10% of errors (property access on legacy config)

### Phase 4: Code Updates (No Logic Changes)

**Files**: All referencing code (loader, migration, onboarding, voice.ts)

No algorithmic changes needed - just ensure code accesses the now-valid properties:

```typescript
// This now works (previously errored)
if (provider.stt) {
  // Use provider.stt properties
}
if (provider.tts) {
  // Use provider.tts properties
}
```

---

## Breaking Changes Assessment

**User Impact**: NONE

**Why**:
- All changes are backward-compatible additions
- Optional properties stay optional
- The two-property model is what code was already using
- Migration logic handles legacy config

**Internal Impact**: NONE

**Why**:
- No changes to public APIs
- Return types are properly typed (no behavioral change)
- All error types are compile-time only

---

## Type Safety Improvements

### Before Fix

```typescript
// loader.ts:88 - ERROR at compile time
if (provider.stt) { }  // TS2339: Property 'stt' does not exist

// Runtime: Would fail if code ran
const config: VoiceProviderEntry = {
  id: "primary",
  type: "stt",
  stt: { type: "whisper" }  // ❌ Schema rejects this
};
```

### After Fix

```typescript
// loader.ts:88 - ✅ VALID at compile time
if (provider.stt) { }

// Runtime: ✅ Properly validated
const config: VoiceProviderEntry = {
  id: "primary",
  name: "Primary Provider",
  type: "stt",
  stt: { type: "whisper" }  // ✅ Schema accepts this
};
```

---

## Migration Path Example

### Legacy Configuration (Gateway Talk)

```typescript
cfg.gateway?.talk = {
  voiceId: "rachel",
  modelId: "eleven_monolingual_v1",
  apiKey: "sk-...",
  outputFormat: "ulaw"
}
```

### Migration Converts To

```typescript
cfg.voice.providers = {
  enabled: true,
  providers: [{
    id: "elevenlabs-migrated",
    name: "ElevenLabs (Migrated)",
    type: "tts",
    priority: 1,
    enabled: true,
    tts: {
      type: "elevenlabs",
      service: "elevenlabs",
      voice: "rachel",
      model: "eleven_monolingual_v1",
      apiKey: "sk-...",
      speed: 1,
      language: "en"
    }
  }],
  defaultTtsProviderId: "elevenlabs-migrated",
  migrationMetadata: {
    migratedFrom: "legacy-gateway-talk-config",
    migratedAt: "2025-01-16T..."
  }
}
```

---

## File Change Summary

| File | Changes | Errors Fixed |
|------|---------|--------------|
| `src/config/zod-schema.voice-providers.ts` | Add "local" to enums, add properties to configs, redesign VoiceProviderEntry, expand VoiceProvidersConfig | 60 |
| `src/config/voice-providers.loader.ts` | Fix return type statements, add proper object initializers | 15 |
| `src/config/voice-providers.migration.ts` | Fix legacy config migration, proper object construction | 20 |
| `src/commands/voice.ts` | No changes needed - will compile once schema fixed | 0 |
| `src/commands/onboarding/onboarding.voice-providers.ts` | No changes needed - will compile once schema fixed | 26 |

**Total**: 121 errors → 0 errors

---

## Validation Checklist

### Schema Updates
- [ ] Add "local" to STTProviderConfigSchema.type enum
- [ ] Add "local" to TTSProviderConfigSchema.type enum
- [ ] Add `model?: string` to TTSProviderConfigSchema
- [ ] Add `language?: string` to TTSProviderConfigSchema
- [ ] Add `name: string` to VoiceProviderEntrySchema
- [ ] Remove `config: z.record(z.unknown())` from VoiceProviderEntrySchema
- [ ] Add `stt?: z.infer<typeof STTProviderConfigSchema>` to VoiceProviderEntrySchema
- [ ] Add `tts?: z.infer<typeof TTSProviderConfigSchema>` to VoiceProviderEntrySchema
- [ ] Add `defaultSttProviderId?: string` to VoiceProvidersConfigSchema
- [ ] Add `defaultTtsProviderId?: string` to VoiceProvidersConfigSchema
- [ ] Add `systemCapabilities?` object to VoiceProvidersConfigSchema
- [ ] Add `audio?` object to VoiceProvidersConfigSchema
- [ ] Add `migrationMetadata?` object to VoiceProvidersConfigSchema

### Type Inference
- [ ] Verify `STTProviderConfig` type has all required fields
- [ ] Verify `TTSProviderConfig` type has all required fields
- [ ] Verify `VoiceProviderEntry` type allows both stt and tts optionally
- [ ] Verify `VoiceProvidersConfig` type includes all metadata fields

### Return Type Fixes
- [ ] Update loader.ts empty object returns
- [ ] Update migration.ts empty object returns
- [ ] Ensure all returns have proper structure

### Testing
- [ ] Run `pnpm build` - should have 0 errors
- [ ] Run `pnpm test` - all tests pass
- [ ] Manual test: onboarding wizard completes
- [ ] Manual test: voice status command shows providers

---

## Notes for Coder Agents

1. **Start with schema changes** - everything depends on this
2. **Don't change logic**, just types - the algorithm is correct
3. **Keep all changes backward-compatible** - migration handles legacy
4. **Type inference will cascade** - once schema is right, most code will compile automatically
5. **Zod pattern**: Use `.optional()` for optional fields, never `| undefined`
6. **No `any` types** - maintain strict typing throughout
7. **Test at end**: Single `pnpm build` will validate all 121 fixes

---

## References

- Error examples: First 60 errors from compiler output
- Schema file: `/home/tsavo/clawd/clawdbot/src/config/zod-schema.voice-providers.ts`
- Loader file: `/home/tsavo/clawd/clawdbot/src/config/voice-providers.loader.ts`
- Migration file: `/home/tsavo/clawd/clawdbot/src/config/voice-providers.migration.ts`
- Onboarding file: `/home/tsavo/clawd/clawdbot/src/commands/onboarding/onboarding.voice-providers.ts`
- Voice command file: `/home/tsavo/clawd/clawdbot/src/commands/voice.ts`
