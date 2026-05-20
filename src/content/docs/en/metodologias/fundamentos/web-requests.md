---
title: "Web Requests"
description: "HTTP/HTTPS with cURL, verbs, headers, and authentication."
sidebar:
  order: 6
  label: "Web Requests"
---
> HTTP/HTTPS in depth: anatomy of requests and responses, practical cURL usage, basic authentication, cookies, and CRUD operations with REST APIs.

---


## cURL — Essential Flags

| Flag | Function |
|------|---------|
| `-s` | Silent — suppress progress and errors |
| `-v` | Verbose — show complete request + response |
| `-I` | Response headers only (HEAD request) |
| `-i` | Include headers in the output (with the body) |
| `-X METHOD` | HTTP Method (`POST`, `PUT`, `DELETE`, etc.) |
| `-d 'data'` | Request body (POST/PUT) |
| `-H 'Header: val'` | Add a custom header |
| `-u user:pass` | HTTP Basic Authentication |
| `-b 'cookie=val'` | Send a cookie |
| `-c cookie.txt` | Save received cookies to a file |
| `-A 'UserAgent'` | Define the User-Agent |
| `-L` | Follow redirects (301/302) |
| `-k` | Ignore SSL errors |
| `-o file` | Save output to a file |
| `-O` | Save using the remote file name |
| `\| jq` | Format JSON (requires `jq` installed) |

```bash
# Examples of common combinations
curl -s URL | jq                                # GET + JSON format
curl -sI URL                                    # Headers only (silent)
curl -sv URL 2>&1 | grep -E "^[<>]"            # Show only request/response headers
curl -X POST -d 'user=admin&pass=admin' URL -L  # POST form + follow redirect
```

---

## HTTP Anatomy

### Request

```
GET /search.php?query=test HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0
Accept: text/html
Cookie: PHPSESSID=abc123
Authorization: Basic YWRtaW46YWRtaW4=
```

### Response

```
HTTP/1.1 200 OK
Date: Mon, 21 Feb 2022 13:00:00 GMT
Server: Apache/2.4.41
Content-Type: text/html; charset=UTF-8
Set-Cookie: PHPSESSID=abc123; path=/
Content-Security-Policy: script-src 'self'
Strict-Transport-Security: max-age=31536000

<html>...</html>
```

---

## Headers — Quick Reference

### Request Headers (Sent by the Client)

| Header | Description | Pentest Relevance |
|--------|-------------|-------------------|
| `Host` | Target domain | Vhost fuzzing |
| `User-Agent` | Client ID | Fingerprinting, filter bypass |
| `Referer` | Previous page | Sometimes required for CSRF |
| `Cookie` | Session cookies | Session hijacking |
| `Authorization` | Credentials (Basic/Bearer/JWT) | Auth bypass |
| `Content-Type` | Body type (JSON/form) | Required for POST with JSON |
| `X-Forwarded-For` | Real IP behind proxy | IP restrictions bypass |

### Response Headers (Key for Pentesting)

| Header | Description | Pentest Relevance |
|--------|-------------|-------------------|
| `Set-Cookie` | Defines cookie + flags | HTTPOnly, Secure, SameSite |
| `WWW-Authenticate` | Required authentication type | Indicates Basic Auth |
| `Server` | Server technology | Fingerprinting, version vulnerabilities |
| `X-Powered-By` | Framework/language | Fingerprinting |
| `Content-Security-Policy` | Resource policy | Weaknesses → XSS bypass |
| `Strict-Transport-Security` | Enforced HTTPS | Absence → downgrade attack |
| `Access-Control-Allow-Origin` | CORS policy | Misconfiguration → data theft |

```bash
# View all response headers
curl -sI http://TARGET/ | grep -iE "server|x-powered|set-cookie|csp|cors|hsts"
```

---

## Authentication

### HTTP Basic Auth

```bash
# Option 1 — -u flag
curl -u admin:admin http://TARGET/

# Option 2 — Direct URL
curl http://admin:admin@TARGET/

# Option 3 — Manual header (base64 of "user:pass")
echo -n 'admin:admin' | base64          # → YWRtaW46YWRtaW4=
curl -H 'Authorization: Basic YWRtaW46YWRtaW4=' http://TARGET/
```

> **Tip:** `WWW-Authenticate: Basic realm="..."` in the response confirms that Basic Auth is required. Attempt bypass with a direct header.

### Cookie Auth (PHP Session)

```bash
# 1. Login → capture cookie
curl -X POST -d 'username=admin&password=admin' http://TARGET/ -i
# Search in response: Set-Cookie: PHPSESSID=VALUE

# 2. Use the captured cookie
curl -b 'PHPSESSID=c1nsa6op7vtk7kdis7bcnbadf1' http://TARGET/

# 3. Specify as a header
curl -H 'Cookie: PHPSESSID=c1nsa6op7vtk7kdis7bcnbadf1' http://TARGET/

# 4. Save/reuse cookie automatically
curl -c cookies.txt -X POST -d 'username=admin&password=admin' http://TARGET/
curl -b cookies.txt http://TARGET/protected
```

### JWT / Bearer

```bash
# JWT / Bearer token
curl -H 'Authorization: Bearer eyJhbGci...' http://TARGET/api/data
```

---

## HTTP Methods — Reference

| Method | CRUD | Description | Risk if Uncontrolled |
|--------|------|-------------|----------------------|
| `GET` | Read | Parameters in URL, logged by server | Data leaks in logs |
| `POST` | Create | Hidden body, accepts binary, no size limit | Forms, logins |
| `PUT` | Update | Modifies/creates the entire resource | Malicious file upload |
| `PATCH` | Update (partial) | Modifies specific fields | Privilege escalation |
| `DELETE` | Delete | Deletes resource | DoS by deleting critical files |
| `HEAD` | — | Headers only (no body) | Verify existence without downloading |
| `OPTIONS` | — | Methods accepted by the server | Capability enumeration |

```bash
# View permitted methods
curl -X OPTIONS http://TARGET/ -i
# Search for: Allow: GET, POST, PUT, DELETE

# Test alternative method (403 bypass)
curl -X PUT http://TARGET/admin/config -d ''
curl -X POST http://TARGET/admin -H 'X-HTTP-Method-Override: DELETE'
```

---

## HTTP Status Codes — Pentest

| Code | Meaning | Action |
|------|---------|--------|
| `200 OK` | Success | Resource accessible |
| `301/302` | Redirect | `-L` in cURL; can reveal paths |
| `400` | Bad Request | Check payload format |
| `401` | Unauthorized | Basic Auth required → try bypass |
| `403` | Forbidden | Resource **exists** → try bypass with methods/headers |
| `404` | Not Found | Does not exist (or hidden); check with ffuf |
| `405` | Method Not Allowed | Try other HTTP verbs |
| `500` | Internal Server Error | Server error → stack trace possible |
| `502/504` | Gateway Error | Proxy/load balancer detected |

```bash
# Verify response code only
curl -s -o /dev/null -w "%{http_code}" http://TARGET/path
```

---

## GET — Parameters and Searches

```bash
# GET with parameters in the URL
curl -s 'http://TARGET/search.php?search=london' -H 'Authorization: Basic YWRtaW46YWRtaW4='

# Copy request as cURL from DevTools:
# DevTools → Network → right-click on request → Copy → Copy as cURL

# Copy as Fetch (for JS console):
# Copy → Copy as Fetch → paste into Console (Ctrl+Shift+K)
```

---

## POST — Forms and JSON

```bash
# POST form data (application/x-www-form-urlencoded)
curl -X POST -d 'username=admin&password=admin' http://TARGET/login.php

# POST with redirect follow
curl -X POST -d 'username=admin&password=admin' http://TARGET/login.php -L -i

# POST with JSON
curl -X POST \
  -d '{"search":"london"}' \
  -H 'Content-Type: application/json' \
  -b 'PHPSESSID=abc123' \
  http://TARGET/search.php

# POST with file
curl -X POST -F 'file=@shell.php' http://TARGET/upload.php
```

---

## CRUD API — Complete cURL

```bash
# READ — GET
curl -s http://TARGET/api.php/city/london | jq
curl -s http://TARGET/api.php/city/ | jq        # all records

# CREATE — POST
curl -X POST http://TARGET/api.php/city/ \
  -d '{"city_name":"TestCity","country_name":"HTB"}' \
  -H 'Content-Type: application/json'

# UPDATE — PUT (specify entity in URL)
curl -X PUT http://TARGET/api.php/city/london \
  -d '{"city_name":"NewCity","country_name":"HTB"}' \
  -H 'Content-Type: application/json'

# DELETE
curl -X DELETE http://TARGET/api.php/city/TestCity

# Verify after each operation
curl -s http://TARGET/api.php/city/TestCity | jq
```

---

## DevTools — Workflow

```
1. Open DevTools → Network (F12 → Network)
2. Trash icon → clear history
3. Perform action in the app
4. Click on the request → inspect:
   - Headers tab → view request + response headers
   - Request tab → view sent body (Raw to view raw data)
   - Cookies tab → PHPSESSID, tokens
   - Response tab → response body

Shortcuts:
  Ctrl+Shift+E  → Network tab (Firefox)
  Ctrl+Shift+K  → Console tab (Firefox)
  Shift+F9      → Storage tab (to edit cookies)

5. Copy as cURL → paste into terminal to replicate
6. Copy as Fetch → paste into Console to replicate with JS
```

---

## Pitfalls / Gotchas

- **Content-Type mandatory in JSON:** without `-H 'Content-Type: application/json'`, the server might reject the body or interpret it as form data.
- **Cookie vs Authorization:** some apps use both. If access fails, try including both headers.
- **Base64 in Basic Auth is not encryption:** `Authorization: Basic YWRtaW46YWRtaW4=` is trivially decoded. Do not confuse it with security.
- **Unauthenticated PUT = file upload:** if the server accepts PUT without controls, it might be possible to upload a webshell directly.
- **OPTIONS reveals capabilities:** a server returning `Allow: PUT, DELETE` is a priority target for testing those methods.
- **-L in cURL:** without `-L`, cURL does not follow redirects. Logins typically redirect to a dashboard after successful authentication.
- **jq is not always installed:** quick alternative — `python3 -m json.tool` or `python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin), indent=2))"`.
- **Fetch in console ignores Same-Origin:** running Fetch from the console of the target site bypasses CORS since it is in the same origin.

---

## Related Cheatsheets

- [Introduction to Web Applications](/en/metodologias/fundamentos/introduction-web-applications/) — web architecture, technologies, basic vulnerabilities
- [Web Fuzzing](/en/metodologias/recon/web-fuzzing/) — discovering paths, parameters, and vhosts with ffuf
- [Broken Authentication](/en/metodologias/web/broken-authentication/) — sessions, JWT, cookies, MFA bypass
- [API Attacks](/en/metodologias/web/api-attacks/) — attacks on REST APIs, mass assignment, auth bypass
