---
title: "Bug Bounty Process"
description: "Methodology, scope, reporting, and platforms (HackerOne, Bugcrowd)."
sidebar:
  order: 15
  label: "Bug Bounty Process"
---
> Complete bug bounty methodology: finding programs, reading scopes, reporting vulnerabilities, and communicating with triage — with examples of real reports.

---


## Program Types and Platforms

### Main Platforms

| Platform | URL | Notes |
|------------|-----|-------|
| HackerOne | hackerone.com | Largest community; public directory |
| Bugcrowd | bugcrowd.com | Also private programs and VDPs |
| Intigriti | intigriti.com | Strong European presence |
| YesWeHack | yeswehack.com | Europe/global |
| Synack | synack.com | Private/exclusive; Red Team |
| Open Bug Bounty | openbugbounty.org | No monetary reward, XSS/CSRF |

### Program Types

```
Private BBP: invitation only
  → Invitations based on: track record, % valid reports, no violations
  → Start with public programs to build reputation

Public BBP: open to the entire community
  → More competition but larger scope to practice

VDP (Vulnerability Disclosure Program): no financial reward
  → Only provides responsible disclosure guidelines, no bounty

Parent/Child: holding with subsidiaries
  → A single bounty pool; report to the child or parent according to policy
```

### Searching for Programs

```bash
# HackerOne Directory
# https://hackerone.com/directory/programs
# Filter by: reward type, industry, scope, response time

# Bugcrowd Disclosure
# https://bugcrowd.com/programs
```

---

## Reading the Program — Key Elements

Before touching anything, read these policy sections:

```
□ Scope → domains/IPs/apps in scope
□ Out of Scope → what NOT to test (e.g.: *.cdn.company.com, third-party services)
□ Rules of Engagement → which attacks are permitted/prohibited
□ Eligibility Criteria → "first reporter only", account requirements, etc.
□ Reporting Format → expected report format
□ Rewards → severity table and amounts
□ Responsible Disclosure Policy → disclosure timeline (e.g.: 90 days)
□ Safe Harbor → legal protection for the hunter
□ Access → how to obtain test accounts
□ Vendor Response SLAs → expected response times
```

> **Golden rule:** whatever is not explicitly in scope = out of scope. When in doubt, ask before testing.

---

## Structure of a Good Report

```
Vulnerability Title  → vuln type + domain/endpoint/parameter + brief impact
CWE                  → number + name (e.g.: CWE-79: Cross-site Scripting)
CVSS 3.1 Score       → number + severity (e.g.: 7.5 High)
Description          → root cause of the vulnerability (technical but clear)
Proof of Concept     → REPRODUCIBLE steps to exploit (1, 2, 3...)
Impact               → what an attacker can achieve by exploiting the vuln
Remediation          → optional but appreciated; proposed fix
```

### Report Template

```markdown
## Title
[Vuln Type] in [Parameter/Endpoint] of [Domain] — [Impact summary]

## CWE
CWE-XXX: [Full name]

## CVSS 3.1 Score
X.X ([Critical/High/Medium/Low])
Vector: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H

## Description
[Technical description of the vulnerability: what, where, why it exists]

## Steps to Reproduce (POC)
1. Navigate to [URL]
2. Enter in the [X] field: [payload]
3. Observe that [expected behavior]
4. [Result that demonstrates the vulnerability]

## Impact
[Maximum impact: what the attacker can achieve, affected data, impacted users]

## Remediation
[Proposed fix: sanitization, validation, configuration]
```

---

## CVSS 3.1 — Severity Calculator

**Official calculator:** https://www.first.org/cvss/calculator/3.1

### Base Score Metrics

| Metric | Options | Quick Guide |
|---------|----------|-------------|
| **Attack Vector (AV)** | N/A/L/P | N=remote via internet; L=local access; P=physical |
| **Attack Complexity (AC)** | L/H | L=repeatable exploit without prep; H=special conditions |
| **Privileges Required (PR)** | N/L/H | N=no auth; L=normal user; H=admin |
| **User Interaction (UI)** | N/R | N=no victim; R=victim must click/visit |
| **Scope (S)** | U/C | U=impact on the same component; C=affects others |
| **Confidentiality (C)** | N/L/H | H=total access to confidential data |
| **Integrity (I)** | N/L/H | H=modify all critical data |
| **Availability (A)** | N/L/H | H=complete DoS possible |

### Examples of Common Scores

| Vuln | AV | AC | PR | UI | S | C | I | A | Score |
|------|----|----|----|----|---|---|---|---|-------|
| No-auth RCE (internet) | N | L | N | N | U | H | H | H | **9.8 Critical** |
| Auth-required SQLi | N | L | L | N | U | H | H | H | **8.8 High** |
| Stored XSS admin→admin | N | L | H | N | C | L | L | N | **5.5 Medium** |
| CSRF (registration) | N | L | N | R | U | L | L | N | **5.4 Medium** |
| IDOR (read data) | N | L | L | N | U | L | N | N | **4.3 Medium** |
| Minimal Info Disclosure | N | L | N | N | U | L | N | N | **5.3 Medium** |

---

## CWE — Most Common References in Web

| CWE | Name | Vulnerability |
|-----|--------|----------------|
| CWE-79 | Improper Neutralization of Input During Web Page Generation | XSS (stored, reflected, DOM) |
| CWE-89 | Improper Neutralization of Special Elements used in an SQL Command | SQL Injection |
| CWE-352 | Cross-Site Request Forgery (CSRF) | CSRF |
| CWE-502 | Deserialization of Untrusted Data | Java deserialization, pickle |
| CWE-918 | Server-Side Request Forgery (SSRF) | SSRF |
| CWE-94 | Improper Control of Generation of Code | SSTI, code injection |
| CWE-78 | Improper Neutralization of Special Elements used in an OS Command | Command injection |
| CWE-22 | Improper Limitation of a Pathname to a Restricted Directory | Path traversal / LFI |
| CWE-287 | Improper Authentication | Auth bypass, weak auth |
| CWE-284 | Improper Access Control | IDOR, BOLA, BFLA |
| CWE-200 | Exposure of Sensitive Information to an Unauthorized Actor | Info disclosure |
| CWE-862 | Missing Authorization | Missing auth checks |

---

## Report Examples — Structure Summary

### Stored XSS in Admin Panel (CVSS 5.5 Medium)

```
Title: Stored XSS in X Admin Panel — File Upload Filename
CWE: CWE-79
CVSS: 5.5 (Medium) — AV:N/AC:L/PR:H/UI:N/S:C/C:L/I:L/A:N

POC:
1. Log in as admin → Admin Info → Secure Data Transfer → Load of Data
2. Upload a file named: "><svg onload=alert(document.cookie)>.docx
3. Another admin visits the files page → JS executes in their browser
4. Admin cookie captured → session hijacking possible

Impact: Any admin can attack other admins → session hijacking,
        panel defacement, unauthorized actions performed as admin
```

### CSRF in Consumer Registration (CVSS 5.4 Medium)

```
Title: CSRF in Consumer Registration — Involuntary API Key Creation
CWE: CWE-352
CVSS: 5.4 (Medium) — AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N

POC:
1. Capture POST request to /consumer-registration with Burp (no anti-CSRF token)
2. Create malicious HTML with <form method="POST" action="/consumer-registration">
3. Send the link to the target while they have an active session
4. The victim visits the page → creates a fintech app on their behalf without knowing

Impact: Creation of applications and API keys without user consent
```

### RCE via Deserialization (CVSS 9.8 Critical)

```
Title: IBM WebSphere Java Object Deserialization RCE
CWE: CWE-502
CVSS: 9.8 (Critical) — AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H

POC:
1. Capture request to port 8880 → body contains "rO0" (base64 Java object)
2. Craft SOAP request with serialized payload for Apache Commons Collections
3. Send request → server executes the embedded command (ping to our host)
4. Verify with Wireshark → ICMP request received from the target

Impact: RCE as the WebSphere process user → full system access
```

---

## Communication with Triage

```
DO:
  ✓ Wait for the SLA before sending a follow-up
  ✓ Note the triage member's username → tag them in future messages
  ✓ Respond with technical details and keep calm
  ✓ If disagreeing on severity → explain the CVSS metrics step by step
  ✓ If the program breaches platform rules → escalate to "Mediation" on the platform

DON'T:
  ✗ Spam the triage team on consecutive days
  ✗ Contact via unofficial channels (Twitter, LinkedIn, personal email)
  ✗ Threaten disclosure before the agreed deadline
  ✗ Disclose publicly without authorization from the program
  ✗ Escalate before attempting to resolve the discrepancy directly
```

### Common Report Statuses

| Status | Meaning |
|--------|-------------|
| New | Received, pending review |
| Pending Program Review | Reviewed by triage, waiting for vendor |
| Triaged | Accepted as valid, in progress |
| Needs more info | Triage requests more details/reproduction steps |
| Informative | Not an exploitable bug, informational only |
| Not Applicable | Out of scope or not vulnerable |
| Duplicate | Already reported by another hunter |
| Resolved | Fix applied |

---

## Pitfalls / Gotchas

- **Scope is law:** testing out of scope can result in platform bans and legal consequences. Verify the exact domain, including subdomains.
- **"First reporter" ≠ your report was first:** if someone submitted the same bug before (even minutes before), it will likely be marked as a "Duplicate". Move quickly upon finding critical bugs.
- **CVSS ≠ bounty amount:** the program defines its own table. A 9.8 score might pay $50 or $50,000 depending on the program. Read the reward policy before investing time.
- **VDP ≠ BBP:** if the program is a VDP, there is no monetary reward. Do not confuse them when selecting targets.
- **Reproducibility is the most important part of the report:** if triage cannot reproduce it → it will be marked "Needs more info" or closed. Include complete headers, cookies, and browser version if relevant.
- **Business impact for non-technical audiences:** some less mature companies need the impact translated into business terms: customer data loss, GDPR fines, reputational damage.
- **Do not escalate to Mediation prematurely:** Mediation is a last resort. Try resolving the discrepancy directly with the triage team first.
- **Responsible disclosure deadline:** usually 90 days. If the fix does not arrive, you can disclose publicly after the deadline expires, but notify the program in advance.

---

## Related Cheatsheets

- [Web Fuzzing](/en/metodologias/recon/web-fuzzing/) — subdomains and endpoints recon for bug bounty
- [JavaScript Deobfuscation](/en/metodologias/recon/javascript-deobfuscation/) — finding endpoints and secrets in JS
- [Broken Authentication](/en/metodologias/web/broken-authentication/) — frequent auth vulnerabilities in BBPs
- [Server-side Attacks](/en/metodologias/web/server-side-attacks/) — SSRF, SSTI — high-impact bugs in BBPs
- [API Attacks](/en/metodologias/web/api-attacks/) — API security bugs — highly valued category in BBPs
- [Attacking GraphQL](/en/metodologias/web/attacking-graphql/) — emerging GraphQL bugs in BBPs
