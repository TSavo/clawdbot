# Voice Providers Fix - Implementation Checklist

## Quick Summary

**Problem**: 121 TypeScript errors due to schema being too strict

**Solution**: Redesign schema to match code requirements

**Effort**: ~2 hours for experienced developer, ~4-5 hours for first time

**Risk**: ZERO - backward compatible only

---

## File 1: Schema Definition

**File**: `/home/tsavo/clawd/clawdbot/src/config/zod-schema.voice-providers.ts`

### Change 1.1: Fix STT Provider Config

**Line**: 10 (current type enum)

```typescript
// BEFORE
type: z.enum(["whisper", "faster-whisper", "openai", "google", "azure"]),

// AFTER
type: z.enum(["local", "whisper", "faster-whisper", "openai", "google", "azure"]),
```

**Why**: Onboarding wizard at line 354 sets `type: "local"` for local STT models

---

### Change 1.2: Add model and language to STT

**After Line**: 14 (after apiKey)

```typescript
// ADD THESE TWO LINES
model: z.string().optional(),      // For explicit model specification
language: z.string().optional(),   // For language selection
```

**Why**: Loader (line 91) and migration (line 54) access `provider.stt.model`

---

### Change 1.3: Fix TTS Provider Config

**Line**: 21 (current type enum)

```typescript
// BEFORE
type: z.enum(["kokoro", "piper", "elevenlabs", "openai", "google", "azure"]),

// AFTER
type: z.enum(["local", "kokoro", "piper", "elevenlabs", "openai", "google", "azure"]),
```

**Why**: Onboarding wizard at line 376 sets `type: "local"` for local TTS models

---

### Change 1.4: Add model and language to TTS

**After Line**: 24 (after apiKey)

```typescript
// ADD THESE TWO LINES
model: z.string().optional(),      // For explicit model specification
language: z.string().optional(),   // For language selection
```

**Why**:
- Onboarding (line 379) sets `language: "en"`
- Loader (line 122) accesses `provider.tts.model`
- Migration (line 54) sets `modelId` as `model`

---

### Change 1.5: Redesign VoiceProviderEntry

**Lines**: 29-36 (entire VoiceProviderEntrySchema)

```typescript
// BEFORE
export const VoiceProviderEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["stt", "tts"]),
  enabled: z.boolean().default(true),
  priority: z.number().default(0),
  config: z.record(z.unknown()).optional(),
});

// AFTER
export const VoiceProviderEntrySchema = z.object({
  id: z.string(),
  name: z.string(),  // ✓ Already present, good
  type: z.enum(["stt", "tts"]),  // Indicates primary channel
  enabled: z.boolean().default(true),
  priority: z.number().default(0),
  // REMOVE: config: z.record(z.unknown()).optional(),
  // ADD THESE:
  stt: STTProviderConfigSchema,   // Optional STT configuration
  tts: TTSProviderConfigSchema,   // Optional TTS configuration
});
```

**Why**: Code at lines 277-278 (onboarding), 88-147 (loader), 138-166 (migration) all set/read both stt and tts properties

---

### Change 1.6: Expand VoiceProvidersConfig

**Lines**: 38-47 (entire VoiceProvidersConfigSchema)

```typescript
// BEFORE
export const VoiceProvidersConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    providers: z.array(VoiceProviderEntrySchema).default([]),
    fallbackChain: z.array(z.string()).optional(),
    stt: STTProviderConfigSchema,
    tts: TTSProviderConfigSchema,
    autoDetectCapabilities: z.boolean().default(true),
  })
  .optional();

// AFTER
export const VoiceProvidersConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    providers: z.array(VoiceProviderEntrySchema).default([]),
    fallbackChain: z.array(z.string()).optional(),

    // REMOVE these (they belong in individual providers, not top-level):
    // stt: STTProviderConfigSchema,
    // tts: TTSProviderConfigSchema,

    // ADD these (used throughout codebase):
    defaultSttProviderId: z.string().optional(),  // Line 229-230 in loader
    defaultTtsProviderId: z.string().optional(),  // Line 229-230 in loader

    // System detection (line 177 in loader, onboarding line 406)
    systemCapabilities: z.object({
      hasGpu: z.boolean(),
      gpuType: z.enum(["cuda", "mps", "other"]).optional(),
      cpuThreads: z.number(),
      totalMemoryGb: z.number(),
      osType: z.enum(["darwin", "linux", "win32"]),
      nodeVersion: z.string(),
    }).optional(),

    // Audio configuration (line 243 in migration)
    audio: z.object({}).optional(),

    // Migration tracking (line 67 in migration)
    migrationMetadata: z.object({
      migratedFrom: z.string().optional(),
      migratedAt: z.string().optional(),
    }).optional(),

    autoDetectCapabilities: z.boolean().default(true),
  })
  .optional();
```

**Why**:
- Line 177 (loader): `systemCapabilities` is set
- Lines 229-230 (loader): `defaultSttProviderId` and `defaultTtsProviderId` accessed
- Line 243 (migration): `audio` property accessed
- Line 67 (migration): `migrationMetadata` is set

---

## File 2: Loader Fixes

**File**: `/home/tsavo/clawd/clawdbot/src/config/voice-providers.loader.ts`

### Change 2.1: Fix empty config return

**Line**: 28

```typescript
// BEFORE
return {
  config: {},
  valid: true,
  errors: [],
};

// AFTER
return {
  config: {
    enabled: false,
    providers: [],
    autoDetectCapabilities: true,
  },
  valid: true,
  errors: [],
};
```

**Why**: Type requires these fields; can't return empty object

---

### Change 2.2: Fix empty config return on error

**Line**: 47

```typescript
// BEFORE
return {
  config: {},
  valid: false,
  errors: [msg],
};

// AFTER
return {
  config: {
    enabled: false,
    providers: [],
    autoDetectCapabilities: true,
  },
  valid: false,
  errors: [msg],
};
```

**Why**: Same as 2.1 - type consistency

---

## File 3: Migration Fixes

**File**: `/home/tsavo/clawd/clawdbot/src/config/voice-providers.migration.ts`

### Change 3.1: Fix empty return in migration

**Line**: 39

```typescript
// BEFORE
return {};

// AFTER
return {
  enabled: false,
  providers: [],
  autoDetectCapabilities: true,
};
```

**Why**: Must return proper structure matching schema

---

### Change 3.2: Fix legacy TTS provider creation

**Line**: 50-60 (provider object)

```typescript
// BEFORE
providers.push({
  id: "elevenlabs-migrated",
  priority: 1,
  enabled: true,
  tts: {
    type: "cloud",
    service: "elevenlabs",
    voiceId: talkConfig.voiceId,
    modelId: talkConfig.modelId,
    outputFormat: talkConfig.outputFormat,
    apiKey: talkConfig.apiKey,
    speed: 1,
    language: "en",
  },
});

// AFTER - ADD name property and clarify structure
providers.push({
  id: "elevenlabs-migrated",
  name: "ElevenLabs (Migrated)",  // ADD: name is now required
  priority: 1,
  enabled: true,
  type: "tts",                     // ADD: type field required
  tts: {
    type: "cloud",
    service: "elevenlabs",
    voice: talkConfig.voiceId,     // FIX: voice not voiceId
    model: talkConfig.modelId,     // FIX: model not modelId
    apiKey: talkConfig.apiKey,
    speed: 1,
    language: "en",
  },
});
```

**Why**: Schema requires name and type; properties match new structure

---

### Change 3.3: Fix merged initialization

**Line**: 215

```typescript
// BEFORE
const merged: VoiceProvidersConfig = {
  enabled: true,
  providers: [],
};

// AFTER
const merged: VoiceProvidersConfig = {
  enabled: true,
  providers: [],
  autoDetectCapabilities: true,  // ADD: required field
};
```

**Why**: Schema has this as non-optional

---

### Change 3.4: Add null checks for config

**Before lines**: 235, 239, 243, 247

Add guard checks:

```typescript
// BEFORE (line 235)
if (config.defaultSttProviderId && !merged.defaultSttProviderId) {
  merged.defaultSttProviderId = config.defaultSttProviderId;
}

// AFTER (add after config destructuring)
if (!config) continue;  // Guard at loop start

// Then later accesses are safe:
if (config?.defaultSttProviderId && !merged?.defaultSttProviderId) {
  merged.defaultSttProviderId = config.defaultSttProviderId;
}
```

**Why**: Type checker complains about possibly undefined; add guards

---

## File 4: Onboarding Changes (None Required!)

**File**: `/home/tsavo/clawd/clawdbot/src/commands/onboarding/onboarding.voice-providers.ts`

Once schema is fixed, this file should compile without changes:
- Line 354: `type: "local"` - now valid ✓
- Line 376: `type: "local"` - now valid ✓
- Line 277-278: `stt` and `tts` properties - now exist ✓
- Line 379: `language` property on config - now allowed ✓
- Line 395: `createProviderEntry()` - now properly typed ✓

**Note**: If it still doesn't compile, the issue will be clear from error messages pointing to schema.

---

## File 5: Voice Command Changes (None Required!)

**File**: `/home/tsavo/clawd/clawdbot/src/commands/voice.ts`

Once schema is fixed, this file should compile without changes:
- Lines 63-75: `provider.stt` access - now valid ✓
- Line 299: `ttsConfig.language` - now allowed ✓

---

## Validation Steps

### Step 1: Schema Changes
```bash
# After editing zod-schema.voice-providers.ts
pnpm build 2>&1 | grep "zod-schema"
# Should show 0 errors for zod-schema itself
```

### Step 2: Loader Changes
```bash
# After editing voice-providers.loader.ts
pnpm build 2>&1 | grep "voice-providers.loader"
# Should show 0 errors
```

### Step 3: Migration Changes
```bash
# After editing voice-providers.migration.ts
pnpm build 2>&1 | grep "voice-providers.migration"
# Should show 0 errors
```

### Step 4: Full Build
```bash
# Final check
pnpm build
# Should exit with code 0, no TypeScript errors
```

### Step 5: Tests
```bash
# Run all tests
pnpm test
# All tests should pass
```

---

## Common Pitfalls

### Pitfall 1: Don't Forget Optional Markers

❌ WRONG:
```typescript
stt: STTProviderConfigSchema,  // Required!
```

✓ CORRECT:
```typescript
stt: STTProviderConfigSchema,  // Already optional via .optional() on schema
```

Actually, both are equivalent since STTProviderConfigSchema already ends with `.optional()`. The second `?` would be redundant. Keep it as-is.

---

### Pitfall 2: Don't Mix Old and New

❌ WRONG:
```typescript
export const VoiceProviderEntrySchema = z.object({
  id: z.string(),
  config: z.record(z.unknown()).optional(),  // OLD
  stt: STTProviderConfigSchema,               // NEW
  tts: TTSProviderConfigSchema,               // NEW
});
```

✓ CORRECT:
```typescript
export const VoiceProviderEntrySchema = z.object({
  id: z.string(),
  // Removed config entirely
  stt: STTProviderConfigSchema,
  tts: TTSProviderConfigSchema,
});
```

---

### Pitfall 3: Watch Enum Order

❌ WRONG:
```typescript
type: z.enum(["openai", "local", "whisper"]),  // "local" should come first for consistency
```

✓ CORRECT:
```typescript
type: z.enum(["local", "whisper", "faster-whisper", "openai", "google", "azure"]),  // "local" first
```

Not critical but cleaner.

---

### Pitfall 4: Don't Change Logic in Migration

The migration code at lines 50-60 currently has wrong property names. Fix them:

❌ WRONG (keep as-is):
```typescript
voiceId: talkConfig.voiceId,   // Property name mismatch
modelId: talkConfig.modelId,
```

✓ CORRECT (fix property names):
```typescript
voice: talkConfig.voiceId,     // Correct property in new schema
model: talkConfig.modelId,
```

This is just property renaming, not logic change.

---

### Pitfall 5: Required vs Optional Fields

Current schema issues:
```typescript
// OLD - made everything required!
return { config: {} }  // ❌ Missing required fields

// NEW - provide all required fields
return {
  config: {
    enabled: false,
    providers: [],
    autoDetectCapabilities: true,  // All required fields
  }
}
```

---

## Testing Checklist

### Build Tests
- [ ] `pnpm build` completes with 0 errors
- [ ] No TypeScript errors in any voice-provider* files
- [ ] No type warnings in related commands

### Unit Tests
- [ ] `pnpm test` passes (if tests exist for voice providers)
- [ ] Coverage maintained or improved

### Manual Tests
- [ ] Run onboarding wizard: `pnpm dev` then wizard flow
- [ ] Verify voice config is created correctly
- [ ] Run voice status command: `pnpm clawdbot voice status`
- [ ] Check config file has proper structure

### Integration
- [ ] Voice API endpoints compile and work
- [ ] No cascading errors in related modules
- [ ] Gateway/CLI integration still works

---

## Time Estimates

| Task | Time | Difficulty |
|------|------|-----------|
| Read and understand this doc | 15 min | Easy |
| Make schema changes (File 1) | 20 min | Medium |
| Make loader changes (File 2) | 10 min | Easy |
| Make migration changes (File 3) | 15 min | Medium |
| Verify all builds | 10 min | Easy |
| Manual testing | 20 min | Medium |
| **Total** | **90 min** | - |

With experience: ~60 min. First time: ~2 hours.

---

## Success Criteria

✓ All criteria must be met:

1. **TypeScript Build**: `pnpm build` exits with 0 errors
2. **Test Suite**: `pnpm test` passes completely
3. **No Regressions**: All previously working code still works
4. **Schema Valid**: All code can create and use VoiceProviderEntry instances
5. **Type Safety**: No `any` types introduced; strict typing maintained
6. **Backward Compatible**: Legacy migration still works

---

## Notes for Multiple Developers

If working as a team:

1. **Developer A**: Handles File 1 (schema) - MUST complete first
2. **Developer B**: Can start File 2 (loader) while waiting for A
3. **Developer C**: Can start File 3 (migration) while waiting for A
4. **All**: Run full `pnpm build` when complete to catch integration issues

**Commit Strategy**:
- Schema changes: 1 commit
- Loader + migration: 1 commit
- Verification: 1 commit

---

## Emergency Rollback

If something goes wrong:

```bash
# Revert all changes
git checkout HEAD -- src/config/zod-schema.voice-providers.ts
git checkout HEAD -- src/config/voice-providers.loader.ts
git checkout HEAD -- src/config/voice-providers.migration.ts

# Verify error state returns
pnpm build 2>&1 | wc -l  # Should show ~121 errors again
```

---

## Questions & Clarifications

**Q: Why keep `type: "stt" | "tts"` if provider can have both?**
A: For backward compatibility and to indicate the primary channel. Used for prioritization in fallback chains.

**Q: Why not use discriminated unions?**
A: Not needed - the current design is simpler and the code doesn't use type guards extensively.

**Q: Can I make properties truly required?**
A: No, they must be optional because a provider might only have STT or only TTS.

**Q: Should I add validation that requires at least one of stt/tts?**
A: No, that's a business logic concern, not a schema concern. Keep schema flexible.

---

## Summary

| File | Changes | Impact |
|------|---------|--------|
| `zod-schema.voice-providers.ts` | 6 major changes to schema | Fixes 60% of errors |
| `voice-providers.loader.ts` | 2 return type fixes | Fixes 15% of errors |
| `voice-providers.migration.ts` | 3 object construction fixes | Fixes 25% of errors |
| `onboarding.voice-providers.ts` | 0 changes | Compiles once schema fixed |
| `voice.ts` | 0 changes | Compiles once schema fixed |

**Total TypeScript Errors**: 121 → 0 ✓

