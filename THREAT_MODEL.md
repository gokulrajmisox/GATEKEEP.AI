# GATEKEEP.AI threat model

## Scope and security objective

GATEKEEP.AI is a Chromium Manifest V3 extension that scans text at the browser interaction boundary before it is submitted to supported AI sites. Its primary objective is to reduce **accidental** disclosure of common personal data and secrets. It is a safety control, not a complete data-loss-prevention system and not a guarantee that sensitive data cannot leave the browser.

## Assets

| Asset | Security property | Example |
|---|---|---|
| User-entered prompt text | Confidentiality | A prompt containing a token or customer email |
| Detection configuration | Integrity | Whether a rule blocks or only warns |
| Local model and runtime | Integrity | NER model used for optional local classification |
| User decision | Authenticity | The user choosing to proceed or cancel |

## Trust boundaries and data flow

```text
User input
   │ DOM event
   ▼
Content script ── local regex scan ──► warning/block UI in Shadow DOM
   │
   │ only when local AI engine is enabled/reachable
   ▼
Extension service worker ── message ──► offscreen document ──► local ONNX/NER model
   │
   └── settings stored with chrome.storage.local

Supported AI site ── final submission remains controlled by the site and browser
```

The content script runs in the page context boundary but does not send prompt text to a project backend. AI classification is routed to the extension's offscreen document. Model downloads are a separate supply-chain and availability concern and must be disclosed to users.

## Threats and mitigations

| Threat | Likelihood | Impact | Current mitigation | Residual risk |
|---|---:|---:|---|---|
| Accidental email/token submission | High | High | Local pattern scan, configurable warn/block decision | Pattern rules are heuristic and incomplete |
| Malicious or compromised AI site reading extension UI | Medium | Medium | Shadow DOM isolation, no privileged page injection | Host page can still observe its own DOM and user actions |
| Extension sends prompt text to an attacker-controlled backend | Low | Critical | No application backend; no analytics or remote scan endpoint | Third-party model assets and dependencies require review |
| Compromised dependency or model asset | Medium | Critical | `npm ci`, lockfile, CI audit, pinned Transformers version | Audit does not prove model integrity; review hashes/licensing before production packaging |
| Configuration tampering | Medium | High | Chrome extension storage and extension-only settings UI | A malicious local profile or higher-privileged extension can alter settings |
| DOM mutation breaks interception | High | Medium | Multiple input strategies and test coverage | Site-specific adapters and browser UI changes can bypass coverage |
| Sensitive text appears in logs | Medium | High | Findings use `REDACTED` in the scanner result | Debug logging must be reviewed before production distribution |
| User bypasses a warning | High | Medium | Explicit blocking policy and explainable finding types | No technical control can prevent intentional override if policy permits it |

## Security invariants

1. Prompt text must not be persisted by the extension except in browser-managed transient message memory.
2. Findings shown to the UI must use redacted values, never the matched secret.
3. No network request is required for local regex detection.
4. Extension pages must not use inline script or dynamic code execution.
5. WASM assets must not be web-accessible to arbitrary pages.
6. A failing optional AI engine must fail closed only according to the configured local rule policy; it must not silently claim that text is safe.

## Verification plan

- Run `npm test` for deterministic pattern regression tests.
- Run `npm run benchmark` against the checked-in synthetic corpus and review precision, recall, F1, and p95 local-scan latency.
- Run `npm run build` and validate `dist/manifest.json`.
- Run `npm audit --audit-level=high` before release; critical findings are CI-blocking.
- Manually inspect Chrome DevTools Network while scanning synthetic data to distinguish model asset download from prompt scanning.
- Review every new host match, permission, dependency, and model asset in code review.

## Out of scope

This model does not cover endpoint malware, browser compromise, malicious browser extensions with broader privileges, server-side retention by AI providers, OCR of images, data entered outside supported sites, or intentional user disclosure. Organizations needing those controls should pair GATEKEEP.AI with provider policy, endpoint DLP, identity controls, and network governance.
