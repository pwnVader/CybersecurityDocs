---
title: "Using Web Proxies"
description: "Burp Suite, ZAP, intercepción y manipulación de tráfico HTTP."
sidebar:
  order: 1
  label: "Using Web Proxies"
---
> Interceptación, manipulación y automatización de tráfico HTTP con Burp Suite y ZAP. La base para cualquier ataque web.

---


## Setup inicial

### FoxyProxy

```
1. Extensión Firefox/Chrome: FoxyProxy Standard
2. Añadir proxy: IP 127.0.0.1, Port 8080, Type HTTP
3. Activar → todo el tráfico pasa por Burp/ZAP
```

### CA Certificates — HTTPS sin warning

```bash
# Burp Suite
# Navegar a: http://burp
# → descargar cacert.der → importar en Firefox/Chrome como CA de confianza
# Firefox: about:preferences → Privacy → View Certificates → Import

# ZAP
# Tools → Options → Network → Server Certificates → Save → importar en browser
```

### Puertos por defecto

| Herramienta | Puerto |
|-------------|--------|
| Burp Suite | 8080 |
| ZAP | 8080 |

---

## Interceptar peticiones

### Burp Suite

```
Proxy → Intercept → "Intercept is on"
→ Modificar cuerpo/headers → Forward
→ Drop para descartar
```

### ZAP

```
CTRL+B → activar/desactivar intercepción
Panel izquierdo HUD → botón 2 (flecha circular)
→ Step: avanzar petición por petición
```

### Interceptar RESPUESTAS

```bash
# Burp
Proxy → Proxy settings → Response interception rules
→ "Intercept responses based on the following rules"
→ Activar regla por defecto

# ZAP
→ botón Step → forward de la response
```

---

## Manipular peticiones interceptadas

```
Casos de uso típicos:
- Inyección SQL: cambiar value → ' OR 1=1--
- Command injection: añadir ; id al parámetro
- File upload: cambiar Content-Type o extensión
- Auth bypass: modificar rol/cookie
- SSRF: cambiar URL a internal host
```

---

## Modificación automática (sin interceptar)

### Burp — Match and Replace

```
Proxy → Proxy settings → HTTP match and replace rules → Add
  Type: Request header / Request body / Response header / Response body
  Match: regex o string literal (ej. ^User-Agent.*$)
  Replace: valor nuevo (ej. User-Agent: Mozilla/5.0)
  → Aplica a TODA petición que pase por el proxy
```

### ZAP — Replacer

```
CTRL+R → Replacer
→ Add rule → Description, Match Type, Match String, Replacement
→ Enable → aplica automáticamente
```

---

## Repeater / Repetir peticiones

### Burp Repeater

```
Desde historial o Intercept:
→ CTRL+R → enviar al Repeater
→ CTRL+SHIFT+R → abrir pestaña Repeater
→ Modificar → Send
→ Navegar historial con flechas ← →
```

### ZAP — Resend with Request Editor

```
Historia → clic derecho → Open/Resend with Request Editor
→ Modificar → Send
```

### ZAP — HUD Replay

```
En el panel HUD → Replay in Console
→ Replay in Browser (re-ejecuta en el browser)
```

---

## Encoding / Decoding

### Burp Decoder

```
Seleccionar texto → CTRL+SHIFT+D → Decoder tab
→ Decode as: URL / HTML / Base64 / ASCII hex / Hex / Octal / Binary / GZIP
→ Encode as: mismo menú
→ Smart Decode: detecta automáticamente

Atajo rápido en Repeater/Intercept:
→ Seleccionar texto → CTRL+U (URL-encode selección)
```

### ZAP — Encoder/Decoder/Hash

```
CTRL+E → Encoder/Decoder/Hash
→ Input → Output en múltiples formatos simultáneamente
→ Soporta: URL, HTML, Base64, SHA-1/256/512, MD5
```

---

## Proxying de herramientas CLI

### proxychains

```bash
# Editar /etc/proxychains.conf — añadir al final:
http 127.0.0.1 8080

# Usar con cualquier herramienta
proxychains -q curl http://target/api/v1/users
proxychains -q sqlmap -u "http://target/page?id=1"
proxychains -q nmap -sT -Pn 192.168.1.1
```

### Metasploit a través de proxy

```bash
msf6 > use auxiliary/scanner/http/http_version
msf6 > set PROXIES HTTP:127.0.0.1:8080
msf6 > set RHOSTS target.com
msf6 > run
```

---

## Burp Intruder — Fuzzing

### Configurar ataque

```
1. Petición en Repeater/Intercept → CTRL+I → Intruder
2. Positions tab:
   - "Clear §" → eliminar marcadores existentes
   - Seleccionar valor a fuzzear → "Add §"
   - Resultado: ...?param=§valor§
3. Payloads tab:
   - Payload type: Simple List (wordlist pequeña)
   - Payload type: Runtime file (wordlist grande — carga en tiempo real)
   - Load → seleccionar archivo
4. Payload Processing:
   - Add rule → "Skip if matches regex": ^\..*$  (excluir dotfiles)
5. Settings → Grep-Match: añadir "200 OK" (resaltar respuestas exitosas)
6. Attack → Start Attack
```

### Tipos de ataque

| Tipo | Uso |
|------|-----|
| **Sniper** | Un parámetro, una wordlist — el más común |
| **Battering ram** | Misma palabra en todos los parámetros simultáneamente |
| **Pitchfork** | N wordlists, una por parámetro — se emparejan línea a línea |
| **Cluster bomb** | Producto cartesiano de todas las wordlists (usuario × contraseña) |

> ⚠️ **Burp Community Edition** → throttled a 1 req/s. Para fuzzing rápido usar ZAP Fuzzer.

---

## ZAP Fuzzer — Fuzzing

```
1. Petición en historial → clic derecho → Attack → Fuzz
2. Fuzz Locations:
   - Seleccionar texto en la petición → Add
3. Payloads → Add:
   - File: wordlist propia
   - File Fuzzers: dirbuster / common.txt, Numberzz, etc.
4. Processors → Add (para procesar cada payload):
   - URL Encode
   - Base64 Encode
   - MD5 Hash
   - Prefix/Postfix String
   - Script
5. Options:
   - Concurrent threads: 20 (ajustar según target)
   - Retries: 3
   - Depth first / Breadth first strategy
6. Start Fuzzer
```

> **Ventaja sobre Intruder:** ZAP Fuzzer no tiene throttle — velocidad completa sin pagar.

---

## Burp Scanner (Pro)

### Crawler — Discovery

```
1. Target → Site map → navegar el target para poblar el mapa
2. Clic derecho en host/ruta → Add to Scope
3. Target → Scope → verificar/ajustar rutas incluidas
4. Dashboard → New Scan
   - Crawl: solo descubrir rutas
   - Crawl and Audit: descubrir + encontrar vulnerabilidades
5. Elegir preset:
   - Crawl strategy - fastest
   - Crawl strategy - more complete
   - Never stop crawl
```

### Passive Scanner

```
1. Navegar el sitio manualmente con el proxy activo
2. Historial → seleccionar petición → clic derecho → Do passive scan
3. Dashboard → Issue activity → ver hallazgos
   (sin enviar peticiones activas — solo analiza lo que ya capturó)
```

### Active Scanner

```
1. Target → Site map → clic derecho en host → Scan
   o Dashboard → New Scan → Crawl and Audit
2. Reporta vulnerabilidades en Dashboard → Issue activity:
   - SQL injection, XSS, XXE, SSRF, path traversal, etc.
3. Clic en finding → Advisory → descripción + evidence + remediation
```

> ⚠️ Scanner activo **solo con autorización explícita** — genera tráfico agresivo y puede crashear servicios.

---

## ZAP Scanner

```
# Scan automático desde UI
Tools → Active Scan → seleccionar target → Start Scan

# Desde línea de comandos (headless)
zap-cli quick-scan --self-contained --start-options "-config api.disablekey=true" http://target

# Spider (equivalente al crawler)
Tools → Spider → seleccionar target → Start Scan
→ Dashboard → Spider tab → ver URLs descubiertas

# Reporte
Report → Generate Report → HTML/XML/JSON
```

---

## Quick Reference — Burp vs ZAP

| Feature | Burp (Community) | Burp (Pro) | ZAP |
|---------|-----------------|------------|-----|
| Precio | Gratis | $449/año | Gratis |
| Interceptar | ✅ | ✅ | ✅ |
| Repeater | ✅ | ✅ | ✅ (Request Editor) |
| Intruder/Fuzzer | ✅ throttled | ✅ full speed | ✅ full speed |
| Scanner | ❌ | ✅ | ✅ |
| Crawler | ❌ | ✅ | ✅ |
| Extensions | ✅ (limitadas) | ✅ (BApp Store) | ✅ (Marketplace) |
| HUD en browser | ❌ | ❌ | ✅ |

---

## Pitfalls / Gotchas

- **CA cert no instalada** → HTTPS da error de certificado y el proxy no captura nada. Instalar siempre antes de empezar.
- **FoxyProxy desactivado** → el tráfico no pasa por el proxy. Verificar que el icono está activo antes de interceptar.
- **Burp Community throttle** → 1 req/s en Intruder. Para fuzzing de directorios, usar ZAP o ffuf directamente.
- **Intercept activado y olvidado** → el browser queda colgado esperando Forward. Siempre verificar el estado del intercept.
- **proxychains sin herramienta `-q`** → imprime verbose. Añadir `-q` para output limpio.
- **Metasploit PROXIES** → si el módulo no soporta proxies, la opción se ignora silenciosamente.
- **Scanner activo sin scope** → puede escanear dominios fuera del scope y meterse en problemas legales. Definir scope estricto.
- **ZAP HUD en HTTPS** → necesita que el CA de ZAP esté instalado en el browser. Mismos pasos que Burp.
- **Cluster Bomb en Burp Community** → genera muchas peticiones pero a 1 req/s es inútil. Usar Pitchfork como alternativa más eficiente con credenciales.
- **Intruder § markers automáticos** → Burp añade marcadores en todos los parámetros. Siempre hacer "Clear §" y añadir solo el parámetro objetivo.

---

## Cheatsheets relacionados

- [Attacking Web Applications with Ffuf](/metodologias/recon/attacking-web-applications-ffuf/) — fuzzing de directorios/parámetros sin throttle
- [Login Brute Forcing](/metodologias/web/login-brute-forcing/) — fuerza bruta de formularios HTTP con Hydra/Medusa
- [SQL Injection Fundamentals](/metodologias/web/sql-injection-fundamentals/) — manipular peticiones SQL via proxy
- [File Upload Attacks](/metodologias/web/file-upload-attacks/) — bypass de Content-Type via intercepción
- [Command Injections](/metodologias/web/command-injections/) — modificar parámetros para inyección de comandos
- [Web Attacks](/metodologias/web/web-attacks/) — IDOR, XXE, JWT via proxy
