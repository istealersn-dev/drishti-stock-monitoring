# Drishti — Upstox TOTP Auth Automation Spec

## Context

Drishti needs a daily-refreshed Upstox `access_token` with zero human interaction, replacing the manual OAuth browser flow. TOTP (Time-based One-Time Password) is already enabled on the Upstox account and its raw secret has been captured. This spec covers building the automation that turns that secret into a usable access token on a schedule.

**Runs on**: Mac Mini (M4 Pro), macOS. No VPS yet.

## Non-goals (explicitly out of scope for this spec)

- **This does not solve order placement.** SEBI's static-IP mandate means Upstox will likely reject order-placement calls (place/modify/cancel) from a dynamic home IP even with a valid access token. This spec only covers getting a valid token; live trading via GTT is blocked until static IP is addressed separately.
- Not building the broker-agnostic abstraction layer — this is Upstox-specific.
- Not covering Slack approval workflow — assume that's a separate, already-scoped component.

## Architecture

Three components, in order of execution:

```
[macOS Keychain] --read--> [Token Refresh Service] --write--> [.env.local]
                                    |
                          (scheduled by launchd, daily
                           before market pre-open, e.g. 08:15 IST)
```

## Component 1 — Keychain Credential Store

**Purpose**: store long-lived, never-rotating secrets. Never touches `.env` files.

**Secrets to store** (one Keychain item per key, service name prefix `drishti-upstox-`):

| Key | Keychain item name | Notes |
|---|---|---|
| Upstox registered mobile number | `drishti-upstox-username` | used as OAuth login identifier |
| Upstox account password | `drishti-upstox-password` | |
| Upstox trading PIN | `drishti-upstox-pin` | numeric PIN used at 2FA step |
| TOTP secret (base32) | `drishti-upstox-totp-secret` | captured during TOTP re-enrollment |
| Upstox app `client_id` | `drishti-upstox-client-id` | from developer.upstox.com app |
| Upstox app `client_secret` | `drishti-upstox-client-secret` | from developer.upstox.com app |
| Upstox app `redirect_uri` | `drishti-upstox-redirect-uri` | must match app registration exactly |

**Implementation**: Node/TypeScript, using a Keychain-wrapping package (e.g. `@napi-rs/keyring` — actively maintained; avoid `keytar`, which is deprecated/unmaintained). Wraps macOS Keychain natively, no raw shell-outs to the `security` CLI needed.

**Required interface**:
```
getCredential(key: string): Promise<string>        // throws if missing, never returns null silently
setCredential(key: string, value: string): Promise<void>   // idempotent, overwrites existing
listConfiguredKeys(): Promise<string[]>    // for a one-time setup verification script
```

**One-time setup script** (`setup-keychain.ts`): interactively prompts for each of the 7 values above and stores them. Run once by hand, never again. Should mask input for password/pin/secret (no terminal echo).

## Component 2 — Token Refresh Service

**Purpose**: perform the TOTP-based login flow and produce a fresh `access_token`.

**Language decision**: TypeScript, consistent with the rest of Drishti. Built on **Playwright** rather than raw HTTP replication of Upstox's internal login endpoints.

**Why Playwright over reverse-engineered HTTP calls**: the only prior art for full TOTP automation (`upstox-totp`, Python-only) works by hitting undocumented internal endpoints directly, mimicking browser fingerprints to avoid bot detection. That's fragile — it depends on exactly replicating an internal API contract Upstox never published and can change without notice. Playwright instead drives the *actual rendered login page* the way a human would: fill a field, click a button, wait for the next screen. This is more resilient to backend changes as long as the visible form's shape doesn't change, and it means we're never guessing at undocumented request/response payloads.

**Dependencies**:
- `playwright` (npm) — headless Chromium automation
- `otpauth` (npm) — TOTP code generation from the base32 secret (Node equivalent of Python's `pyotp`)

**Flow**:
1. Read all 7 credentials from Keychain (Component 1).
2. Launch headless Chromium via Playwright.
3. Navigate to the **officially documented** login dialog URL: `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=<client_id>&redirect_uri=<redirect_uri>`.
4. Fill username → submit. Fill password → submit.
5. When the 2FA screen appears, compute the current TOTP code locally via `otpauth` from the stored secret, fill it in, submit.
6. Fill PIN when prompted, submit.
7. Wait for Playwright to detect navigation to `redirect_uri` — capture the `code` query parameter from that URL. This is the single-use authorization code.
8. Close the browser context (don't leave Chromium processes running).
9. Exchange the `code` for an `access_token` via the **officially documented** server-to-server endpoint: `POST https://api.upstox.com/v2/login/authorization/token` with `code`, `client_id`, `client_secret`, `redirect_uri`, `grant_type=authorization_code`. This step is a plain HTTP call, no browser needed — it's stable, documented API surface.
10. On success: extract `access_token` from response, pass to Component 3.
11. On failure at any step: **do not fail silently.** See Error Handling below.

**Required interface**:
```
refreshToken(): Promise<RefreshResult>

RefreshResult:
  success: boolean
  accessToken: string | null
  errorMessage: string | null
  failedStep: string | null   // which numbered step above failed, for faster debugging
  timestamp: Date
```

**Error handling — this matters more than the happy path**:
- If login fails at any step (selector not found because the page changed, wrong credentials, TOTP drift, account locked, redirect never happens, etc.), the script must **not** leave a stale/expired token silently in `.env.local`.
- On failure: capture a screenshot of the page state at the point of failure (Playwright makes this trivial) and save it locally — invaluable for diagnosing "the page changed" vs. "credentials are wrong" without re-running blind.
- On failure: send a Slack notification (reuse whatever Slack webhook Drishti's approval workflow already has configured) with the error message and which step failed, then exit non-zero.
- On success: also worth a low-key Slack confirmation (e.g. a ✅ in a #drishti-ops channel) so failures are noticeable by absence — silence on a normal morning is a red flag if you're used to seeing the ✅.
- Log every attempt (success or failure) with timestamp to a local log file, separate from the credential-handling code path, so logs never accidentally contain secrets.
- Always close the Playwright browser context in a `finally` block — a crashed run should never leave an orphaned headless Chromium process running on the Mac Mini.

**Explicit non-requirement**: no retry loop with the same TOTP code — TOTP codes are single-window (30s); if a code is rejected, generate a fresh one on retry, don't resubmit the same code.

**Selector fragility — flag, don't hide**: since this automates a real web page, the CSS/DOM selectors used to find the username/password/OTP/PIN fields are the single most likely thing to break silently over time if Upstox redesigns their login page. Keep these selectors in one clearly-named constants file, not scattered inline, so updating them later is a one-file change, not a hunt.

## Component 3 — `.env.local` Writer

**Purpose**: land the fresh token where Drishti reads it, without corrupting anything else in the file.

**Requirements**:
- **Overwrite, never append.** If `UPSTOX_ACCESS_TOKEN=` already exists as a line in `.env.local`, replace that line in place. If it doesn't exist, append it. Every other line in the file must be untouched.
- **Atomic write**: write to a temp file, then rename over `.env.local` — never write partial content directly to the real file (avoids a half-written file if the process is killed mid-write).
- Also write `UPSTOX_TOKEN_REFRESHED_AT=<ISO timestamp>` as a second line, so Drishti (or you, debugging) can tell at a glance how stale the token is.
- Confirm `.env.local` is in `.gitignore` for this repo before the first real run — check, don't assume.

**Required interface**:
```
writeToken(envPath: string, accessToken: string, refreshedAt: Date): Promise<void>
```

## Scheduling — launchd

Use `launchd`, not cron — more native to macOS, handles the Mac being asleep/waking better.

**Requirements**:
- Run once daily at a fixed time before Indian market pre-open (09:00 IST) — build in margin, e.g. 08:15 IST, in case of retries.
- `StartCalendarInterval` in the plist, not `StartInterval` — you want a fixed clock time, not "every N seconds since load."
- If the Mac was asleep at the scheduled time, launchd runs it on wake if `RunAtLoad` combined with a missed-schedule check is configured — verify this behavior specifically during testing, since a missed morning refresh is exactly the failure mode that matters.
- Plist should redirect stdout/stderr to the same log file Component 2 writes to, for a single source of truth when debugging.

## Testing checklist (for Claude Code to verify before calling this done)

1. Keychain round-trip: store a value, read it back in a fresh process, confirm match.
2. Full token refresh with valid credentials — confirm `.env.local` gets a correctly formatted, valid token.
3. Deliberately wrong PIN — confirm failure path triggers Slack alert and does *not* touch `.env.local`.
4. Run twice in a row — confirm second run cleanly overwrites the first token line, doesn't duplicate it.
5. Kill the process mid-write (simulate crash) — confirm `.env.local` is either fully old or fully new, never partially corrupted.
6. Manually trigger the launchd job outside its schedule — confirm it behaves identically to the scheduled run.
7. Let it run for 3 real consecutive mornings unattended before trusting it.
8. Confirm no orphaned Chromium processes remain after both successful and failed runs — check with `ps aux | grep chromium` after each test run.
9. Deliberately point one selector at a wrong element (simulate a page change) — confirm the failure screenshot capture works and the Slack alert clearly identifies which step failed.

## Open questions Claude Code should confirm with the user before/during build

- Exact `.env.local` path relative to Drishti's project root.
- Slack webhook URL / channel to reuse for alerts (or whether this needs its own).
- Whether TOTP secret rotation (if ever needed again) should have its own re-run of `setup_keychain.py`, or a dedicated update path.