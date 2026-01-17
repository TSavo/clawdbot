/**
 * Integration Tests: Timeout Enforcement During Calls
 *
 * Tests real timeout mechanisms:
 * - Max duration timer fires and auto-hangs up calls
 * - Timer is cleared when call ends naturally before timeout
 * - Multiple concurrent calls each have their own timeout
 * - Different maxDurationSeconds config values are respected
 */

import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CallManager } from "../manager.js";
import { MockVoiceProvider } from "./mocks/providers.js";
import { createMockConfig } from "./mocks/config.js";
import type { NormalizedEvent } from "../types.js";

describe("Timeout Enforcement - Real Timer Tests", () => {
  let tempDir: string;
  let mockProvider: MockVoiceProvider;
  let config: any;
  const webhookUrl = "https://example.com/webhook";

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `voice-timeout-${Date.now()}`);
    mockProvider = new MockVoiceProvider();
    // 2 second timeout for tests to keep tests fast
    config = createMockConfig({
      provider: "mock",
      maxDurationSeconds: 2,
    });
  });

  afterEach(() => {
    mockProvider.reset();
  });

  describe("Max Duration Timer", () => {
    it("should auto-hangup when maxDurationSeconds expires", async () => {
      const manager = new CallManager(config, tempDir);
      manager.initialize(mockProvider, webhookUrl);

      const result = await manager.initiateCall("+15550000001");
      expect(result.success).toBe(true);
      const callId = result.callId!;

      // Move to answered (starts duration timer)
      manager.processEvent({
        id: "evt-answered",
        type: "call.answered",
        callId,
        timestamp: Date.now(),
      } as NormalizedEvent);

      const callBeforeTimeout = manager.getCall(callId);
      expect(callBeforeTimeout).toBeDefined();
      expect(callBeforeTimeout?.state).toBe("answered");

      // Wait for timeout to fire (2 seconds + buffer)
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Call should be removed (auto-hangup completed)
      expect(manager.getCall(callId)).toBeUndefined();
      expect(manager.getActiveCalls().length).toBe(0);

      // Provider should have received hangup call
      expect(mockProvider.hangupCallCalls.length).toBeGreaterThan(0);
    });

    it("should clear timer when call ends before timeout", async () => {
      const manager = new CallManager(config, tempDir);
      manager.initialize(mockProvider, webhookUrl);

      const result = await manager.initiateCall("+15550000002");
      expect(result.success).toBe(true);
      const callId = result.callId!;

      // Move to answered (starts timer)
      manager.processEvent({
        id: "evt-answered",
        type: "call.answered",
        callId,
        timestamp: Date.now(),
      } as NormalizedEvent);

      // End call quickly (before 2 second timeout)
      manager.processEvent({
        id: "evt-ended",
        type: "call.ended",
        callId,
        timestamp: Date.now(),
        direction: "outbound",
        endReason: "completed",
      } as NormalizedEvent);

      // Wait to see if timeout still fires
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Call should be removed (normal end, not timeout)
      expect(manager.getCall(callId)).toBeUndefined();
      // Should only have 1 hangup call (from normal end, not timeout)
      expect(mockProvider.hangupCallCalls.length).toBeLessThanOrEqual(1);
    });

    it(
      "should handle multiple concurrent calls with different timeouts",
      { timeout: 10000 },
      async () => {
        const concurrentConfig = createMockConfig({
          provider: "mock",
          maxDurationSeconds: 2,
          maxConcurrentCalls: 5, // Allow multiple concurrent calls
        });
        const manager = new CallManager(concurrentConfig, tempDir);
        manager.initialize(mockProvider, webhookUrl);

        const result1 = await manager.initiateCall("+15550000003");
        const result2 = await manager.initiateCall("+15550000004");
        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);

        const callId1 = result1.callId!;
        const callId2 = result2.callId!;

        // Answer both (starts both timers)
        for (const callId of [callId1, callId2]) {
          manager.processEvent({
            id: `evt-answered-${callId}`,
            type: "call.answered",
            callId,
            timestamp: Date.now(),
          } as NormalizedEvent);
        }

        expect(manager.getActiveCalls().length).toBe(2);

        // Wait for timeout
        await new Promise((resolve) => setTimeout(resolve, 2500));

        // Both should be cleaned up
        expect(manager.getCall(callId1)).toBeUndefined();
        expect(manager.getCall(callId2)).toBeUndefined();
        expect(manager.getActiveCalls().length).toBe(0);

        // Both should have been hung up
        expect(mockProvider.hangupCallCalls.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Different Max Duration Config", () => {
    it("should respect custom maxDurationSeconds config (1 second)", async () => {
      const customConfig = createMockConfig({
        provider: "mock",
        maxDurationSeconds: 1,
      });
      const manager = new CallManager(customConfig, tempDir);
      manager.initialize(mockProvider, webhookUrl);

      const result = await manager.initiateCall("+15550000005");
      expect(result.success).toBe(true);
      const callId = result.callId!;

      manager.processEvent({
        id: "evt-answered",
        type: "call.answered",
        callId,
        timestamp: Date.now(),
      } as NormalizedEvent);

      // Wait for 1 second timeout
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Call should be cleaned
      expect(manager.getCall(callId)).toBeUndefined();
      expect(mockProvider.hangupCallCalls.length).toBeGreaterThan(0);
    });

    it("should respect longer maxDurationSeconds config (3 seconds)", async () => {
      const customConfig = createMockConfig({
        provider: "mock",
        maxDurationSeconds: 3,
      });
      const manager = new CallManager(customConfig, tempDir);
      manager.initialize(mockProvider, webhookUrl);

      const result = await manager.initiateCall("+15550000006");
      expect(result.success).toBe(true);
      const callId = result.callId!;

      const startTime = Date.now();
      manager.processEvent({
        id: "evt-answered",
        type: "call.answered",
        callId,
        timestamp: startTime,
      } as NormalizedEvent);

      // Wait shorter than timeout (2 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Call should still exist (timeout is 3 seconds)
      expect(manager.getCall(callId)).toBeDefined();

      // Wait for the rest of the timeout
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Now call should be cleaned
      expect(manager.getCall(callId)).toBeUndefined();
    });
  });

  describe("Timeout with Different Call States", () => {
    it("should not auto-hangup if call never reaches answered state", async () => {
      const manager = new CallManager(config, tempDir);
      manager.initialize(mockProvider, webhookUrl);

      const result = await manager.initiateCall("+15550000007");
      expect(result.success).toBe(true);
      const callId = result.callId!;

      // Leave call in 'initiated' state without answering
      expect(manager.getCall(callId)?.state).toBe("initiated");

      // Wait past the 2 second timeout
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Call should still exist because max duration timer only fires after answered
      // (Initiation timeout is separate and should be ~30s in real implementation)
      expect(manager.getCall(callId)).toBeDefined();
    });
  });

  describe("Rapid State Transitions", () => {
    it("should handle rapid state transitions without timer conflicts", async () => {
      const manager = new CallManager(config, tempDir);
      manager.initialize(mockProvider, webhookUrl);

      const result = await manager.initiateCall("+15550000008");
      expect(result.success).toBe(true);
      const callId = result.callId!;

      // Rapid transition: initiated -> answered -> ended
      manager.processEvent({
        id: "evt-answered",
        type: "call.answered",
        callId,
        timestamp: Date.now(),
      } as NormalizedEvent);

      // Immediately end before timeout
      manager.processEvent({
        id: "evt-ended",
        type: "call.ended",
        callId,
        timestamp: Date.now() + 100,
        direction: "outbound",
        endReason: "completed",
      } as NormalizedEvent);

      // Wait past original timeout
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Call should be cleaned up from normal end, not timeout
      expect(manager.getCall(callId)).toBeUndefined();
      expect(mockProvider.hangupCallCalls.length).toBeLessThanOrEqual(1);
    });
  });
});
