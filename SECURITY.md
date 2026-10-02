# Security Policy

## Supported versions

GATEKEEP.AI is an actively developed prototype. Security fixes are applied to the `main` branch first. There are currently no published release branches with separate support windows.

## Reporting a vulnerability

Please report suspected vulnerabilities privately through [GitHub Security Advisories](https://github.com/gokulrajmisox/GATEKEEP.AI/security/advisories/new) rather than opening a public issue.

When possible, include:

- A concise description of the issue and its potential impact.
- The affected file, component, browser, and extension version or commit.
- Reproduction steps using synthetic values only.
- Any proof-of-concept that does not contain real credentials, personal data, or customer information.
- Suggested mitigation, if known.

If GitHub Security Advisories is unavailable, open a minimal issue asking the maintainers to enable a private security contact. Do not include exploit details in that public issue.

## Response expectations

The maintainers will acknowledge a report when they can, investigate reproducible findings, and coordinate disclosure timing with the reporter. Please allow reasonable time for assessment and a fix before public disclosure.

## Scope and privacy

GATEKEEP.AI is a browser extension prototype, not a hosted backend. Reports may cover detector bypasses, unsafe permissions, cross-site data exposure, content-script isolation, dependency vulnerabilities, or release-process weaknesses.

Never send real secrets, private keys, personal information, customer data, or production prompts in an issue, pull request, screenshot, log, or proof-of-concept. Use the synthetic examples from the README or clearly fake replacements.

## Important limitation

The detector is a preventive privacy aid, not a guarantee that sensitive information can never leave a device. A detector bypass should still be reported, but users should not rely on the extension as their only security or data-loss-prevention control.
