/**
 * Twilio Call Provider Plugin - Configuration
 *
 * Defines configuration schema, event mappings, and validation for Twilio integration.
 */
import { z } from "zod";
// ============================================================================
// Twilio Configuration Schema
// ============================================================================
/**
 * Configuration for Twilio call provider plugin
 */
export const TwilioPluginConfigSchema = z.object({
    /** Twilio Account SID (required) */
    accountSid: z.string().min(1, "Account SID is required"),
    /** Twilio Auth Token (required) */
    authToken: z.string().min(1, "Auth Token is required"),
    /** Phone number to use for outbound calls (E.164 format) */
    phoneNumber: z.string().optional(),
    /** TwiML to execute for incoming calls */
    twiml: z.string().optional(),
    /** Allow ngrok free tier (less secure) */
    allowNgrokFreeTier: z.boolean().default(true),
    /** Public URL for webhook verification */
    publicUrl: z.string().url().optional(),
    /** Path for media stream WebSocket */
    streamPath: z.string().default("/voice/stream"),
    /** Skip webhook signature verification (dev only) */
    skipVerification: z.boolean().default(false),
});
// ============================================================================
// Event Mapping Configuration
// ============================================================================
/**
 * Maps Twilio webhook event fields to normalized call states
 */
export const TWILIO_STATUS_MAP = {
    initiated: "initiated",
    ringing: "ringing",
    "in-progress": "answered",
    completed: "completed",
    busy: "busy",
    "no-answer": "no-answer",
    failed: "failed",
    canceled: "hangup-bot",
};
/**
 * Maps Twilio directions to call directions
 */
export const TWILIO_DIRECTION_MAP = {
    inbound: "inbound",
    "outbound-api": "outbound",
    "outbound-dial": "outbound",
};
/**
 * Supported Twilio TwiML elements for voice interactions
 */
export const TWIML_ELEMENTS = {
    SAY: "Say", // Text-to-speech
    GATHER: "Gather", // Speech recognition (STT)
    RECORD: "Record", // Record audio
    PLAY: "Play", // Play audio file
    DIAL: "Dial", // Transfer/dial another number
    CONNECT: "Connect", // Connect to media stream
    PAUSE: "Pause", // Pause for specified time
};
// ============================================================================
// Validation Functions
// ============================================================================
/**
 * Validate Twilio configuration
 */
export function validateTwilioConfig(config) {
    return TwilioPluginConfigSchema.parse(config);
}
/**
 * Validate E.164 phone number format
 */
export function validatePhoneNumber(phone) {
    return /^\+[1-9]\d{1,14}$/.test(phone);
}
/**
 * Validate TwiML XML syntax (basic check)
 */
export function validateTwiml(twiml) {
    return (twiml.startsWith("<?xml") || twiml.startsWith("<Response")) && twiml.includes("</Response>");
}
// ============================================================================
// Event Type Helpers
// ============================================================================
/**
 * Check if a Twilio event represents a call state change
 */
export function isCallStateEvent(params) {
    const callStatus = params.get("CallStatus");
    return callStatus !== null && callStatus in TWILIO_STATUS_MAP;
}
/**
 * Check if a Twilio event represents speech input
 */
export function isSpeechEvent(params) {
    return params.has("SpeechResult");
}
/**
 * Check if a Twilio event represents DTMF input
 */
export function isDtmfEvent(params) {
    return params.has("Digits");
}
/**
 * Extract Twilio call metadata from webhook params
 */
export function extractCallMetadata(params) {
    const direction = params.get("Direction");
    return {
        callSid: params.get("CallSid") || "",
        direction: direction
            ? TWILIO_DIRECTION_MAP[direction]
            : undefined,
        from: params.get("From") || "",
        to: params.get("To") || "",
        state: params.get("CallStatus") || "",
    };
}
/**
 * Generate TwiML XML for playing text (Say)
 */
export function generateSayTwiml(text, options) {
    const voice = options?.voice || "Alice";
    const language = options?.language || "en-US";
    const escapedText = escapeXmlText(text);
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">${escapedText}</Say>
</Response>`;
}
/**
 * Generate TwiML XML for speech gathering (Gather)
 */
export function generateGatherTwiml(config) {
    const input = config.input || "speech";
    const language = config.language || "en-US";
    const speechTimeout = config.speechTimeout || "auto";
    const action = config.action || "";
    const method = config.method || "POST";
    const gatherAttrs = [
        `input="${input}"`,
        `language="${language}"`,
        `speechTimeout="${speechTimeout}"`,
        `action="${escapeXmlAttr(action)}"`,
        `method="${method}"`,
    ];
    if (config.finishOnKey) {
        gatherAttrs.push(`finishOnKey="${config.finishOnKey}"`);
    }
    if (config.numDigits) {
        gatherAttrs.push(`numDigits="${config.numDigits}"`);
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather ${gatherAttrs.join(" ")}>
    <Say>.</Say>
  </Gather>
</Response>`;
}
/**
 * Generate TwiML XML for media stream connection
 */
export function generateStreamConnectTwiml(streamUrl) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXmlAttr(streamUrl)}" />
  </Connect>
</Response>`;
}
/**
 * Escape XML text content (for element text)
 */
function escapeXmlText(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
/**
 * Escape XML attribute value
 */
function escapeXmlAttr(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
