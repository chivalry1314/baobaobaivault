# Share Auth Email Verification Deployment Guide

This guide covers how to deploy real email-verification-based registration for `sharefrontend` / `backend`.

## Goal

When enabled:

- new users must complete email code verification before account creation
- `/api/share/auth/continue` no longer auto-creates users
- unverified users cannot create a valid share session

When disabled:

- registration keeps the current simplified direct-create behavior

## Related config files

- local template: `backend/config/config.example.yaml`
- public deployment template: `deploy/backend/config.public.example.yaml`

There is no separate Aliyun-specific config template anymore.
Use the main template above and fill the `email.*` fields for Aliyun Direct Mail if needed.

## Required config

Core switch:

- `share_auth.email_verification_enabled`

SMTP config:

- `email.enabled`
- `email.from_name`
- `email.from_address`
- `email.smtp_host`
- `email.smtp_port`
- `email.smtp_username`
- `email.smtp_password`

Share auth tuning:

- `share_auth.verification_code_ttl_seconds`
- `share_auth.resend_interval_seconds`
- `share_auth.max_verify_attempts`

## Recommended production config example

```yaml
server:
  mode: release
  admin_email: "admin@your-domain.com"

email:
  enabled: true
  from_name: "CardShare"
  from_address: "noreply@your-domain.com"
  smtp_host: "smtp.exmail.qq.com"
  smtp_port: 587
  smtp_username: "noreply@your-domain.com"
  smtp_password: "your-smtp-app-password"

share_auth:
  email_verification_enabled: true
  verification_code_ttl_seconds: 600
  resend_interval_seconds: 60
  max_verify_attempts: 5
```

## SMTP notes

- `587` usually means `STARTTLS`
- `465` usually means implicit `SSL`
- many providers require an app password or SMTP authorization code, not the mailbox login password
- `email.from_address` should normally match the verified sender address configured at the provider
- `email.smtp_username` is usually the full sender mailbox

## Aliyun Direct Mail SMTP example

If your users are mainly in mainland China, Aliyun Direct Mail is usually a strong low-cost option for this project because it works with the SMTP flow already built into the backend.

Official Aliyun SMTP endpoint notes:

- China region SMTP host: `smtpdm.aliyun.com`
- Aliyun documents ports `25`, `80`, and `465`
- `465` uses SSL
- `80` can be used without implicit SSL and Aliyun also documents explicit `STARTTLS` on `25` or `80`

Recommended config for this project:

```yaml
server:
  admin_email: "admin@your-domain.com"

email:
  enabled: true
  from_name: "CardShare"
  from_address: "noreply@your-domain.com"
  smtp_host: "smtpdm.aliyun.com"
  smtp_port: 465
  smtp_username: "noreply@your-domain.com"
  smtp_password: "your-aliyun-smtp-password"

share_auth:
  email_verification_enabled: true
```

Aliyun setup checklist:

1. Enable Direct Mail in Aliyun.
2. Add and verify your sender domain.
3. Create a sender address such as `noreply@your-domain.com`.
4. Set the SMTP password for that sender address in the Aliyun console.
5. Add the DNS records required by Aliyun, typically including SPF and DKIM.
6. Fill the values into backend config and send a manager test email first.

Notes specific to Aliyun:

- `smtp_username` should be the full verified sender address
- `smtp_password` is the SMTP password configured in Aliyun, not your Aliyun account login password
- if port `465` is blocked in your environment, try Aliyun port `80`
- use the SMTP endpoint that matches the region you enabled in Aliyun

## Recommended rollout order

1. Prepare a dedicated sender mailbox such as `noreply@your-domain.com`.
2. Finish provider-side sender verification or domain verification.
3. Confirm SPF / DKIM / DMARC if your provider requires them.
4. Fill in SMTP config, but keep `share_auth.email_verification_enabled=false` first.
5. Deploy backend with `email.enabled=true`.
6. Use the creator-center System Settings page to send an SMTP test email to any inbox you want to verify. If you leave the target empty, the backend falls back to `server.admin_email`.
7. Test `/login` registration flow manually with a real mailbox.
8. Confirm resend cooldown, expired-code behavior, and invalid-code behavior.
9. Confirm mail does not land in spam for your main target providers.
10. Only then switch `share_auth.email_verification_enabled=true`.

## What to verify after enabling

- `POST /api/share/auth/register`
  - should return `verificationRequired=true`
- `POST /api/share/auth/register/verify`
  - should create account only after correct code
- `POST /api/share/auth/register/resend`
  - should respect resend cooldown
- `POST /api/share/auth/continue`
  - should no longer auto-create when verification is enabled
- `GET /api/share/auth/config`
  - should show `emailVerificationEnabled=true`
- `GET /api/share/auth/email-health`
  - should show current SMTP summary

## Admin tools added

Public read endpoints:

- `GET /api/share/auth/config`
- `GET /api/share/auth/email-health`

Authenticated manager-only action:

- `POST /api/share/auth/email-health/test`
  - accepts a frontend-provided target email address
  - falls back to `server.admin_email` when the target is empty
  - protected by a 60-second per-user cooldown

## Safety behavior already built in

- verification emails support HTML + plain text
- resend is rate-limited by `share_auth.resend_interval_seconds`
- SMTP test action is rate-limited per manager user
- expired verification rows are cleaned during runtime
- old consumed verification rows are cleaned during runtime and startup migration
- legacy share users are backfilled as verified during migration so existing accounts are not locked out

## Common failure cases

`invalid email`

- check whether the SMTP test target email entered in the frontend is valid
- if you leave the target empty, configure `server.admin_email` as a safe fallback

`email service is disabled`

- set `email.enabled=true`

`share_auth.email_verification_enabled requires email.enabled = true`

- enable SMTP first, then enable share email verification

`email verification requires email.smtp_host, email.smtp_port, and email.from_address`

- fill required SMTP fields before turning on email verification

`smtp server does not support AUTH`

- check SMTP host/port combination
- verify whether your provider expects `465` or `587`

No mail received:

- check spam folder
- verify provider delivery logs
- verify sender/domain setup
- verify app password / SMTP authorization code

`smtp test requested too frequently`

- wait for the current 60-second cooldown to expire

## Deployment checklist

- backend config updated
- `server.admin_email` configured
- SMTP test email delivered successfully
- real registration email delivered successfully
- verify/register/resend flows confirmed
- share login still works for existing accounts
- frontend creator center shows expected email verification status
