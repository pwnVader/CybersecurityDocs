---
title: "Penetration Testing Process"
description: "Methodology, phases, and mindset of a professional pentester."
sidebar:
  order: 1
  label: "Penetration Testing Process"
---
> Methodological module. No commands here: only **phases, checklists, and order of operations**. Memorize this flow — it is the backbone supporting all other modules.

---

## Pre-Engagement

### Mandatory Legal Documents

| Document | Purpose |
|---|---|
| **NDA** (Non-Disclosure Agreement) | Confidentiality of findings |
| **SoW** (Statement of Work) | Defines deliverables and deadlines |
| **MSA** (Master Service Agreement) | General terms of the contract |
| **RoE** (Rules of Engagement) | Defines what you CAN and CANNOT do |

### Scoping Questionnaire — Key Questions

- Assessment type? (black/grey/white-box)
- How many IPs / domains / applications in scope?
- Scope details: Internal, external, web app, wireless, social engineering?
- Allowed testing hours? (24/7 vs. business hours)
- DoS allowed? (almost always **NO**)
- Pivoting allowed between subnets?
- Technical point of contact + emergency number?
- Prior notification to the SOC? (announced vs. unannounced)

### Rules of Engagement — Checklist

- [ ] Defined source IP/range of the pentester
- [ ] Excluded systems (production-critical, prod DBs)
- [ ] Prohibited techniques (DoS, social engineering, physical)
- [ ] Engagement time window
- [ ] Escalation procedure if "something breaks"
- [ ] Procedure if evidence of a prior breach is found
- [ ] Sensitive data → can it be exfiltrated for PoC?

### Kick-Off Meeting — Minimum Agenda

- Confirm final scope
- Exchange contacts (technical + executive)
- Secure communication channel (Signal, PGP email)
- Real-time critical findings reporting plan
- Confirm test credentials if grey/white-box

---

## Information Gathering

Four sub-phases. Deepen in specific cheatsheets.

| Sub-phase | Related Cheatsheet |
|---|---|
| **OSINT** (public, without touching the target) | [Information Gathering - Web Edition](/en/metodologias/recon/information-gathering-web/) |
| **Infrastructure Enumeration** (ranges, ASN, DNS) | [Information Gathering - Web Edition](/en/metodologias/recon/information-gathering-web/) |
| **Service Enumeration** (port scan + banner) | [Network Enumeration with Nmap](/en/metodologias/recon/network-enumeration-nmap/) |
| **Host Enumeration** (per-service deep dive) | [Footprinting](/en/metodologias/recon/footprinting/) |

**Pillaging** = information gathering *after* establishing a foothold. Do not confuse it with initial OSINT.

---

## Vulnerability Assessment

Two final deliverables:

1. **Prioritized list of vulnerabilities** (CVSS + exploitability + business impact)
2. **Attack vector map** (which vulnerability leads to which asset)

See [Vulnerability Assessment](/en/metodologias/fundamentos/vulnerability-assessment/) for tools (Nessus, OpenVAS, scoring).

> ⚠️ **VA ≠ Pentest.** VA only identifies; pentest exploits. In your report, make sure to clearly distinguish *confirmed* (exploited) vs. *theoretical* findings.

---

## Exploitation

### Prioritization (The key question: Where do I start?)

```
Score = (Probability of success) × (Impact) × (1 / Detection risk)
```

Attack **high probability + low noise** vectors first. Save noisy actions for later (or never, if restricted by RoE).

### Pre-Attack Preparation (Checklist)

- [ ] Exploit tested in an identical lab environment (never blind in prod)
- [ ] Rollback plan in case the target goes down
- [ ] Active local logging (asciinema, script, tmux capture)
- [ ] Listener ready ([Shells & Payloads](/en/metodologias/exploitation/shells-payloads/))
- [ ] Start timestamp noted

---

## Post-Exploitation

Recommended order after gaining a foothold:

```
1. Situational awareness (whoami, hostname, ip, OS, AV)
2. Local Information Gathering (processes, active connections, users)
3. Pillaging (credentials, configurations, documents, hashes)
4. Persistence (if allowed by RoE — optional)
5. Privilege Escalation → [Linux Privilege Escalation](/en/metodologias/privesc/linux-privilege-escalation/) / [Windows Privilege Escalation](/en/metodologias/privesc/windows-privilege-escalation/)
6. Data Exfiltration (only what is necessary for PoC, encrypted)
```

> ⚠️ **Evasive testing:** if RoE requires stealth, disable noisy scripts and prefer native binary vectors like LOLBAS/GTFOBins.

---

## Lateral Movement

After privilege escalation, repeat the cycle from the new host:
**Pivoting** → **Internal Info Gathering** → **Vulnerability Assessment** → **Exploitation** → **Post-Exploitation**.

See [Pivoting, Tunneling, and Port Forwarding](/en/metodologias/pivoting/pivoting-tunneling-port-forwarding/) for mechanics.

---

## Proof-of-Concept

The PoC must be **reproducible, minimal, and well-documented**. Typical structure:

```markdown
## Vulnerability: <name>
- Affected asset: <ip/hostname/url>
- Severity: <CVSS>
- Steps to reproduce:
  1. <exact command>
  2. <screenshot/output>
- Impact: <what the attacker achieves>
- Remediation: <recommended fix>
```

---

## Post-Engagement

### Cleanup Checklist

- [ ] Remove all uploaded webshells / payloads
- [ ] Delete created users (`net user x /delete`)
- [ ] Revert configuration changes / firewall rules
- [ ] Clean up scheduled tasks / added services
- [ ] Confirm cleanup with the client artifact-by-artifact

### Reporting — Mandatory Sections

1. Executive Summary (1 page, jargon-free)
2. Scope & Methodology
3. Findings (ordered by severity)
4. Technical Details (with PoC)
5. Remediation Recommendations
6. Appendix (tools, timeline, logs)

Details: [Documentation & Reporting](/en/metodologias/fundamentos/documentation-reporting/).

### Data Retention

Delete all client evidence after the agreed period (typically 30-90 days post-final report delivery).

---

## Common Exam Pitfalls

- **Starting to scan before having the signed contract** → Big no.
- Confusing **OSINT** (pre-access, public) with **Pillaging** (post-access, on the host).
- Forgetting that **Lateral Movement reopens the entire cycle** from the new host.
- Skipping Vulnerability Assessment and "throwing exploits blindly" → You will waste valuable time.
- Not documenting timestamps → You need a detailed timeline in your CPTS report.

---

## Related Cheatsheets

- [Getting Started](/en/metodologias/fundamentos/getting-started/) — Technical setup prior to engagement
- [Documentation & Reporting](/en/metodologias/fundamentos/documentation-reporting/) — Delivering the report
