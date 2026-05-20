---
title: "Attacking Web Apps · Ffuf"
description: "Fuzzing de directorios, subdominios y parámetros para descubrimiento web."
sidebar:
  order: 5
  label: "Attacking Web Apps · Ffuf"
---
> ffuf: fuzzing ultrarrápido de directorios, extensiones, VHosts, parámetros GET/POST y valores. Sin throttle, sin límites.

---


## Wordlists de referencia

```bash
# Directorios
/opt/useful/seclists/Discovery/Web-Content/directory-list-2.3-small.txt
/opt/useful/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt

# Extensiones web
/opt/useful/seclists/Discovery/Web-Content/web-extensions.txt

# Subdominios / VHosts
/opt/useful/seclists/Discovery/DNS/subdomains-top1million-5000.txt
/opt/useful/seclists/Discovery/DNS/subdomains-top1million-20000.txt

# Parámetros HTTP
/opt/useful/seclists/Discovery/Web-Content/burp-parameter-names.txt

# Generar wordlist numérica (para IDs)
for i in $(seq 1 1000); do echo $i >> ids.txt; done
```

---

## Directory Fuzzing

```bash
# Fuzzing básico de directorios
ffuf -w /opt/useful/seclists/Discovery/Web-Content/directory-list-2.3-small.txt:FUZZ \
  -u http://TARGET:PORT/FUZZ

# Con verbose y output a archivo
ffuf -w <wordlist>:FUZZ -u http://TARGET/FUZZ -v -o results.json -of json

# Opciones de output
-o results.txt    # guardar output
-of json          # formato: json, ejson, html, md, csv, ecsv
```

---

## Extension Fuzzing — Identificar lenguaje

```bash
# Fuzzear extensión de index para saber si es PHP, ASP, etc.
ffuf -w /opt/useful/seclists/Discovery/Web-Content/web-extensions.txt:FUZZ \
  -u http://TARGET:PORT/blog/indexFUZZ

# Resultado esperado: .php → 200, .phps → 403, etc.
# Confirma lenguaje → usar en page fuzzing
```

---

## Page Fuzzing — Archivos bajo directorio

```bash
# Una vez identificada la extensión (.php)
ffuf -w /opt/useful/seclists/Discovery/Web-Content/directory-list-2.3-small.txt:FUZZ \
  -u http://TARGET:PORT/blog/FUZZ.php
```

---

## Recursive Fuzzing

```bash
# Escaneo recursivo: busca subdirectorios y páginas automáticamente
ffuf -w /opt/useful/seclists/Discovery/Web-Content/directory-list-2.3-small.txt:FUZZ \
  -u http://TARGET:PORT/FUZZ \
  -recursion -recursion-depth 1 \
  -e .php \
  -v

# -recursion-depth 1 → solo un nivel de profundidad (evitar tiempo excesivo)
# -e .php → añade variante con extensión a cada entrada
# -v → mostrar URL completa en output
```

> **Tip:** recursive con `-recursion-depth 2+` puede tardar mucho. Usar depth 1 primero, luego hacer scan manual sobre directorios interesantes.

---

## DNS Subdomain Fuzzing (público)

```bash
# Subdominios públicos (requieren DNS record público)
ffuf -w /opt/useful/seclists/Discovery/DNS/subdomains-top1million-5000.txt:FUZZ \
  -u https://FUZZ.inlanefreight.com/

# Añadir subdominio encontrado a /etc/hosts
sudo sh -c 'echo "SERVER_IP  subdominio.dominio.com" >> /etc/hosts'
```

---

## VHost Fuzzing (público + privado)

```bash
# VHost fuzzing via header Host: — descubre VHosts sin DNS público
ffuf -w /opt/useful/seclists/Discovery/DNS/subdomains-top1million-5000.txt:FUZZ \
  -u http://academy.htb:PORT/ \
  -H 'Host: FUZZ.academy.htb'

# Todos devuelven 200 → filtrar por tamaño de la respuesta por defecto
# Primero hacer request normal y anotar el size (ej. 900)
ffuf -w /opt/useful/seclists/Discovery/DNS/subdomains-top1million-5000.txt:FUZZ \
  -u http://academy.htb:PORT/ \
  -H 'Host: FUZZ.academy.htb' \
  -fs 900

# VHost encontrado → añadir a /etc/hosts
sudo sh -c 'echo "IP  admin.academy.htb" >> /etc/hosts'
```

> **Clave VHost vs subdomain:** VHost fuzzing usa `-H 'Host: FUZZ.dominio'` contra la IP/dominio principal. Detecta VHosts sin registro DNS público.

---

## Filtros y Matchers

```bash
# MATCHER — solo mostrar si cumple condición
-mc 200,301,302    # match HTTP status codes (default: 200,204,301,302,307,401,403)
-ms 1234           # match response size exacta
-mw 50             # match número de palabras
-ml 20             # match número de líneas
-mr "Welcome"      # match regexp en respuesta

# FILTER — ocultar si cumple condición
-fc 404,403        # filtrar por status code
-fs 900            # filtrar por tamaño (el más útil para VHost)
-fw 10             # filtrar por palabras
-fl 5              # filtrar por líneas
-fr "Not Found"    # filtrar por regexp
```

---

## Parameter Fuzzing — GET

```bash
# Descubrir parámetros GET aceptados por la página
ffuf -w /opt/useful/seclists/Discovery/Web-Content/burp-parameter-names.txt:FUZZ \
  -u http://admin.academy.htb:PORT/admin/admin.php?FUZZ=key \
  -fs <default_size>

# Calcular default_size: hacer curl sin parámetro y anotar el tamaño
curl -s http://admin.academy.htb:PORT/admin/admin.php | wc -c
```

---

## Parameter Fuzzing — POST

```bash
# Descubrir parámetros POST
ffuf -w /opt/useful/seclists/Discovery/Web-Content/burp-parameter-names.txt:FUZZ \
  -u http://admin.academy.htb:PORT/admin/admin.php \
  -X POST \
  -d 'FUZZ=key' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -fs <default_size>

# Verificar parámetro encontrado con curl
curl http://admin.academy.htb:PORT/admin/admin.php \
  -X POST -d 'id=key' \
  -H 'Content-Type: application/x-www-form-urlencoded'
```

---

## Value Fuzzing — Enumerar valores válidos

```bash
# Generar wordlist numérica
for i in $(seq 1 1000); do echo $i >> ids.txt; done

# Fuzzear valor del parámetro
ffuf -w ids.txt:FUZZ \
  -u http://admin.academy.htb:PORT/admin/admin.php \
  -X POST \
  -d 'id=FUZZ' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -fs <default_size>
```

---

## Flags clave de ffuf

| Flag | Descripción |
|------|-------------|
| `-w <wordlist>:FUZZ` | Wordlist + keyword |
| `-u <url>` | URL objetivo (poner FUZZ donde se fuzza) |
| `-H 'Header: value'` | Añadir/modificar header (VHost: `Host: FUZZ.domain`) |
| `-X POST` | Método HTTP (default: GET) |
| `-d 'param=FUZZ'` | Data para POST |
| `-b 'cookie=value'` | Cookie para peticiones autenticadas |
| `-e .php,.html` | Extensiones adicionales en modo recursivo |
| `-recursion` | Activar recursión |
| `-recursion-depth 1` | Profundidad máxima de recursión |
| `-t 40` | Threads (default: 40; no subir de 200) |
| `-mc <codes>` | Match por status code |
| `-fs <size>` | Filtrar por tamaño de respuesta |
| `-fc <codes>` | Filtrar por status code |
| `-ic` | Ignorar comentarios en wordlist (copyright headers) |
| `-v` | Output verbose con URL completa |
| `-o <file>` | Guardar resultados a archivo |
| `-of json` | Formato de output (json, html, csv, md) |
| `-s` | Silent mode — solo resultados |

---

## Flujo completo — Web Fuzzing

```
1. Directory fuzzing         → descubrir /blog, /admin, /api...
2. Extension fuzzing         → determinar tech stack (PHP, ASP, JSP...)
3. Page fuzzing              → FUZZ.php bajo cada directorio
4. Recursive scan            → cubrir todo el árbol de una vez
5. VHost fuzzing             → Host: FUZZ.dominio -fs <default>
6. Añadir VHost a /etc/hosts → acceder al VHost real
7. GET param fuzzing         → ?FUZZ=key → encontrar parámetros
8. POST param fuzzing        → -X POST -d 'FUZZ=key'
9. Value fuzzing             → id=FUZZ con wordlist numérica/custom
```

---

## Pitfalls / Gotchas

- **ffuf default matchers** → incluye 401, 403 como hits. Añadir `-fc 403` si producen ruido.
- **VHost fuzzing sin filtro** → todos devuelven 200 del host por defecto. Siempre buscar el default size y añadir `-fs <size>`.
- **Wordlist con comentarios** → `directory-list-2.3` tiene copyright en las primeras líneas. Usar `-ic` para ignorarlos.
- **-t 200** → puede generar DoS en targets sensibles o ser detectado como ataque. Mantener 40 (default) en entornos reales.
- **Recursive + extensiones** → el tamaño del scan se multiplica: wordlist × extensiones × profundidad. Controlar con `-recursion-depth 1`.
- **POST Content-Type** → PHP solo acepta `application/x-www-form-urlencoded` para datos POST. Siempre añadir `-H 'Content-Type: ...'`.
- **VHost no añadido a /etc/hosts** → el browser no puede resolver el VHost encontrado. Añadirlo antes de intentar visitar.
- **Default size cambia entre páginas** → calcular el default size específico de cada endpoint antes de fuzzear parámetros.
- **Sub-domain fuzzing vs VHost** → subdomain fuzzing require DNS público. Para labs internos usar siempre VHost fuzzing.

---

## Cheatsheets relacionados

- [Using Web Proxies](/metodologias/web/using-web-proxies/) — interceptar y modificar peticiones de ffuf en Burp/ZAP
- [Login Brute Forcing](/metodologias/web/login-brute-forcing/) — fuerza bruta de formularios de login
- [Information Gathering - Web Edition](/metodologias/recon/information-gathering-web/) — OSINT y subdominios antes de fuzzear
- [SQL Injection Fundamentals](/metodologias/web/sql-injection-fundamentals/) — inyección en parámetros encontrados con ffuf
- [File Inclusion](/metodologias/web/file-inclusion/) — LFI/RFI en paths descubiertos con fuzzing
