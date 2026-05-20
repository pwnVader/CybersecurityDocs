---
title: "Documentation & Reporting"
description: "Notes, evidence, and delivery of the final pentest report."
sidebar:
  order: 3
  label: "Documentation & Reporting"
---
> Structured notetaking, evidence management, and pentest report writing. The report is the final deliverable the client pays for — without solid documentation, the work does not exist.

---


## Project Folder Structure

```bash
mkdir -p CLIENT-IPT/{Admin,Deliverables,Evidence/{Findings,Scans/{Vuln,Service,Web,'AD Enumeration'},Notes,OSINT,Wireless,'Logging output','Misc Files'},Retest}
```

| Folder | Content |
|---------|-----------|
| `Admin/` | SoW, kickoff notes, status reports |
| `Deliverables/` | Report (draft and final), spreadsheet, slides |
| `Evidence/Findings/` | One subfolder per finding with evidence |
| `Evidence/Scans/` | Nmap, Nessus, BloodHound, CME output |
| `Evidence/Notes/` | Engagement notes |
| `Evidence/Logging output/` | Tmux, Metasploit logs |
| `Evidence/Misc Files/` | Webshells, payloads, custom scripts |
| `Retest/` | Retesting separated from the original assessment |

---

## Notes Structure (Minimum Sections)

| Section | Purpose |
|---------|-----------|
| **Attack Path** | Full outline: foothold → DA, with screenshots and output |
| **Credentials** | Centralized repository of compromised credentials |
| **Findings** | One entry per finding (narrative + evidence) |
| **Activity Log** | Chronological log of actions (for event correlation) |
| **Payload Log** | Hash + path of each payload uploaded to the target |
| **Scoping Information** | IPs/CIDRs, URLs, client credentials |
| **Service Enumeration Research** | Which services were investigated, what failed |
| **AD Enumeration Research** | BloodHound, PowerView, step-by-step |
| **Web Application Research** | Apps found, credentials tested |
| **OSINT** | Collected public data |

---

## Tmux Logging — Setup

```bash
# 1. Install plugin manager
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

# 2. Create .tmux.conf
cat > ~/.tmux.conf << 'EOF'
set -g @plugin 'tmux-plugins/tpm'
set -g @plugin 'tmux-plugins/tmux-sensible'
set -g @plugin 'tmux-plugins/tmux-logging'
set -g history-limit 50000
run '~/.tmux/plugins/tpm/tpm'
EOF

# 3. Load config
tmux source ~/.tmux.conf

# 4. New session → install plugins
tmux new -s pentest
# Inside: Ctrl+B → Shift+I (installs plugins)
```

```
Key tmux-logging shortcuts:
  Ctrl+B → Shift+P     → Start/stop logging of the current pane
  Ctrl+B → Alt+Shift+P → Retroactive logging of the entire pane
  Ctrl+B → Alt+P       → Screenshot of the current pane (without mixing output)
  Ctrl+B → Alt+C       → Clear pane history
```

---

## Payload Log — What to Log

For each payload/tool uploaded to the target:

| Field | Example |
|-------|---------|
| Timestamp | 2026-05-16 14:32 UTC |
| Target Host | 192.168.1.50 (WEB01) |
| Path on target | C:\Windows\Temp\winpeas.exe |
| Hash SHA256 | `sha256sum winpeas.exe` |
| Removed | Yes / No (cleanup pending) |

> **Exam Tip:** If you created accounts or modified configurations, document the hostname, timestamp, description, and account name. The client may ask you to revert them.

---

## Report Types

| Type | When |
|------|------|
| **Vulnerability Assessment** | Scan only, no exploitation |
| **Internal Penetration Test** | From within the network |
| **External Penetration Test** | From the internet, anonymous attacker perspective |
| **Draft Report** | Initial delivery → client feedback |
| **Final Report** | After incorporating client feedback |
| **Post-Remediation Report** | Retest of specific findings (not a new full assessment) |
| **Attestation Letter** | 1-2 pages for third parties/auditors (no technical details) |
| **Vulnerability Notification** | Critical RCE/data exposure → immediate out-of-band notification |

---

## Report Components

### Full Structure

```
1. Cover Page
2. Table of Contents
3. Executive Summary          ← written for non-technical readers
4. Summary of Recommendations ← short/medium/long term
5. Attack Chain               ← end-to-end exploitation chain
6. Findings                   ← one finding = one section
7. Appendices
   - Scope
   - Methodology
   - Severity Ratings
   - Biographies (required for PCI)
   - Exploitation Attempts Log
   - Password Analysis (if you dumped NTDS)
   - AD Hardening (observed best practices)
```

---

## Attack Chain — How to Write It

```
Structure:
1. Executive summary of the chain (1 paragraph)
2. Numbered steps with narrative context
3. For each step: command + relevant output (<SNIP> for long output)
4. Connect findings: "Combined with finding H2, this elevated severity from Medium to High"
```

**Example of a typical chain (Internal PT):**
```
1. Responder → capture bsmith's NTLMv2 hash
2. Hashcat -m 5600 → cleartext password → domain foothold
3. BloodHound → detects mssqlsvc with SPN + admin privileges on SQL01
4. GetUserSPNs.py → Kerberoasting of mssqlsvc → crack hash
5. CrackMapExec → LSA secrets on SQL01 → cleartext srvadmin password
6. Query users on MS01 → pramirez logged in with DCSync rights
7. Rubeus dump → pramirez's TGT → Pass-the-Ticket
8. Mimikatz lsadump::dcsync → Administrator hash → DA
```

---

## Executive Summary — Rules

### Do
- Write for a non-technical audience ("if your parents don't understand it, rewrite it")
- Be specific with metrics: "we found 7 vulnerabilities, 5 of high severity"
- Describe business impact: "access to HR documents and banking systems"
- Keep it to 1-2 pages maximum
- Mention what the client is doing well (e.g., mature patching process)
- Provide context on remediation effort (low/medium/significant)

### Don't
- Use acronyms: no SMB, NBT-NS, TGT, PtH — use plain English descriptions instead
- Recommend specific vendors (CrowdStrike, Splunk)
- Reference technical sections of the report
- Speak of "several/multiple" without giving an exact number
- Exceed 2 pages

### Non-Technical Vocabulary

| Technical Term | Executive Alternative |
|----------------|----------------------|
| Hash | "encrypted form of the password" |
| Password spraying | "testing a common password against thousands of accounts" |
| Kerberoasting | "theft of an authentication ticket to attempt offline cracking" |
| LLMNR spoofing | "insecure network protocol that allows credentials interception" |
| Domain Admin | "account with access to all organization systems" |
| SQL injection | "vulnerability that allows database manipulation" |

---

## Evidence Management

### Terminal Evidence vs. Screenshot

- **Prefer terminal output** — easier to format, copyable, doesn't bloat the .docx file
- **Screenshot** — when terminal cannot be copied (GUI, browser)
- **Never alter output** — you can use `<SNIP>` to truncate, but do not change the actual data
- **Remove special characters** — copy-pasting from Word can insert smart quotes that break commands

### Credential Redaction

```
Terminal output:
- Passwords: replace with <REDACTED> or <PASSWORD REDACTED>
- Hashes: show first/last 4 characters: e4a...ba2

Screenshots:
- DO NOT pixelate/blur (reversible with Unredacter)
- Use a solid black bar directly over the text
- Edit the image directly, do not apply a shape in Word (which can be moved/removed)
```

### What NOT to Store

- Unredacted PII (National ID, SSN, banking details)
- Sensitive file contents — a directory screenshot is sufficient
- Data that requires GDPR/HIPAA compliance to store

---

## Summary of Recommendations

Prioritize in three horizons:

| Term | Type | Example |
|-------|------|---------|
| **Short** | Specific and actionable fix | Patch CVE-XXXX, change default password |
| **Medium** | Process/configuration | Implement strong password policy |
| **Long** | Program/maturity | Establish a vulnerability management program |

> **Exam Tip:** A finding can have both a short-term AND a long-term recommendation. E.g., immediate patch + review of the patch management process.

---

## Pitfalls / Gotchas

- **Retest ≠ new assessment:** the post-remediation report only covers the original findings on the original hosts. If you run new scans, you will find new things and scope creep will occur.
- **Draft before final:** always deliver a draft first. PCI auditors do not accept drafts for compliance validation.
- **Snapshot in time:** always specify exact dates ("testing conducted from January 7 to 19, 2026"). Subsequent changes are not covered.
- **Retroactive Tmux logging:** if you forgot to enable logging, use `prefix + Alt+Shift+P`. However, this depends on the scrollback buffer — configure `history-limit 50000` from the start.
- **Leftover artifacts:** if you cannot clean up shells or tools, document it in the report. Never stay silent.
- **Network slowness attribution:** always keep tool logs and exact timestamps. You might be blamed for any network issues during the engagement.
- **Scope creep in retests:** limit the retest acceptance window. If the client requests a retest 1 year later, the environment will have changed and comparison won't be valid.
- **Accusatory Executive Summary:** do not imply that the client intentionally did something wrong. Use phrases like "appears to indicate" instead of absolute assertions (e.g., "testing activities did not appear to be detected").
- **Credentials in the Word report:** verify that no full hashes or cleartext passwords remain in the final document. Review using search features in the .docx file.
- **Mixed Tmux panes:** use pane screenshot (`prefix + Alt+P`) when you have split panes to capture clean output from each tool.

---

## Related Cheatsheets

- [Penetration Testing Process](/en/metodologias/fundamentos/penetration-testing-process/) — pentest phases that determine what to document
- [Active Directory Enumeration & Attacks](/en/metodologias/active-directory/active-directory-enumeration-attacks/) — BloodHound, data you capture and report
- [Password Attacks](/en/metodologias/exploitation/password-attacks/) — analyzing domain passwords for the appendix
- [Attacking Enterprise Networks](/en/metodologias/active-directory/attacking-enterprise-networks/) — full engagement where all this applies
