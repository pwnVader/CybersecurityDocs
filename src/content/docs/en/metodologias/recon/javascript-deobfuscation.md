---
title: "JavaScript Deobfuscation"
description: "Analysis, deobfuscation, and secrets extraction in JavaScript code."
sidebar:
  order: 6
  label: "JavaScript Deobfuscation"
---
> Locate JS in web applications, recognize obfuscation techniques, deobfuscate code, and decode strings to discover endpoints and hidden functionalities.

---


## Locating JS in the Application

```bash
# View complete HTML source code
Ctrl+U  (in any browser)

# Search for references to external JS
curl -s http://TARGET/ | grep -i "<script"
# Typical result: <script src="secret.js"></script>

# Access JS directly
curl -s http://TARGET/secret.js

# DevTools → Sources/Debugger
Ctrl+Shift+Z  (Firefox)
F12 → Sources (Chrome)

# Search for interesting strings in JS
curl -s http://TARGET/app.js | grep -iE "api|endpoint|url|password|token|key|fetch|XMLHttpRequest"

# Search for .js files in the app
curl -s http://TARGET/ | grep -oE 'src="[^"]+\.js"'
```

---

## Identifying the Obfuscation Type

| Indicator | Type | Tool |
|-----------|------|-------------|
| Code on a single line, readable | **Minified** | Beautifier |
| `eval(function(p,a,c,k,e,d){...})` | **Packed (packer)** | UnPacker |
| `var _0x1234 = [...]` with hex and base64 | **obfuscator.io** | Web tools |
| `[]+(!+[]+[])+(![]+[])...` only with `[](!+)` | **JSFuck** | JSConsole (eval) |
| `$=~[];$={...}` | **JJEncode/AAEncode** | Web tools |
| Strings with `=` at the end (`YWRtaW4=`) | **Embedded Base64** | `base64 -d` |
| Only hex characters in strings (`\x48\x54\x42`) | **Hex encoding** | `xxd` / `python` |

### Packer Signature (Most Common)

```javascript
// Recognize packer by the signature of 6 arguments:
eval(function(p,a,c,k,e,d){ ... }('code',N,N,'words'.split('|'),0,{}))
```

---

## Deobfuscation Tools

### Browser DevTools (No Installation Required)

```
Firefox:
  Ctrl+Shift+Z → Debugger → click on .js file → { } button (Pretty Print)
  
Chrome/Edge:
  F12 → Sources → click on .js file → { } button (bottom-left)
```

### Online Tools

```
Beautify / Format:
  https://beautifier.io/
  https://prettier.io/playground/
  
Deobfuscate packed:
  https://matthewfl.com/unPacker.html    ← best for packer
  
Run JS to verify:
  https://jsconsole.com                  ← paste code and view output
  
Identify encryption:
  https://www.boxentriq.com/code-breaking/cipher-identifier
```

### CLI — Basic Analysis

```bash
# Prettier from the command line (requires npm)
npx prettier --parser babel secret.js

# Node.js — evaluate and view output of packed JS
node -e "$(curl -s http://TARGET/secret.js)"

# If the code uses eval() → replace eval with console.log to view the result
# Original: eval(function(p,a,c,k,e,d){...})
# Replace: console.log(function(p,a,c,k,e,d){...})
```

---

## String Decoding

### Base64

```bash
# Identify: only alphanumeric characters + / and = at the end
# E.g.: ZG8gdGhlIGV4ZXJjaXNlCg==

# Decode
echo "ZG8gdGhlIGV4ZXJjaXNlCg==" | base64 -d

# Encode
echo "do the exercise" | base64

# Python (cross-platform)
python3 -c "import base64; print(base64.b64decode('ZG8gdGhlIGV4ZXJjaXNl').decode())"
python3 -c "import base64; print(base64.b64encode(b'hello').decode())"
```

### Hex

```bash
# Identify: only 0-9 and a-f characters
# E.g.: 68747470733a2f2f7777772e6861636b746865626f782e65752f

# Decode
echo "68747470733a2f2f7777772e6861636b746865626f782e65752f" | xxd -p -r

# Encode
echo "https://www.hackthebox.eu/" | xxd -p

# Python
python3 -c "print(bytes.fromhex('68747470733a2f2f').decode())"
python3 -c "print('hello'.encode().hex())"

# In JS (inside obfuscated code)
"\x48\x54\x42"  # → "HTB"
```

### Rot13

```bash
# Identify: readable but altered text, http → uggc
# E.g.: uggcf://jjj.unpxgurobk.rh/

# Decode (and encode — bidirectional)
echo "uggcf://jjj.unpxgurobk.rh/" | tr 'A-Za-z' 'N-ZA-Mn-za-m'
# → https://www.hackthebox.eu/

# Encode text in rot13
echo "https://www.hackthebox.eu/" | tr 'A-Za-z' 'N-ZA-Mn-za-m'
```

### URL Encoding

```bash
# Decode URL encoding
python3 -c "import urllib.parse; print(urllib.parse.unquote('%48%54%42%7B%74%65%73%74%7D'))"

# Encode
python3 -c "import urllib.parse; print(urllib.parse.quote('HTB{test}'))"
```

---

## Analyzing JS Code — Patterns

```javascript
// Typical deobfuscated code that makes HTTP requests:
function generateSerial() {
  var xhr = new XMLHttpRequest;       // HTTP request object
  var url = "/serial.php";            // endpoint → NOTE DOWN
  xhr.open("POST", url, true);        // HTTP method + endpoint
  xhr.send(null);                     // request body (null = empty)
}

// Modern version with fetch():
fetch("/api/endpoint", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({param: "value"})
})
.then(r => r.json())
.then(data => console.log(data));
```

### What to Look for in JS Code

```javascript
// Endpoints and routes
XMLHttpRequest       // old HTTP requests
fetch(              // modern HTTP requests
$.ajax(             // jQuery AJAX
axios.get/post(     // Axios HTTP client

// Interesting variables
var url = "..."     // API endpoints
var key = "..."     // API keys in cleartext
var token = "..."   // tokens
var password = "..."// hardcoded credentials

// Functions with sensitive data
btoa()              // encode base64
atob()              // decode base64
unescape()          // decode URL
decodeURIComponent()// decode URL
String.fromCharCode()// characters by ASCII code
```

---

## Replicating JS Functionality with cURL

```bash
# JS does: xhr.open("POST", "/serial.php", true); xhr.send(null);
curl -s http://TARGET/serial.php -X POST

# JS does: fetch("/api/data", {method:"POST", body: JSON.stringify({id:1})})
curl -s http://TARGET/api/data \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"id":1}'

# JS does: fetch with session cookie
curl -s http://TARGET/api/data \
     -b 'PHPSESSID=abc123' \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{}'

# JS does: XMLHttpRequest with Authorization header
curl -s http://TARGET/api/data \
     -H "Authorization: Bearer JS_TOKEN"
```

---

## Pitfalls / Gotchas

- **Ctrl+U before DevTools:** view complete source code (Ctrl+U) first to not miss referenced scripts that do not appear in DevTools if they were not loaded.
- **eval() → console.log():** to deobfuscate packed code without online tools, replace `eval(` with `console.log(` in the packed line. The result in JSConsole will display the unpacked code.
- **No empty line before packer:** UnPacker fails if there is an empty line before `eval(`. Delete empty lines at the beginning before pasting.
- **base64 without padding:** if the base64 lacks `=` at the end, it might have missing padding. Add `==` and try again.
- **Hex with `\x` prefix in JS:** `\x48\x54\x42` is hex encoding inside JS. Convert to string: `python3 -c "print('\x48\x54\x42')"`.
- **Endpoints in minified JS:** although the code might be unreadable, search for quoted strings using `grep` — URLs are rarely obfuscated completely.
- **obfuscator.io with Base64:** the resulting code has `var _0x...` with arrays of base64 strings. Reading these strings directly sometimes reveals endpoints before deobfuscating the rest.
- **JSFuck is slow:** code containing only `[](!+)` can take minutes to execute. Use JSConsole patiently or look for online alternatives.

---

## Related Cheatsheets

- [Web Requests](/en/metodologias/fundamentos/web-requests/) — replicate HTTP requests discovered in the JS
- [Web Fuzzing](/en/metodologias/recon/web-fuzzing/) — fuzz endpoints discovered in the JS bundle
- [API Attacks](/en/metodologias/web/api-attacks/) — exploit APIs discovered through JS analysis
- [Server-side Attacks](/en/metodologias/web/server-side-attacks/) — SSRF/SSTI starting from JS endpoints
