# Security policy

This repository is a student project, but the code it describes handles credentials, sessions and
uploaded files, so security review is not optional.

## Reporting

Report a suspected vulnerability **privately**, to **Iqram** (backend) and **Hamzah** (Astro SSR
surface). Do not open a public issue, a public PR, or a commit that demonstrates the problem against a
shared environment. Expect an answer within 2 working days; the fix lands as a normal PR with tests.

If the report involves a real deployment, rotate the affected credential first, then report.

## Scope

In scope, once the application exists:

- authentication, session cookies, logout and session expiry
- ownership checks on every read and write (a foreign record must return `404`, never `403`)
- multipart uploads: type sniffing, size limits, storage keys, serving path
- SQL construction, error envelopes leaking internals, rate limiting, security headers and CSP
- the Next.js static output: any user data in `out/` is a release blocker

Out of scope: findings that require a compromised host, social engineering, or a browser vulnerability
with no code path in this repository.

## Rules the code must already follow

`.planning/07-security-architecture.md` is the authority. Short form in `RULES.md` section C, including
PBKDF2-SHA256 passwords, `sid` cookie flags, hashing session tokens at rest, content-sniffed MIME checks, and
never serving the upload directory directly.

## What to include in a report

Affected route or component, steps to reproduce, the response or log line you saw, and the impact in one
sentence. A proof of concept against a local, seeded database is ideal; never against shared data.
