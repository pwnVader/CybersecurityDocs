---
title: "JavaScript Deobfuscation"
description: "Análisis, deobfuscación y extracción de secretos en código JavaScript."
sidebar:
  order: 6
  label: "JavaScript Deobfuscation"
---
> Localizar JS en apps web, reconocer técnicas de ofuscación, deobfuscar código y decodificar strings para descubrir endpoints y funcionalidades ocultas.

---


## Localizar JS en la aplicación

```bash
# Ver código fuente HTML completo
Ctrl+U  (en cualquier browser)

# Buscar referencias a JS externo
curl -s http://TARGET/ | grep -i "<script"
# Resultado típico: <script src="secret.js"></script>

# Acceder al JS directamente
curl -s http://TARGET/secret.js

# DevTools → Sources/Debugger
Ctrl+Shift+Z  (Firefox)
F12 → Sources (Chrome)

# Buscar strings interesantes en JS
curl -s http://TARGET/app.js | grep -iE "api|endpoint|url|password|token|key|fetch|XMLHttpRequest"

# Buscar archivos .js en la app
curl -s http://TARGET/ | grep -oE 'src="[^"]+\.js"'
```

---

## Identificar tipo de ofuscación

| Indicador | Tipo | Herramienta |
|-----------|------|-------------|
| Código en una sola línea, legible | **Minificado** | Beautifier |
| `eval(function(p,a,c,k,e,d){...})` | **Packed (packer)** | UnPacker |
| `var _0x1234 = [...]` con hex y base64 | **obfuscator.io** | Herramientas web |
| `[]+(!+[]+[])+(![]+[])...` solo con `[](!+)` | **JSFuck** | JSConsole (eval) |
| `$=~[];$={...}` | **JJEncode/AAEncode** | Herramientas web |
| Strings con `=` al final (`YWRtaW4=`) | **Base64 embebido** | base64 -d |
| Solo caracteres hex en strings (`\x48\x54\x42`) | **Hex encoding** | xxd / python |

### Firma de Packer (más común)

```javascript
// Reconocer packer por la firma de 6 argumentos:
eval(function(p,a,c,k,e,d){ ... }('código',N,N,'palabras'.split('|'),0,{}))
```

---

## Herramientas de deobfuscación

### Browser DevTools (sin instalar nada)

```
Firefox:
  Ctrl+Shift+Z → Debugger → clic en archivo .js → botón { } (Pretty Print)
  
Chrome/Edge:
  F12 → Sources → clic en archivo .js → botón { } (abajo a la izquierda)
```

### Herramientas online

```
Beautify / Format:
  https://beautifier.io/
  https://prettier.io/playground/
  
Deobfuscar packed:
  https://matthewfl.com/unPacker.html    ← mejor para packer
  
Ejecutar JS para verificar:
  https://jsconsole.com                  ← pegar código y ver output
  
Identificar cifrado:
  https://www.boxentriq.com/code-breaking/cipher-identifier
```

### CLI — Análisis básico

```bash
# Prettier desde línea de comandos (requiere npm)
npx prettier --parser babel secret.js

# Node.js — evaluar y ver output de JS packed
node -e "$(curl -s http://TARGET/secret.js)"

# Si el código usa eval() → reemplazar eval por console.log para ver el resultado
# Original: eval(function(p,a,c,k,e,d){...})
# Reemplazar: console.log(function(p,a,c,k,e,d){...})
```

---

## Decodificación de strings

### Base64

```bash
# Identificar: solo caracteres alfa-numéricos + / y = al final
# Ej: ZG8gdGhlIGV4ZXJjaXNlCg==

# Decodificar
echo "ZG8gdGhlIGV4ZXJjaXNlCg==" | base64 -d

# Encodear
echo "do the exercise" | base64

# Python (cross-platform)
python3 -c "import base64; print(base64.b64decode('ZG8gdGhlIGV4ZXJjaXNl').decode())"
python3 -c "import base64; print(base64.b64encode(b'hello').decode())"
```

### Hex

```bash
# Identificar: solo caracteres 0-9 y a-f
# Ej: 68747470733a2f2f7777772e6861636b746865626f782e65752f

# Decodificar
echo "68747470733a2f2f7777772e6861636b746865626f782e65752f" | xxd -p -r

# Encodear
echo "https://www.hackthebox.eu/" | xxd -p

# Python
python3 -c "print(bytes.fromhex('68747470733a2f2f').decode())"
python3 -c "print('hello'.encode().hex())"

# En JS (dentro de código ofuscado)
"\x48\x54\x42"  # → "HTB"
```

### Rot13

```bash
# Identificar: texto legible pero alterado, http → uggc
# Ej: uggcf://jjj.unpxgurobk.rh/

# Decodificar (y encodear — bidireccional)
echo "uggcf://jjj.unpxgurobk.rh/" | tr 'A-Za-z' 'N-ZA-Mn-za-m'
# → https://www.hackthebox.eu/

# Encodear texto en rot13
echo "https://www.hackthebox.eu/" | tr 'A-Za-z' 'N-ZA-Mn-za-m'
```

### URL encoding

```bash
# Decodificar URL encoding
python3 -c "import urllib.parse; print(urllib.parse.unquote('%48%54%42%7B%74%65%73%74%7D'))"

# Encodear
python3 -c "import urllib.parse; print(urllib.parse.quote('HTB{test}'))"
```

---

## Análisis de código JS — Patrón

```javascript
// Código deobfuscado típico que hace HTTP requests:
function generateSerial() {
  var xhr = new XMLHttpRequest;       // objeto de petición HTTP
  var url = "/serial.php";            // endpoint → ANOTAR
  xhr.open("POST", url, true);        // método HTTP + endpoint
  xhr.send(null);                     // body de la petición (null = vacío)
}

// Versión moderna con fetch():
fetch("/api/endpoint", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({param: "value"})
})
.then(r => r.json())
.then(data => console.log(data));
```

### Qué buscar en el código JS

```javascript
// Endpoints y rutas
XMLHttpRequest       // peticiones HTTP antiguas
fetch(              // peticiones HTTP modernas
$.ajax(             // jQuery AJAX
axios.get/post(     // Axios HTTP client

// Variables interesantes
var url = "..."     // endpoints API
var key = "..."     // API keys en cleartext
var token = "..."   // tokens
var password = "..."// credenciales hardcoded

// Funciones con datos sensibles
btoa()              // encode base64
atob()              // decode base64
unescape()          // decode URL
decodeURIComponent()// decode URL
String.fromCharCode()// caracteres por código ASCII
```

---

## Replicar funcionalidad JS con cURL

```bash
# JS hace: xhr.open("POST", "/serial.php", true); xhr.send(null);
curl -s http://TARGET/serial.php -X POST

# JS hace: fetch("/api/data", {method:"POST", body: JSON.stringify({id:1})})
curl -s http://TARGET/api/data \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"id":1}'

# JS hace: fetch con cookie de sesión
curl -s http://TARGET/api/data \
     -b 'PHPSESSID=abc123' \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{}'

# JS hace: XMLHttpRequest con Authorization header
curl -s http://TARGET/api/data \
     -H "Authorization: Bearer TOKEN_DEL_JS"
```

---

## Pitfalls / Gotchas

- **Ctrl+U antes que DevTools:** ver código fuente completo (Ctrl+U) primero para no perderse scripts referenciados que no aparecen en DevTools si no se cargaron.
- **eval() → console.log():** para deobfuscar packer sin herramientas online, cambiar `eval(` por `console.log(` en la línea packed. El resultado en JSConsole muestra el código desempaquetado.
- **Sin línea vacía antes del packer:** UnPacker falla si hay línea vacía antes del `eval(`. Borrar líneas vacías al principio antes de pegar.
- **base64 sin padding:** si el base64 no tiene `=` al final, puede tener padding faltante. Añadir `==` y probar.
- **Hex con `\x` prefix en JS:** `\x48\x54\x42` es hex encoding dentro de JS. Convertir a string: `python3 -c "print('\x48\x54\x42')"`.
- **Endpoints en JS minificado:** aunque el código sea ilegible, buscar con `grep` strings entre comillas — las URLs raramente se ofuscan completamente.
- **obfuscator.io con Base64:** el código resultante tiene `var _0x...` con arrays de strings en base64. Leer esas strings directamente a veces revela endpoints antes de deobfuscar el resto.
- **JSFuck es lento:** código con solo `[](!+)` puede tardar minutos en ejecutar. Usar JSConsole con paciencia o buscar alternativas online.

---

## Cheatsheets relacionados

- [Web Requests](/metodologias/fundamentos/web-requests/) — replicar peticiones HTTP descubiertas en el JS
- [Web Fuzzing](/metodologias/recon/web-fuzzing/) — fuzzear endpoints descubiertos en el bundle JS
- [API Attacks](/metodologias/web/api-attacks/) — explotar APIs descubiertas por análisis JS
- [Server-side Attacks](/metodologias/web/server-side-attacks/) — SSRF/SSTI a partir de endpoints JS
