---
title: "Web Fuzzing · ffuf"
description: "Fuzzing de directorios, parámetros, subdominios y vhosts con bypass de WAF."
sidebar:
  order: 4
  label: "Web Fuzzing · ffuf"
---
> Descubrimiento automatizado de directorios, archivos, parámetros, vhosts, subdominios y endpoints de API con ffuf, gobuster, wenum y feroxbuster.

---


## Wordlists — SecLists

```
/usr/share/seclists/                              (Pwnbox: /usr/share/seclists/)

Discovery/Web-Content/common.txt                  ← uso general (4730 palabras)
Discovery/Web-Content/directory-list-2.3-medium.txt ← directorios (220k palabras)
Discovery/Web-Content/raft-large-directories.txt  ← directorios masivo
Discovery/Web-Content/big.txt                     ← dirs + files completo
Discovery/DNS/subdomains-top1million-5000.txt      ← subdominios top 5000
Discovery/DNS/subdomains-top1million-20000.txt     ← subdominios top 20000
```

---

## ffuf — Fuzzing principal

### Directorios

```bash
# Básico
ffuf -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt \
     -u http://TARGET/FUZZ

# Ignorar comentarios de wordlist (-ic)
ffuf -w wordlist.txt -ic -u http://TARGET/FUZZ
```

### Archivos con extensiones

```bash
# Buscar archivos con extensiones específicas en un directorio
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt \
     -u http://TARGET/admin/FUZZ \
     -e .php,.html,.txt,.bak,.js,.zip,.sql \
     -v

# Extensiones clave para buscar siempre:
# .php .html .txt .bak .js .zip .sql .conf .log .xml .json .env
```

### Fuzzing recursivo

```bash
# Recursivo completo (cuidado con el número de requests)
ffuf -w wordlist.txt -ic -v -u http://TARGET/FUZZ -e .html -recursion

# Con límite de profundidad y rate control (recomendado)
ffuf -w wordlist.txt -ic -u http://TARGET/FUZZ -e .html \
     -recursion -recursion-depth 2 -rate 500
```

### Parámetros POST

```bash
# Fuzz de valor de parámetro POST (form-urlencoded)
ffuf -u http://TARGET/post.php \
     -X POST \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "parametro=FUZZ" \
     -w /usr/share/seclists/Discovery/Web-Content/common.txt \
     -mc 200 -v

# POST con JSON
ffuf -u http://TARGET/api/endpoint \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"param":"FUZZ"}' \
     -w wordlist.txt \
     -mc 200
```

### vhosts con ffuf

```bash
# Fuzz de virtual hosts (filtrar por tamaño de respuesta base)
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt:FUZZ \
     -u http://TARGET/ \
     -H 'Host: FUZZ.domain.htb' \
     -fs BASE_SIZE      # reemplazar BASE_SIZE con el tamaño de respuesta por defecto
```

---

## ffuf — Filtros y matchers

| Flag | Tipo | Descripción | Ejemplo |
|------|------|-------------|---------|
| `-mc` | Match | Solo códigos de estado indicados | `-mc 200,301` |
| `-fc` | Filter | Excluir códigos de estado | `-fc 404,400,302` |
| `-fs` | Filter | Excluir por tamaño (bytes) | `-fs 0` o `-fs 100-200` |
| `-ms` | Match | Solo respuestas de ese tamaño | `-ms 3456` |
| `-fw` | Filter | Excluir por nº de palabras | `-fw 219` |
| `-mw` | Match | Solo respuestas con ese nº de palabras | `-mw 5-10` |
| `-fl` | Filter | Excluir por nº de líneas | `-fl 10` |
| `-ml` | Match | Solo respuestas con ese nº de líneas | `-ml 20` |
| `-mt` | Match | Solo respuestas con TTFB que cumpla condición | `-mt >500` |
| `-mc all` | Match | Mostrar TODAS las respuestas (incluyendo 404) | — |

```bash
# Combinaciones útiles
ffuf -u http://TARGET/FUZZ -w wordlist.txt -mc 200 -fw 427 -ms ">500"
ffuf -u http://TARGET/FUZZ -w wordlist.txt -fc 404,401,302
ffuf -u http://TARGET/FUZZ.bak -w wordlist.txt -fs 0 -ms "10240-102400"
```

---

## gobuster — vhosts y subdominios

### vHost fuzzing

```bash
# Añadir dominio a /etc/hosts primero
echo "TARGET_IP domain.htb" | sudo tee -a /etc/hosts

# gobuster vhost (--append-domain: añade dominio base a cada palabra)
gobuster vhost \
  -u http://domain.htb:PORT \
  -w /usr/share/seclists/Discovery/Web-Content/common.txt \
  --append-domain

# Resultados: buscar Status 200 → vhosts válidos
# Status 400 → probablemente entradas inválidas del wordlist (ignorar)
```

### DNS/Subdomain fuzzing

```bash
# DNS subdomain fuzzing
gobuster dns \
  -d inlanefreight.com \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt

# Nota versión reciente: usar --domain en lugar de -d
gobuster dns --domain inlanefreight.com -w subdomains-wordlist.txt
```

### Directory fuzzing con gobuster

```bash
# gobuster dir
gobuster dir -u http://TARGET/ -w wordlist.txt -s 200,301 --exclude-length 0

# Con extensiones
gobuster dir -u http://TARGET/ -w wordlist.txt -x php,html,txt,bak
```

### Filtros de gobuster (solo modo dir)

| Flag | Descripción |
|------|-------------|
| `-s` | Incluir solo estos códigos (allowlist) |
| `-b` | Excluir estos códigos (denylist) |
| `--exclude-length` | Excluir por tamaño de contenido |

---

## wenum — Fuzzing de parámetros

```bash
# Instalación
pipx install git+https://github.com/WebFuzzForge/wenum
pipx runpip wenum install setuptools

# GET parameter fuzzing
wenum -w /usr/share/seclists/Discovery/Web-Content/common.txt \
      --hc 404 \
      -u "http://TARGET/get.php?x=FUZZ"

# POST parameter fuzzing
wenum -w wordlist.txt --hc 404 \
      -u http://TARGET/post.php \
      -d "param=FUZZ"

# Combinaciones de filtros
wenum -w wordlist.txt --sc 200,301,302 -u http://TARGET/FUZZ           # solo éxitos
wenum -w wordlist.txt --hc 404,400,500 -u http://TARGET/FUZZ           # ocultar errores
wenum -w wordlist.txt --sr "admin\|password" -u http://TARGET/FUZZ     # regex en body
wenum -w wordlist.txt --hs 10000 -u http://TARGET/FUZZ                 # ocultar >10KB
```

### Filtros de wenum

| Flag | Tipo | Descripción |
|------|------|-------------|
| `--hc` | Filter | Ocultar por código de estado |
| `--sc` | Match | Mostrar solo estos códigos |
| `--hl` | Filter | Ocultar por nº de líneas |
| `--sl` | Match | Mostrar por nº de líneas |
| `--hw` | Filter | Ocultar por nº de palabras |
| `--sw` | Match | Mostrar por nº de palabras |
| `--hs` | Filter | Ocultar por tamaño (bytes) |
| `--ss` | Match | Mostrar por tamaño |
| `--hr` | Filter | Ocultar si body coincide con regex |
| `--sr` | Match | Mostrar si body coincide con regex |

---

## feroxbuster — Descubrimiento recursivo

```bash
# Instalación
curl -sL https://raw.githubusercontent.com/epi052/feroxbuster/main/install-nix.sh | \
  sudo bash -s $HOME/.local/bin

# Escaneo recursivo básico
feroxbuster --url http://TARGET -w wordlist.txt

# Con filtros
feroxbuster --url http://TARGET -w wordlist.txt -s 200 -S 10240 -X "error"
```

### Filtros de feroxbuster

| Flag | Descripción |
|------|-------------|
| `-s`/`--status-codes` | Incluir solo estos códigos (allowlist) |
| `-C`/`--filter-status` | Excluir estos códigos (denylist) |
| `-S`/`--filter-size` | Excluir por tamaño (bytes) |
| `-X`/`--filter-regex` | Excluir si body/headers coinciden con regex |
| `-W`/`--filter-words` | Excluir por nº de palabras |
| `-N`/`--filter-lines` | Excluir por nº de líneas |
| `--dont-scan` | Excluir URLs específicas del escaneo |
| `--filter-similar-to` | Excluir respuestas similares a una página de referencia |

---

## API Fuzzing

### Descubrir endpoints REST

```bash
# 1. Leer documentación: /docs, /swagger, /api-docs, /openapi.json
curl -s http://TARGET/docs | jq
curl -s http://TARGET/openapi.json | jq

# 2. Fuzzing de endpoints con ffuf
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt \
     -u http://TARGET/FUZZ \
     -mc 200,201,204,301,302,405

# 3. Verificar 405 (Method Not Allowed) → endpoint existe, método incorrecto
curl -X POST http://TARGET/items -H 'Content-Type: application/json' -d '{}'

# 4. Fuzz de path parameters (IDs)
ffuf -w /usr/share/seclists/Fuzzing/Integers/Integers-Medium.txt \
     -u http://TARGET/api/users/FUZZ \
     -mc 200
```

### Operaciones CRUD con API

```bash
# READ
curl -s http://TARGET/api/items/ | jq
curl -s http://TARGET/api/items/1 | jq

# CREATE
curl -X POST http://TARGET/api/items/ \
     -H 'Content-Type: application/json' \
     -d '{"name":"test","value":"123"}'

# UPDATE
curl -X PUT http://TARGET/api/items/1 \
     -H 'Content-Type: application/json' \
     -d '{"name":"updated"}'

# DELETE
curl -X DELETE http://TARGET/api/items/1
```

### GraphQL — Introspección

```bash
# Introspección (descubrir schema completo)
curl -X POST http://TARGET/graphql \
     -H 'Content-Type: application/json' \
     -d '{"query":"{ __schema { types { name } } }"}'

# Listar queries y mutations disponibles
curl -X POST http://TARGET/graphql \
     -H 'Content-Type: application/json' \
     -d '{"query":"{ __schema { queryType { fields { name } } mutationType { fields { name } } } }"}'
```

---

## Validación de hallazgos

```bash
# 1. Confirmar que el directorio existe y lista contenido
curl http://TARGET/backup/

# 2. Verificar solo headers (sin descargar contenido)
curl -I http://TARGET/backup/dump.sql
# Buscar: Content-Length > 0 (confirma que el archivo tiene contenido)
# Content-Type: application/sql, text/plain, etc.

# 3. Confirmar parámetro válido sin explotar
curl "http://TARGET/page?id=VALOR_ENCONTRADO"

# 4. Directory listing habilitado → listar contenido
# La respuesta HTML incluirá <h2>Index of /backup/</h2>
```

---

## Flujo completo de reconocimiento web

```bash
# PASO 1: Directorios base
ffuf -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt \
     -ic -u http://TARGET/FUZZ -mc 200,301,302,401,403

# PASO 2: Para cada directorio interesante → buscar archivos
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt \
     -u http://TARGET/DIRECTORIO/FUZZ \
     -e .php,.bak,.txt,.html,.js,.sql,.env,.zip

# PASO 3: vhosts (si hay un dominio configurado en /etc/hosts)
gobuster vhost -u http://DOMAIN:PORT \
     -w /usr/share/seclists/Discovery/Web-Content/common.txt \
     --append-domain

# PASO 4: Parámetros GET
wenum -w /usr/share/seclists/Discovery/Web-Content/common.txt \
      --hc 404 -u "http://TARGET/page?FUZZ=test"

# PASO 5: Validar hallazgos con curl
curl -I http://TARGET/HALLAZGO
```

---

## Pitfalls / Gotchas

- **Base size para vhosts:** antes de fuzzear vhosts con ffuf, hacer un request sin Host personalizado para obtener el `Size` base. Usar `-fs BASE_SIZE` para filtrar respuestas genéricas.
- **-ic es obligatorio con directory-list-2.3-medium.txt:** ese wordlist tiene comentarios al inicio. Sin `-ic`, ffuf intenta fuzzear las líneas de comentario.
- **gobuster --append-domain vs sin él:** sin `--append-domain`, el Host header quedará solo con la palabra del wordlist (ej. `admin`), no con `admin.domain.htb`. Casi siempre necesario.
- **405 Method Not Allowed = endpoint válido:** un 405 confirma que el endpoint existe. Probar con todos los métodos HTTP.
- **Feroxbuster para recursivo, ffuf para todo lo demás:** feroxbuster es más eficiente en escaneos profundamente recursivos; ffuf es más flexible para fuzzing personalizado.
- **Rate limit antes de fuzzing agresivo:** `-rate 100` evita ser bloqueado por WAFs o sobrecargar el servidor.
- **-recursion-depth 2 en CTF/examen:** más profundidad = exponencialmente más requests. Empezar con 2 y ampliar si necesario.
- **wenum vs wfuzz:** wenum es el fork activo; los comandos son intercambiables. En Kali puede estar preinstalado wfuzz; usar el que esté disponible.
- **Validar antes de reportar:** un 200 en fuzzing no siempre significa vulnerabilidad. Confirmar manualmente con curl.

---

## Cheatsheets relacionados

- [Web Requests](/metodologias/fundamentos/web-requests/) — HTTP, cURL, métodos, cabeceras
- [JavaScript Deobfuscation](/metodologias/recon/javascript-deobfuscation/) — encontrar endpoints en bundles JS
- [API Attacks](/metodologias/web/api-attacks/) — explotar los endpoints descubiertos
- [Attacking GraphQL](/metodologias/web/attacking-graphql/) — intrusión en GraphQL tras descubrir el endpoint
- [Broken Authentication](/metodologias/web/broken-authentication/) — fuzz de credenciales y parámetros de auth
