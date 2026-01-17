import { logVerbose } from "../../globals.js";
import type { RuntimeEnv } from "../../runtime.js";
import { handleSlackVoiceMessage, shouldHandleSlackVoiceMessage } from "../voice/integration.js";
import { sendMessageSlack } from "../send.js";
import type { ResolvedSlackAccount } from "../accounts.js";
import type { SlackMessageEvent } from "../types.js";
import type { SlackMonitorContext } from "./context.js";
import { dispatchPreparedSlackMessage } from "./message-handler/dispatch.js";
import { prepareSlackMessage } from "./message-handler/prepare.js";

export type SlackMessageHandler = (
  message: SlackMessageEvent,
  opts: { source: "message" | "app_mention"; wasMentioned?: boolean },
) => Promise<void>;

export function createSlackMessageHandler(params: {
  ctx: SlackMonitorContext;
  account: ResolvedSlackAccount;
  runtime?: RuntimeEnv;
}): SlackMessageHandler {
  const { ctx, account, runtime } = params;

  return async (message, opts) => {
    if (opts.source === "message" && message.type !== "message") return;
    if (
      opts.source === "message" &&
      message.subtype &&
      message.subtype !== "file_share" &&
      message.subtype !== "bot_message"
    ) {
      return;
    }
    if (ctx.markMessageSeen(message.channel, message.ts)) return;

    // Handle voice messages first (if present)
    if (shouldHandleSlackVoiceMessage(message)) {
      try {
        const voiceHandled = await handleSlackVoiceMessage({
          message: message as any,
          client: ctx.app.client,
          token: ctx.botToken,
          providersConfig: ctx.cfg.voice as any,
          channelId: message.channel,
          userId: message.user,
          runtime,
          threadTs: message.thread_ts,
          replyFn: async (transcribedText: string) => {
            // For now, return a simple acknowledgment
            // In production, this would wire into the full agent pipeline
            return `I heard you say: "${transcribedText}". Voice message support is active!`;
          },
          sendFn: async ({ text, threadTs }) => {
            // Send text response back to Slack
            if (text) {
              await sendMessageSlack(
                message.channel,
                text,
                {
                  token: ctx.botToken,
                  client: ctx.app.client,
                  accountId: account.accountId,
                  threadTs,
                },
              );
            }
          },
        });

        if (voiceHandled) {
          // Voice message was successfully handled, skip regular text processing
          logVerbose(`slack: voice message handled for channel ${message.channel}`);
          return;
        }
      } catch (err) {
        logVerbose(
          `slack: voice message handling failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        // Fall through to text processing on error
      }
    }

    const prepared = await prepareSlackMessage({ ctx, account, message, opts });
    if (!prepared) return;
    await dispatchPreparedSlackMessage(prepared);
  };
}
