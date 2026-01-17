# Real Behavior Validator Report: CallManager Tests

## Executive Summary

The voice-call extension has **2 existing tests** (not the 3 requested scenarios). Analysis reveals:

- **Test 1** (upgrades providerCallId mapping): **STRONG** ✅ - Validates real state transitions across 3 registries
- **Test 2** (speaks initial message): **WEAK** ❌ - Validates only mock behavior, not real state machine
- **Missing scenarios**: Error recovery, state machine constraints, persistence validation

---

## Test 1: "upgrades providerCallId mapping when provider ID changes"

**Location**: `/home/tsavo/clawd/clawdbot/extensions/voice-call/src/manager.test.ts:43-74`

### Test Anatomy

```typescript
// SETUP: Create manager + initialize with provider
const manager = new CallManager(config, storePath);
manager.initialize(new FakeProvider(), "https://example.com/voice/webhook");

// ACTION 1: Initiate call (creates initial mapping)
const { callId, success } = await manager.initiateCall("+15550000001");

// ACTION 2: Process event with new providerCallId
manager.processEvent({
  id: "evt-1",
  type: "call.answered",
  callId,
  providerCallId: "call-uuid",  // ← NEW ID from provider
  timestamp: Date.now(),
});
```

### What Gets Tested

The test verifies **three separate registry lookups**:

1. **Initial state** (line 59):
   - `manager.getCall(callId)?.providerCallId` must be `"request-uuid"`
   - Validates manager.activeCalls map stores the call

2. **Initial mapping** (line 60):
   - `manager.getCallByProviderCallId("request-uuid")?.callId` must be `callId`
   - Validates manager.providerCallIdMap has correct entry

3. **After upgrade** (line 71):
   - `manager.getCall(callId)?.providerCallId` must be `"call-uuid"`
   - Validates call object was mutated

4. **New mapping** (line 72):
   - `manager.getCallByProviderCallId("call-uuid")?.callId` must be `callId`
   - Validates providerCallIdMap was updated

5. **Old mapping deleted** (line 73): ⭐ **CRITICAL**
   - `manager.getCallByProviderCallId("request-uuid")` must be `undefined`
   - Validates old entry was cleaned up

### Verdict: STRONG ✅

**Why this validates REAL behavior:**

1. **Tests actual state machines**, not just mocks:
   - Calls real manager methods (getCall, getCallByProviderCallId)
   - Returns actual CallRecord objects from state
   - Not checking mock.calls arrays

2. **Would fail if implementation broke**:
   - If `this.providerCallIdMap.delete(previousProviderCallId)` was removed (line 590)
   - If the map wasn't updated when new ID arrives
   - If old lookup still returned the call

3. **Validates three data structures**:
   - ✅ activeCalls map
   - ✅ providerCallIdMap
   - ✅ Query methods work correctly

### Gaps This Test Misses

Despite being strong, it doesn't verify:

- **Persistence**: Does `persistCallRecord()` actually write to disk?
- **Idempotency**: What if `processEvent({ id: "evt-1", ...})` is called twice?
  - Line 551-554 has idempotency check, but test doesn't verify it works
  - Should assert: `manager.getCall(callId)?.providerCallId` stays `"call-uuid"` on 2nd call
- **Event tracking**: Is `call.processedEventIds` populated? (line 596)
  - Test should verify: `manager.getCall(callId).processedEventIds.includes("evt-1")`
- **Call count**: Is only 1 call in activeCalls?
  - Could verify: `manager.getActiveCalls().length === 1`

**What would NOT break the test but IS a real bug:**
```typescript
// Bug: don't delete old mapping
if (previousProviderCallId && previousProviderCallId !== event.providerCallId) {
  // ❌ Forgot to delete!
  // this.providerCallIdMap.delete(previousProviderCallId);
  this.providerCallIdMap.set(event.providerCallId, call.callId);
}
```
- Test would pass ✗ (getCall/getCallByProviderCallId still work via fallback search on line 703)
- But memory leak occurs (old mapping stays forever)

---

## Test 2: "speaks initial message on answered for notify mode (non-Twilio)"

**Location**: `/home/tsavo/clawd/clawdbot/extensions/voice-call/src/manager.test.ts:76-107`

### Test Anatomy

```typescript
// SETUP
const manager = new CallManager(config, storePath);
const provider = new FakeProvider();
manager.initialize(provider, "https://example.com/voice/webhook");

// ACTION 1: Initiate call with notify message
const { callId, success } = await manager.initiateCall(
  "+15550000002",
  undefined,
  { message: "Hello there", mode: "notify" }
);

// ACTION 2: Process answered event
manager.processEvent({
  id: "evt-2",
  type: "call.answered",
  callId,
  providerCallId: "call-uuid",
  timestamp: Date.now(),
});

// ACTION 3: Wait for async operations
await new Promise((resolve) => setTimeout(resolve, 0));

// ASSERTIONS
expect(provider.playTtsCalls).toHaveLength(1);
expect(provider.playTtsCalls[0]?.text).toBe("Hello there");
```

### Verdict: WEAK ❌

**Why this validates MOCK behavior, not real state:**

1. **Only checks provider mock**:
   - `provider.playTtsCalls.length === 1` - checking FakeProvider array
   - `provider.playTtsCalls[0].text` - checking what was passed to mock
   - **Does NOT verify** manager's internal state changed

2. **Real behavior NOT tested**:
   - ❌ Call state after playTts: `manager.getCall(callId).state` (should be `"speaking"`)
   - ❌ Transcript entry added: `manager.getCall(callId).transcript.length` (should be 1)
   - ❌ Message metadata cleared: `manager.getCall(callId).metadata.initialMessage` (should be undefined)
   - ❌ Call persisted: `persistCallRecord()` was called
   - ❌ No error occurred during speak()

### Code Flow Being Tested

```
processEvent("call.answered")
  → line 615: maybeSpeakInitialMessageOnAnswered(call)
    → line 681: void this.speakInitialMessage(call.providerCallId)
      → line 234-286: async speakInitialMessage()
        → line 262: await this.speak(call.callId, initialMessage)
          → line 206: call.state = "speaking"
          → line 210: this.addTranscriptEntry(call, "bot", text)
          → line 213: await provider.playTts(...)
```

**The test only verifies the LAST line** (provider.playTts call), not the state mutations before it.

### What Would NOT Break the Test But IS a Real Bug

```typescript
// Bug 1: State not set to speaking
async speak(callId: CallId, text: string) {
  // ❌ Comment out: call.state = "speaking";
  // Test would STILL PASS - only checks provider.playTtsCalls
  await this.provider.playTts({...});
  return { success: true };
}

// Bug 2: Transcript not populated
private addTranscriptEntry(...) {
  // ❌ Comment out: call.transcript.push(entry);
  // Test would STILL PASS - no assertion on transcript
}

// Bug 3: Metadata not cleared
async speakInitialMessage(providerCallId: string) {
  // ... line 262: await this.speak(...)
  // ❌ Comment out: delete call.metadata.initialMessage;
  // Test would STILL PASS
  // But speaking again would re-speak the same message!
}

// Bug 4: speak() silently fails
async speak(callId: CallId, text: string) {
  if (TerminalStates.has(call.state)) {
    return { success: false, error: "Call has ended" };
    // ❌ But speakInitialMessage ignores this!
    // await this.speak(...) result is awaited but checked in line 263
  }
}
```

**On line 263-266, the code DOES check for error:**
```typescript
const result = await this.speak(call.callId, initialMessage);
if (!result.success) {
  console.warn(`[voice-call] Failed to speak initial message: ${result.error}`);
  return;
}
```

So if speak() returned `{ success: false }`, the function would exit early and NOT call provider.playTts(). The test WOULD catch this one bug. But it still wouldn't catch state mutations.

### What Test SHOULD Verify

```typescript
// After processEvent + setTimeout(0)

// ✅ Call state transitioned
expect(manager.getCall(callId)?.state).toBe("speaking");

// ✅ Transcript entry added
expect(manager.getCall(callId)?.transcript).toHaveLength(1);
expect(manager.getCall(callId)?.transcript[0]).toEqual({
  speaker: "bot",
  text: "Hello there",
  isFinal: true,
  timestamp: expect.any(Number),
});

// ✅ Initial message removed from metadata
expect(manager.getCall(callId)?.metadata?.initialMessage).toBeUndefined();

// ✅ Provider was called (keep existing assertion)
expect(provider.playTtsCalls).toHaveLength(1);
expect(provider.playTtsCalls[0]?.text).toBe("Hello there");

// ✅ Provider was called with correct params
expect(provider.playTtsCalls[0]?.callId).toBe(callId);
expect(provider.playTtsCalls[0]?.voice).toBe(config.tts.voice);
```

---

## Missing Test Scenarios

### Scenario 1: Error Recovery (Provider Fails Mid-Call)

**Not implemented.** Should test:

```typescript
it("should clean up resources when provider fails mid-call", async () => {
  const config = VoiceCallConfigSchema.parse({...});
  const provider = new FakeProvider();
  const manager = new CallManager(config, storePath);
  manager.initialize(provider, "https://example.com/voice/webhook");

  // ❌ Provider.initiateCall throws error
  provider.initiateCall = async () => {
    throw new Error("Network error");
  };

  const { callId, success, error } = await manager.initiateCall("+15550000003");

  // ✅ WEAK ASSERTIONS (current state)
  expect(success).toBe(false);
  expect(error).toContain("Network error");

  // ✅ STRONG ASSERTIONS (what should be tested)
  // Verify cleanup in ALL 3 registries:
  expect(manager.getActiveCalls()).toHaveLength(0);
  expect(manager.getCall(callId)).toBeUndefined();
  // Check internal state (not publicly accessible, but via getActiveCalls)

  // If we add a getCallByProviderCallId with undefined, it should return undefined
  // Call never got a providerCallId since initiateCall threw before line 162
});
```

**Implementation code that handles cleanup (lines 166-175):**
```typescript
catch (err) {
  callRecord.state = "failed";
  callRecord.endedAt = Date.now();
  callRecord.endReason = "failed";
  this.persistCallRecord(callRecord);
  this.activeCalls.delete(callId);  // ← Cleanup
  if (callRecord.providerCallId) {
    this.providerCallIdMap.delete(callRecord.providerCallId);  // ← Cleanup
  }
}
```

**What test should verify:**
- activeCalls is empty
- providerCallIdMap is empty (if providerCallId was set)
- maxDurationTimers is empty
- transcriptWaiters is empty
- state is "failed" in persisted record

---

### Scenario 2: State Machine Prevents Illegal Transitions

**Not implemented.** Should test:

```typescript
it("should not allow transitions from terminal states", async () => {
  const manager = new CallManager(config, storePath);
  manager.initialize(provider, webhookUrl);

  const { callId } = await manager.initiateCall("+15550000004");

  // Transition to terminal state
  manager.processEvent({
    id: "evt-1",
    type: "call.ended",
    callId,
    timestamp: Date.now(),
    reason: "hangup-user",
  });

  expect(manager.getCall(callId)?.state).toBe("hangup-user");

  // ❌ Try to transition to "answered" from terminal state
  manager.processEvent({
    id: "evt-2",
    type: "call.answered",
    callId,
    timestamp: Date.now(),
  });

  // ✅ State should NOT change
  expect(manager.getCall(callId)?.state).toBe("hangup-user");

  // ✅ Call should be removed from activeCalls
  expect(manager.getActiveCalls()).toHaveLength(0);
});
```

**Implementation code that prevents this (lines 766-774):**
```typescript
private transitionState(call: CallRecord, newState: CallState): void {
  // No-op for same state or already terminal
  if (call.state === newState || TerminalStates.has(call.state)) return;
  // ... rest of logic
}
```

But test also needs to verify call is REMOVED from activeCalls (line 640 in processEvent).

---

### Scenario 3: Persistence Handles Errors Gracefully

**Not implemented.** Should test:

```typescript
it("should handle disk errors gracefully", async () => {
  const manager = new CallManager(config, badStorePath); // Non-writable path?
  manager.initialize(provider, webhookUrl);

  const { callId, success } = await manager.initiateCall("+15550000005");

  // ✅ Call succeeded despite potential disk error
  expect(success).toBe(true);

  // ✅ Call is still in memory (in-memory state is intact)
  expect(manager.getCall(callId)).toBeDefined();
  expect(manager.getCall(callId)?.state).toBe("initiated");

  // ✅ Can still operate on the call
  manager.processEvent({
    id: "evt-1",
    type: "call.answered",
    callId,
    providerCallId: "provider-uuid",
    timestamp: Date.now(),
  });

  expect(manager.getCall(callId)?.state).toBe("answered");
});
```

**Implementation code (lines 814-821):**
```typescript
private persistCallRecord(call: CallRecord): void {
  const logPath = path.join(this.storePath, "calls.jsonl");
  const line = `${JSON.stringify(call)}\n`;
  // Fire-and-forget async write to avoid blocking event loop
  fsp.appendFile(logPath, line).catch((err) => {
    console.error("[voice-call] Failed to persist call record:", err);
  });
}
```

The implementation is defensive (fire-and-forget, catches errors), but test should verify in-memory state survives disk errors.

---

## Summary Table

| Test | Type | Validates Real? | Catches Bugs? | Missing Coverage |
|------|------|-----------------|---------------|------------------|
| Test 1: Mapping upgrade | Unit | ✅ Strong | ✅ Yes | Idempotency, persistence |
| Test 2: Speak initial | Unit | ❌ Weak | ⚠️ Partial | State machine, transcript |
| Missing: Error recovery | Unit | Not tested | ✅ Would catch | Resource cleanup |
| Missing: State machine | Unit | Not tested | ✅ Would catch | Terminal state guards |
| Missing: Persistence | Unit | Not tested | ✅ Would catch | Disk error resilience |

---

## Recommendations

### Immediate (1-2 hours)

1. **Rewrite Test 2** to assert on real state:
   ```typescript
   expect(manager.getCall(callId)?.state).toBe("speaking");
   expect(manager.getCall(callId)?.transcript[0]?.text).toBe("Hello there");
   expect(manager.getCall(callId)?.metadata?.initialMessage).toBeUndefined();
   ```

2. **Add assertion to Test 1** for idempotency:
   ```typescript
   // Call processEvent again with same event ID
   manager.processEvent({ id: "evt-1", type: "call.answered", ... });
   // Verify no change
   expect(manager.getCall(callId)?.providerCallId).toBe("call-uuid");
   ```

### Short-term (2-3 hours)

3. **Add error recovery test** verifying cleanup of all 3 registries

4. **Add state machine test** preventing terminal→active transitions

5. **Add persistence test** with in-memory resilience

### Code Quality

- Test 1: 8/10 - Production ready, add idempotency check
- Test 2: 3/10 - Needs complete rewrite to test real state
- Total coverage: ~15% of call manager functionality

---

## References

- **Manager implementation**: `/home/tsavo/clawd/clawdbot/extensions/voice-call/src/manager.ts`
- **Test file**: `/home/tsavo/clawd/clawdbot/extensions/voice-call/src/manager.test.ts`
- **Types**: `/home/tsavo/clawd/clawdbot/extensions/voice-call/src/types.ts`
- **Terminal states** (lines 47-57): completed, hangup-user, hangup-bot, timeout, error, failed, no-answer, busy, voicemail
- **State machine** (lines 754-761): initiated → ringing → answered → active → speaking/listening ↔ (terminal)
