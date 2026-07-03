/**
 * Matches a leading Slack bot mention, e.g. "<@U123ABC>" at the start of a message.
 * Shared between main.ts's plain-message listener (skips mentions entirely — those
 * are owned by the app_mention handler) and slackCommands.router.ts (strips the
 * prefix before parsing the mention's text), so the two can't drift apart.
 */
export const MENTION_PREFIX_REGEX = /^<@[A-Z0-9]+>/i;
