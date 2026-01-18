export async function twilioApiRequest(params) {
    const response = await fetch(`${params.baseUrl}${params.endpoint}`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(`${params.accountSid}:${params.authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params.body),
    });
    if (!response.ok) {
        if (params.allowNotFound && response.status === 404) {
            return undefined;
        }
        const errorText = await response.text();
        throw new Error(`Twilio API error: ${response.status} ${errorText}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
}
