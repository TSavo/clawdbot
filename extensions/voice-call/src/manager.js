import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveUserPath } from "./utils.js";
import { CallRecordSchema, TerminalStates, } from "./types.js";
import { escapeXml, mapVoiceToPolly } from "./voice-mapping.js";
/**
 * Manages voice calls: state machine, persistence, and provider coordination.
 *
 * Supports multiple platform-specific call providers:
 * - Discord (voice channels)
 * - Telegram (group calls)
 * - Signal (direct calls)
 * - Twilio (phone calls)
 *
 * Routes incoming calls to the correct provider based on platform.
 */
export class CallManager {
    activeCalls = new Map();
    providerCallIdMap = new Map(); // providerCallId -> internal callId
    processedEventIds = new Set();
    providers = new Map(); // platform -> provider
    primaryProvider = null; // fallback for legacy code
    config;
    storePath;
    webhookUrl = null;
    transcriptWaiters = new Map();
    /** Max duration timers to auto-hangup calls after configured timeout */
    maxDurationTimers = new Map();
    constructor(config, storePath) {
        this.config = config;
        // Resolve store path with tilde expansion (like other config values)
        const rawPath = storePath ||
            config.store ||
            path.join(os.homedir(), "clawd", "voice-calls");
        this.storePath = resolveUserPath(rawPath);
    }
    /**
     * Initialize the call manager with a provider.
     *
     * For backward compatibility, also supports single provider initialization.
     * Use registerProvider() for multi-provider setup.
     */
    initialize(provider, webhookUrl) {
        this.primaryProvider = provider;
        this.providers.set(provider.name, provider);
        this.webhookUrl = webhookUrl;
        // Ensure store directory exists
        fs.mkdirSync(this.storePath, { recursive: true });
        // Load any persisted active calls
        this.loadActiveCalls();
    }
    /**
     * Register a call provider for a specific platform.
     * Allows unified call routing through multiple providers.
     *
     * @param platform - Platform name (discord, telegram, signal, twilio)
     * @param provider - VoiceCallProvider implementation
     */
    registerProvider(platform, provider) {
        this.providers.set(platform, provider);
        if (!this.primaryProvider) {
            this.primaryProvider = provider;
        }
    }
    /**
     * Get a provider by platform name.
     * @param platform - Platform name
     * @returns VoiceCallProvider or undefined if not registered
     */
    getProviderForPlatform(platform) {
        return this.providers.get(platform) ?? null;
    }
    /**
     * Get the primary provider (for backward compatibility).
     */
    getProvider() {
        return this.primaryProvider;
    }
    /**
     * Get all registered providers.
     * @returns Array of registered providers
     */
    getAllProviders() {
        return Array.from(this.providers.values());
    }
    /**
     * Initiate an outbound call.
     * @param to - The phone number to call
     * @param sessionKey - Optional session key for context
     * @param options - Optional call options (message, mode)
     */
    async initiateCall(to, sessionKey, options) {
        // Support legacy string argument for initialMessage
        const opts = typeof options === "string" ? { message: options } : (options ?? {});
        const initialMessage = opts.message;
        const mode = opts.mode ?? this.config.outbound.defaultMode;
        const platformOpt = opts.platform;
        // Select provider: use platform if specified, otherwise use primary provider
        const provider = platformOpt
            ? this.getProviderForPlatform(platformOpt)
            : this.primaryProvider;
        if (!provider) {
            return { callId: "", success: false, error: "Provider not initialized" };
        }
        if (!this.webhookUrl) {
            return {
                callId: "",
                success: false,
                error: "Webhook URL not configured",
            };
        }
        // Check concurrent call limit
        const activeCalls = this.getActiveCalls();
        if (activeCalls.length >= this.config.maxConcurrentCalls) {
            return {
                callId: "",
                success: false,
                error: `Maximum concurrent calls (${this.config.maxConcurrentCalls}) reached`,
            };
        }
        const callId = crypto.randomUUID();
        const from = this.config.fromNumber ||
            (provider?.name === "mock" ? "+15550000000" : undefined);
        if (!from) {
            return { callId: "", success: false, error: "fromNumber not configured" };
        }
        // Create call record with mode in metadata
        const callRecord = {
            callId,
            provider: provider.name,
            direction: "outbound",
            state: "initiated",
            from,
            to,
            sessionKey,
            startedAt: Date.now(),
            transcript: [],
            processedEventIds: [],
            metadata: {
                ...(initialMessage && { initialMessage }),
                mode,
            },
        };
        this.activeCalls.set(callId, callRecord);
        this.persistCallRecord(callRecord);
        try {
            // For notify mode with a message, use inline TwiML with <Say>
            let inlineTwiml;
            if (mode === "notify" && initialMessage) {
                const pollyVoice = mapVoiceToPolly(this.config.tts.voice);
                inlineTwiml = this.generateNotifyTwiml(initialMessage, pollyVoice);
                console.log(`[voice-call] Using inline TwiML for notify mode (voice: ${pollyVoice})`);
            }
            const result = await provider.initiateCall({
                callId,
                from,
                to,
                webhookUrl: this.webhookUrl,
                inlineTwiml,
            });
            callRecord.providerCallId = result.providerCallId;
            this.providerCallIdMap.set(result.providerCallId, callId); // Map providerCallId to internal callId
            this.persistCallRecord(callRecord);
            return { callId, success: true };
        }
        catch (err) {
            callRecord.state = "failed";
            callRecord.endedAt = Date.now();
            callRecord.endReason = "failed";
            this.persistCallRecord(callRecord);
            this.activeCalls.delete(callId);
            if (callRecord.providerCallId) {
                this.providerCallIdMap.delete(callRecord.providerCallId);
            }
            return {
                callId,
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }
    /**
     * Speak to user in an active call.
     */
    async speak(callId, text) {
        const call = this.activeCalls.get(callId);
        if (!call) {
            return { success: false, error: "Call not found" };
        }
        const provider = this.getProviderForPlatform(call.provider);
        if (!provider || !call.providerCallId) {
            return { success: false, error: "Call not connected" };
        }
        if (TerminalStates.has(call.state)) {
            return { success: false, error: "Call has ended" };
        }
        try {
            // Update state
            call.state = "speaking";
            this.persistCallRecord(call);
            // Add to transcript
            this.addTranscriptEntry(call, "bot", text);
            // Play TTS
            await provider.playTts({
                callId,
                providerCallId: call.providerCallId,
                text,
                voice: this.config.tts.voice,
            });
            return { success: true };
        }
        catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }
    /**
     * Speak the initial message for a call (called when media stream connects).
     * This is used to auto-play the message passed to initiateCall.
     * In notify mode, auto-hangup after the message is delivered.
     */
    async speakInitialMessage(providerCallId) {
        const call = this.getCallByProviderCallId(providerCallId);
        if (!call) {
            console.warn(`[voice-call] speakInitialMessage: no call found for ${providerCallId}`);
            return;
        }
        const initialMessage = call.metadata?.initialMessage;
        const mode = call.metadata?.mode ?? "conversation";
        if (!initialMessage) {
            console.log(`[voice-call] speakInitialMessage: no initial message for ${call.callId}`);
            return;
        }
        // Clear the initial message so we don't speak it again
        if (call.metadata) {
            delete call.metadata.initialMessage;
            this.persistCallRecord(call);
        }
        console.log(`[voice-call] Speaking initial message for call ${call.callId} (mode: ${mode})`);
        const result = await this.speak(call.callId, initialMessage);
        if (!result.success) {
            console.warn(`[voice-call] Failed to speak initial message: ${result.error}`);
            return;
        }
        // In notify mode, auto-hangup after delay
        if (mode === "notify") {
            const delaySec = this.config.outbound.notifyHangupDelaySec;
            console.log(`[voice-call] Notify mode: auto-hangup in ${delaySec}s for call ${call.callId}`);
            setTimeout(async () => {
                const currentCall = this.getCall(call.callId);
                if (currentCall && !TerminalStates.has(currentCall.state)) {
                    console.log(`[voice-call] Notify mode: hanging up call ${call.callId}`);
                    await this.endCall(call.callId);
                }
            }, delaySec * 1000);
        }
    }
    /**
     * Start max duration timer for a call.
     * Auto-hangup when maxDurationSeconds is reached.
     */
    startMaxDurationTimer(callId) {
        // Clear any existing timer
        this.clearMaxDurationTimer(callId);
        const maxDurationMs = this.config.maxDurationSeconds * 1000;
        console.log(`[voice-call] Starting max duration timer (${this.config.maxDurationSeconds}s) for call ${callId}`);
        const timer = setTimeout(async () => {
            this.maxDurationTimers.delete(callId);
            const call = this.getCall(callId);
            if (call && !TerminalStates.has(call.state)) {
                console.log(`[voice-call] Max duration reached (${this.config.maxDurationSeconds}s), ending call ${callId}`);
                call.endReason = "timeout";
                this.persistCallRecord(call);
                await this.endCall(callId);
            }
        }, maxDurationMs);
        this.maxDurationTimers.set(callId, timer);
    }
    /**
     * Clear max duration timer for a call.
     */
    clearMaxDurationTimer(callId) {
        const timer = this.maxDurationTimers.get(callId);
        if (timer) {
            clearTimeout(timer);
            this.maxDurationTimers.delete(callId);
        }
    }
    clearTranscriptWaiter(callId) {
        const waiter = this.transcriptWaiters.get(callId);
        if (!waiter)
            return;
        clearTimeout(waiter.timeout);
        this.transcriptWaiters.delete(callId);
    }
    rejectTranscriptWaiter(callId, reason) {
        const waiter = this.transcriptWaiters.get(callId);
        if (!waiter)
            return;
        this.clearTranscriptWaiter(callId);
        waiter.reject(new Error(reason));
    }
    resolveTranscriptWaiter(callId, transcript) {
        const waiter = this.transcriptWaiters.get(callId);
        if (!waiter)
            return;
        this.clearTranscriptWaiter(callId);
        waiter.resolve(transcript);
    }
    waitForFinalTranscript(callId) {
        // Only allow one in-flight waiter per call.
        this.rejectTranscriptWaiter(callId, "Transcript waiter replaced");
        const timeoutMs = this.config.transcriptTimeoutMs;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.transcriptWaiters.delete(callId);
                reject(new Error(`Timed out waiting for transcript after ${timeoutMs}ms`));
            }, timeoutMs);
            this.transcriptWaiters.set(callId, { resolve, reject, timeout });
        });
    }
    /**
     * Continue call: speak prompt, then wait for user's final transcript.
     */
    async continueCall(callId, prompt) {
        const call = this.activeCalls.get(callId);
        if (!call) {
            return { success: false, error: "Call not found" };
        }
        const provider = this.getProviderForPlatform(call.provider);
        if (!provider || !call.providerCallId) {
            return { success: false, error: "Call not connected" };
        }
        if (TerminalStates.has(call.state)) {
            return { success: false, error: "Call has ended" };
        }
        try {
            await this.speak(callId, prompt);
            call.state = "listening";
            this.persistCallRecord(call);
            await provider.startListening({
                callId,
                providerCallId: call.providerCallId,
            });
            const transcript = await this.waitForFinalTranscript(callId);
            // Best-effort: stop listening after final transcript.
            await provider.stopListening({
                callId,
                providerCallId: call.providerCallId,
            });
            return { success: true, transcript };
        }
        catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
        finally {
            this.clearTranscriptWaiter(callId);
        }
    }
    /**
     * End an active call.
     */
    async endCall(callId) {
        const call = this.activeCalls.get(callId);
        if (!call) {
            return { success: false, error: "Call not found" };
        }
        const provider = this.getProviderForPlatform(call.provider);
        if (!provider || !call.providerCallId) {
            return { success: false, error: "Call not connected" };
        }
        if (TerminalStates.has(call.state)) {
            return { success: true }; // Already ended
        }
        try {
            await provider.hangupCall({
                callId,
                providerCallId: call.providerCallId,
                reason: "hangup-bot",
            });
            call.state = "hangup-bot";
            call.endedAt = Date.now();
            call.endReason = "hangup-bot";
            this.persistCallRecord(call);
            this.clearMaxDurationTimer(callId);
            this.rejectTranscriptWaiter(callId, "Call ended: hangup-bot");
            this.activeCalls.delete(callId);
            if (call.providerCallId) {
                this.providerCallIdMap.delete(call.providerCallId);
            }
            return { success: true };
        }
        catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }
    /**
     * Check if an inbound call should be accepted based on policy.
     */
    shouldAcceptInbound(from) {
        const { inboundPolicy: policy, allowFrom } = this.config;
        switch (policy) {
            case "disabled":
                console.log("[voice-call] Inbound call rejected: policy is disabled");
                return false;
            case "open":
                console.log("[voice-call] Inbound call accepted: policy is open");
                return true;
            case "allowlist":
            case "pairing": {
                const normalized = from?.replace(/\D/g, "") || "";
                const allowed = (allowFrom || []).some((num) => {
                    const normalizedAllow = num.replace(/\D/g, "");
                    return (normalized.endsWith(normalizedAllow) ||
                        normalizedAllow.endsWith(normalized));
                });
                const status = allowed ? "accepted" : "rejected";
                console.log(`[voice-call] Inbound call ${status}: ${from} ${allowed ? "is in" : "not in"} allowlist`);
                return allowed;
            }
            default:
                return false;
        }
    }
    /**
     * Create a call record for an inbound call.
     */
    createInboundCall(providerCallId, from, to) {
        const callId = crypto.randomUUID();
        const callRecord = {
            callId,
            providerCallId,
            provider: this.provider?.name || "twilio",
            direction: "inbound",
            state: "ringing",
            from,
            to,
            startedAt: Date.now(),
            transcript: [],
            processedEventIds: [],
            metadata: {
                initialMessage: this.config.inboundGreeting || "Hello! How can I help you today?",
            },
        };
        this.activeCalls.set(callId, callRecord);
        this.providerCallIdMap.set(providerCallId, callId); // Map providerCallId to internal callId
        this.persistCallRecord(callRecord);
        console.log(`[voice-call] Created inbound call record: ${callId} from ${from}`);
        return callRecord;
    }
    /**
     * Look up a call by either internal callId or providerCallId.
     */
    findCall(callIdOrProviderCallId) {
        // Try direct lookup by internal callId
        const directCall = this.activeCalls.get(callIdOrProviderCallId);
        if (directCall)
            return directCall;
        // Try lookup by providerCallId
        return this.getCallByProviderCallId(callIdOrProviderCallId);
    }
    /**
     * Process a webhook event.
     */
    processEvent(event) {
        // Idempotency check
        if (this.processedEventIds.has(event.id)) {
            return;
        }
        this.processedEventIds.add(event.id);
        let call = this.findCall(event.callId);
        // Handle inbound calls - create record if it doesn't exist
        if (!call && event.direction === "inbound" && event.providerCallId) {
            // Check if we should accept this inbound call
            if (!this.shouldAcceptInbound(event.from)) {
                // TODO: Could hang up the call here
                return;
            }
            // Create a new call record for this inbound call
            call = this.createInboundCall(event.providerCallId, event.from || "unknown", event.to || this.config.fromNumber || "unknown");
            // Update the event's callId to use our internal ID
            event.callId = call.callId;
        }
        if (!call) {
            // Still no call record - ignore event
            return;
        }
        // Update provider call ID if we got it
        if (event.providerCallId && event.providerCallId !== call.providerCallId) {
            const previousProviderCallId = call.providerCallId;
            call.providerCallId = event.providerCallId;
            this.providerCallIdMap.set(event.providerCallId, call.callId);
            if (previousProviderCallId) {
                const mapped = this.providerCallIdMap.get(previousProviderCallId);
                if (mapped === call.callId) {
                    this.providerCallIdMap.delete(previousProviderCallId);
                }
            }
        }
        // Track processed event
        call.processedEventIds.push(event.id);
        // Process event based on type
        switch (event.type) {
            case "call.initiated":
                this.transitionState(call, "initiated");
                break;
            case "call.ringing":
                this.transitionState(call, "ringing");
                break;
            case "call.answered":
                call.answeredAt = event.timestamp;
                this.transitionState(call, "answered");
                // Start max duration timer when call is answered
                this.startMaxDurationTimer(call.callId);
                // Best-effort: speak initial message (for inbound greetings and outbound
                // conversation mode) once the call is answered.
                this.maybeSpeakInitialMessageOnAnswered(call);
                break;
            case "call.active":
                this.transitionState(call, "active");
                break;
            case "call.speaking":
                this.transitionState(call, "speaking");
                break;
            case "call.speech":
                if (event.isFinal) {
                    this.addTranscriptEntry(call, "user", event.transcript);
                    this.resolveTranscriptWaiter(call.callId, event.transcript);
                }
                this.transitionState(call, "listening");
                break;
            case "call.ended":
                call.endedAt = event.timestamp;
                call.endReason = event.reason;
                this.transitionState(call, event.reason);
                this.clearMaxDurationTimer(call.callId);
                this.rejectTranscriptWaiter(call.callId, `Call ended: ${event.reason}`);
                this.activeCalls.delete(call.callId);
                if (call.providerCallId) {
                    this.providerCallIdMap.delete(call.providerCallId);
                }
                break;
            case "call.error":
                if (!event.retryable) {
                    call.endedAt = event.timestamp;
                    call.endReason = "error";
                    this.transitionState(call, "error");
                    this.clearMaxDurationTimer(call.callId);
                    this.rejectTranscriptWaiter(call.callId, `Call error: ${event.error}`);
                    this.activeCalls.delete(call.callId);
                    if (call.providerCallId) {
                        this.providerCallIdMap.delete(call.providerCallId);
                    }
                }
                break;
        }
        this.persistCallRecord(call);
    }
    maybeSpeakInitialMessageOnAnswered(call) {
        const initialMessage = typeof call.metadata?.initialMessage === "string"
            ? call.metadata.initialMessage.trim()
            : "";
        if (!initialMessage)
            return;
        if (!this.provider || !call.providerCallId)
            return;
        // Twilio has provider-specific state for speaking (<Say> fallback) and can
        // fail for inbound calls; keep existing Twilio behavior unchanged.
        if (this.provider.name === "twilio")
            return;
        void this.speakInitialMessage(call.providerCallId);
    }
    /**
     * Get an active call by ID.
     */
    getCall(callId) {
        return this.activeCalls.get(callId);
    }
    /**
     * Get an active call by provider call ID (e.g., Twilio CallSid).
     */
    getCallByProviderCallId(providerCallId) {
        // Fast path: use the providerCallIdMap for O(1) lookup
        const callId = this.providerCallIdMap.get(providerCallId);
        if (callId) {
            return this.activeCalls.get(callId);
        }
        // Fallback: linear search for cases where map wasn't populated
        // (e.g., providerCallId set directly on call record)
        for (const call of this.activeCalls.values()) {
            if (call.providerCallId === providerCallId) {
                return call;
            }
        }
        return undefined;
    }
    /**
     * Get all active calls.
     */
    getActiveCalls() {
        return Array.from(this.activeCalls.values());
    }
    /**
     * Get call history (from persisted logs).
     */
    async getCallHistory(limit = 50) {
        const logPath = path.join(this.storePath, "calls.jsonl");
        try {
            await fsp.access(logPath);
        }
        catch {
            return [];
        }
        const content = await fsp.readFile(logPath, "utf-8");
        const lines = content.trim().split("\n").filter(Boolean);
        const calls = [];
        // Parse last N lines
        for (const line of lines.slice(-limit)) {
            try {
                const parsed = CallRecordSchema.parse(JSON.parse(line));
                calls.push(parsed);
            }
            catch {
                // Skip invalid lines
            }
        }
        return calls;
    }
    // States that can cycle during multi-turn conversations
    static ConversationStates = new Set([
        "speaking",
        "listening",
    ]);
    // Non-terminal state order for monotonic transitions
    static StateOrder = [
        "initiated",
        "ringing",
        "answered",
        "active",
        "speaking",
        "listening",
    ];
    /**
     * Transition call state with monotonic enforcement.
     */
    transitionState(call, newState) {
        // No-op for same state or already terminal
        if (call.state === newState || TerminalStates.has(call.state))
            return;
        // Terminal states can always be reached from non-terminal
        if (TerminalStates.has(newState)) {
            call.state = newState;
            return;
        }
        // Allow cycling between speaking and listening (multi-turn conversations)
        if (CallManager.ConversationStates.has(call.state) &&
            CallManager.ConversationStates.has(newState)) {
            call.state = newState;
            return;
        }
        // Only allow forward transitions in state order
        const currentIndex = CallManager.StateOrder.indexOf(call.state);
        const newIndex = CallManager.StateOrder.indexOf(newState);
        if (newIndex > currentIndex) {
            call.state = newState;
        }
    }
    /**
     * Add an entry to the call transcript.
     */
    addTranscriptEntry(call, speaker, text) {
        const entry = {
            timestamp: Date.now(),
            speaker,
            text,
            isFinal: true,
        };
        call.transcript.push(entry);
    }
    /**
     * Persist a call record to disk (fire-and-forget async).
     */
    persistCallRecord(call) {
        const logPath = path.join(this.storePath, "calls.jsonl");
        const line = `${JSON.stringify(call)}\n`;
        // Fire-and-forget async write to avoid blocking event loop
        fsp.appendFile(logPath, line).catch((err) => {
            console.error("[voice-call] Failed to persist call record:", err);
        });
    }
    /**
     * Load active calls from persistence (for crash recovery).
     * Uses streaming to handle large log files efficiently.
     */
    loadActiveCalls() {
        const logPath = path.join(this.storePath, "calls.jsonl");
        if (!fs.existsSync(logPath))
            return;
        // Read file synchronously and parse lines
        const content = fs.readFileSync(logPath, "utf-8");
        const lines = content.split("\n");
        // Build map of latest state per call
        const callMap = new Map();
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                const call = CallRecordSchema.parse(JSON.parse(line));
                callMap.set(call.callId, call);
            }
            catch {
                // Skip invalid lines
            }
        }
        // Only keep non-terminal calls
        for (const [callId, call] of callMap) {
            if (!TerminalStates.has(call.state)) {
                this.activeCalls.set(callId, call);
                // Populate providerCallId mapping for lookups
                if (call.providerCallId) {
                    this.providerCallIdMap.set(call.providerCallId, callId);
                }
                // Populate processed event IDs
                for (const eventId of call.processedEventIds) {
                    this.processedEventIds.add(eventId);
                }
            }
        }
    }
    /**
     * Generate TwiML for notify mode (speak message and hang up).
     */
    generateNotifyTwiml(message, voice) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${escapeXml(message)}</Say>
  <Hangup/>
</Response>`;
    }
}
