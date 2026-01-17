import { verifyTwilioWebhook } from "../../webhook-security.js";
export function verifyTwilioProviderWebhook(params) {
    const result = verifyTwilioWebhook(params.ctx, params.authToken, {
        publicUrl: params.currentPublicUrl || undefined,
        allowNgrokFreeTier: params.options.allowNgrokFreeTier ?? true,
        skipVerification: params.options.skipVerification,
    });
    if (!result.ok) {
        console.warn(`[twilio] Webhook verification failed: ${result.reason}`);
        if (result.verificationUrl) {
            console.warn(`[twilio] Verification URL: ${result.verificationUrl}`);
        }
    }
    return {
        ok: result.ok,
        reason: result.reason,
    };
}
