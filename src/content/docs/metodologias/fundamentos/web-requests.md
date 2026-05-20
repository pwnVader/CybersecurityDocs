---
title: "Web Requests"
description: "HTTP/HTTPS con cURL, verbos, headers y autenticación."
sidebar:
  order: 6
  label: "Web Requests"
---
> HTTP/HTTPS en profundidad: anatomía de peticiones y respuestas, cURL operativo, autenticación básica, cookies y CRUD con APIs REST.

---


## cURL — Flags esenciales

| Flag | Función |
|------|---------|
| `-s` | Silent — suprimir progreso y errores |
| `-v` | Verbose — ver request + response completo |
| `-I` | Solo headers de respuesta (HEAD request) |
| `-i` | Incluir headers en el output (con body) |
| `-X METHOD` | Método HTTP (`POST`, `PUT`, `DELETE`, etc.) |
| `-d 'data'` | Body de la petición (POST/PUT) |
| `-H 'Header: val'` | Añadir header personalizado |
| `-u user:pass` | HTTP Basic Auth |
| `-b 'cookie=val'` | Enviar cookie |
| `-c cookie.txt` | Guardar cookies recibidas a archivo |
| `-A 'UserAgent'` | Definir User-Agent |
| `-L` | Seguir redirects (301/302) |
| `-k` | Ignorar errores SSL |
| `-o file` | Guardar output a archivo |
| `-O` | Guardar con nombre del servidor |
| `\| jq` | Formatear JSON (requiere `jq` instalado) |

```bash
# Ejemplos de combinaciones frecuentes
curl -s URL | jq                                # GET + formato JSON
curl -sI URL                                    # Headers only (silent)
curl -sv URL 2>&1 | grep -E "^[<>]"            # Ver solo request/response headers
curl -X POST -d 'user=admin&pass=admin' URL -L  # POST form + seguir redirect
```

---

## Anatomía HTTP

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

## Headers — Referencia rápida

### Request headers (enviados por el cliente)

| Header | Descripción | Relevancia pentest |
|--------|-------------|-------------------|
| `Host` | Dominio objetivo | Vhost fuzzing |
| `User-Agent` | ID del cliente | Fingerprinting, bypass de filtros |
| `Referer` | Página anterior | A veces requerido para CSRF |
| `Cookie` | Cookies de sesión | Session hijacking |
| `Authorization` | Credenciales (Basic/Bearer/JWT) | Auth bypass |
| `Content-Type` | Tipo de body (JSON/form) | Requerido para POST con JSON |
| `X-Forwarded-For` | IP real tras proxy | Bypass de IP restrictions |

### Response headers (clave para pentest)

| Header | Descripción | Relevancia pentest |
|--------|-------------|-------------------|
| `Set-Cookie` | Define cookie + flags | HTTPOnly, Secure, SameSite |
| `WWW-Authenticate` | Tipo de auth requerida | Indica Basic Auth |
| `Server` | Tecnología del servidor | Fingerprinting, vulns de versión |
| `X-Powered-By` | Framework/lenguaje | Fingerprinting |
| `Content-Security-Policy` | Política de recursos | Debilidades → XSS bypass |
| `Strict-Transport-Security` | HTTPS forzado | Ausencia → downgrade attack |
| `Access-Control-Allow-Origin` | CORS policy | Misconfiguration → data theft |

```bash
# Ver todos los headers de respuesta
curl -sI http://TARGET/ | grep -iE "server|x-powered|set-cookie|csp|cors|hsts"
```

---

## Autenticación

### HTTP Basic Auth

```bash
# Opción 1 — flag -u
curl -u admin:admin http://TARGET/

# Opción 2 — URL directa
curl http://admin:admin@TARGET/

# Opción 3 — header manual (base64 de "user:pass")
echo -n 'admin:admin' | base64          # → YWRtaW46YWRtaW4=
curl -H 'Authorization: Basic YWRtaW46YWRtaW4=' http://TARGET/
```

> **Tip:** `WWW-Authenticate: Basic realm="..."` en la respuesta confirma que es Basic Auth. Intentar bypass con header directo.

### Cookie Auth (sesión PHP)

```bash
# 1. Login → capturar cookie
curl -X POST -d 'username=admin&password=admin' http://TARGET/ -i
# Buscar en respuesta: Set-Cookie: PHPSESSID=VALUE

# 2. Usar cookie capturada
curl -b 'PHPSESSID=c1nsa6op7vtk7kdis7bcnbadf1' http://TARGET/

# 3. Especificar como header
curl -H 'Cookie: PHPSESSID=c1nsa6op7vtk7kdis7bcnbadf1' http://TARGET/

# 4. Guardar/reutilizar cookie automáticamente
curl -c cookies.txt -X POST -d 'username=admin&password=admin' http://TARGET/
curl -b cookies.txt http://TARGET/protected
```

### JWT / Bearer

```bash
curl -H 'Authorization: Bearer eyJhbGci...' http://TARGET/api/data
```

---

## Métodos HTTP — Referencia

| Método | CRUD | Descripción | Riesgo si sin control |
|--------|------|-------------|----------------------|
| `GET` | Read | Parámetros en URL, logeado en servidor | Datos en logs |
| `POST` | Create | Body oculto, acepta binario, sin límite | Formularios, logins |
| `PUT` | Update | Modifica/crea recurso entero | Upload de archivos maliciosos |
| `PATCH` | Update (parcial) | Modifica campos específicos | Escalada de privilegios |
| `DELETE` | Delete | Elimina recurso | DoS por borrado de archivos críticos |
| `HEAD` | — | Solo headers (sin body) | Verificar existencia sin descargar |
| `OPTIONS` | — | Métodos aceptados por el servidor | Enumeración de capacidades |

```bash
# Ver métodos permitidos
curl -X OPTIONS http://TARGET/ -i
# Buscar: Allow: GET, POST, PUT, DELETE

# Probar método alternativo (403 bypass)
curl -X PUT http://TARGET/admin/config -d ''
curl -X POST http://TARGET/admin -H 'X-HTTP-Method-Override: DELETE'
```

---

## Códigos de estado — Pentest

| Código | Significado | Acción |
|--------|-------------|--------|
| `200 OK` | Éxito | Recurso accesible |
| `301/302` | Redirect | `-L` en cURL; puede revelar paths |
| `400` | Bad Request | Revisar formato del payload |
| `401` | Unauthorized | Basic Auth requerida → probar bypass |
| `403` | Forbidden | Recurso **existe** → probar bypass con métodos/headers |
| `404` | Not Found | No existe (o hidden); comprobar con ffuf |
| `405` | Method Not Allowed | Probar otros verbos HTTP |
| `500` | Internal Server Error | Error de servidor → stack trace posible |
| `502/504` | Gateway Error | Proxy/load balancer detectado |

```bash
# Verificar solo el código de respuesta
curl -s -o /dev/null -w "%{http_code}" http://TARGET/path
```

---

## GET — Parámetros y búsquedas

```bash
# GET con parámetros en URL
curl -s 'http://TARGET/search.php?search=london' -H 'Authorization: Basic YWRtaW46YWRtaW4='

# Copiar request como cURL desde DevTools:
# DevTools → Network → clic derecho en request → Copy → Copy as cURL

# Copiar como Fetch (para consola JS):
# Copy → Copy as Fetch → pegar en Console (Ctrl+Shift+K)
```

---

## POST — Formularios y JSON

```bash
# POST de formulario (application/x-www-form-urlencoded)
curl -X POST -d 'username=admin&password=admin' http://TARGET/login.php

# POST con seguimiento de redirect
curl -X POST -d 'username=admin&password=admin' http://TARGET/login.php -L -i

# POST con JSON
curl -X POST \
  -d '{"search":"london"}' \
  -H 'Content-Type: application/json' \
  -b 'PHPSESSID=abc123' \
  http://TARGET/search.php

# POST con archivo
curl -X POST -F 'file=@shell.php' http://TARGET/upload.php
```

---

## CRUD API — cURL completo

```bash
# READ — GET
curl -s http://TARGET/api.php/city/london | jq
curl -s http://TARGET/api.php/city/ | jq        # todos los registros

# CREATE — POST
curl -X POST http://TARGET/api.php/city/ \
  -d '{"city_name":"TestCity","country_name":"HTB"}' \
  -H 'Content-Type: application/json'

# UPDATE — PUT (especificar entidad en URL)
curl -X PUT http://TARGET/api.php/city/london \
  -d '{"city_name":"NewCity","country_name":"HTB"}' \
  -H 'Content-Type: application/json'

# DELETE
curl -X DELETE http://TARGET/api.php/city/TestCity

# Verificar después de cada operación
curl -s http://TARGET/api.php/city/TestCity | jq
```

---

## DevTools — Flujo de trabajo

```
1. Abrir DevTools → Network (F12 → Network)
2. Trash icon → limpiar historial
3. Realizar acción en la app
4. Clic en la petición → inspeccionar:
   - Headers tab → ver request + response headers
   - Request tab → ver body enviado (Raw para ver raw data)
   - Cookies tab → PHPSESSID, tokens
   - Response tab → cuerpo de respuesta

Shortcuts:
  Ctrl+Shift+E  → Network tab (Firefox)
  Ctrl+Shift+K  → Console tab (Firefox)
  Shift+F9      → Storage tab (para editar cookies)

5. Copy as cURL → pegar en terminal para replicar
6. Copy as Fetch → pegar en Console para replicar con JS
```

---

## Pitfalls / Gotchas

- **Content-Type obligatorio en JSON:** sin `-H 'Content-Type: application/json'`, el servidor puede rechazar el body o interpretarlo como form data.
- **Cookie vs Authorization:** algunas apps usan ambos. Si falla el acceso, probar incluir los dos headers.
- **Base64 de Basic Auth no es cifrado:** `Authorization: Basic YWRtaW46YWRtaW4=` se decodifica trivialmente. No confundir con seguridad.
- **PUT sin autenticar = upload de archivos:** si el servidor acepta PUT sin control, es posible subir una webshell directamente.
- **OPTIONS revela capacidades:** un servidor que devuelve `Allow: PUT, DELETE` es un target prioritario para probar esos métodos.
- **-L en cURL:** sin `-L`, cURL no sigue redirects. Los logins suelen redirigir al dashboard tras autenticarse exitosamente.
- **jq no viene instalado siempre:** alternativa rápida — `python3 -m json.tool` o `python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin), indent=2))"`.
- **Fetch en consola ignora Same-Origin:** ejecutar Fetch desde la consola del sitio objetivo bypasea CORS porque está en el mismo origen.

---

## Cheatsheets relacionados

- [Introduction to Web Applications](/metodologias/fundamentos/introduction-web-applications/) — arquitectura web, tecnologías, vulnerabilidades base
- [Web Fuzzing](/metodologias/recon/web-fuzzing/) — descubrimiento de paths, parámetros y vhosts con ffuf
- [Broken Authentication](/metodologias/web/broken-authentication/) — sesiones, JWT, cookies, MFA bypass
- [API Attacks](/metodologias/web/api-attacks/) — ataques a REST APIs, mass assignment, auth bypass
