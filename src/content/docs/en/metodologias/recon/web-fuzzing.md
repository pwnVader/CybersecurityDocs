---
title: "Web Fuzzing · ffuf"
description: "Directory, parameter, subdomain, and vhost fuzzing with WAF bypass."
sidebar:
  order: 4
  label: "Web Fuzzing · ffuf"
---
> Automated discovery of directories, files, parameters, vhosts, subdomains, and API endpoints with ffuf, gobuster, wenum, and feroxbuster.

---


## Wordlists — SecLists

```
/usr/share/seclists/                              (Pwnbox: /usr/share/seclists/)

Discovery/Web-Content/common.txt                  ← general use (4,730 words)
Discovery/Web-Content/directory-list-2.3-medium.txt ← directories (220k words)
Discovery/Web-Content/raft-large-directories.txt  ← massive directories
Discovery/Web-Content/big.txt                     ← comprehensive dirs + files
Discovery/DNS/subdomains-top1million-5000.txt      ← top 5,000 subdomains
Discovery/DNS/subdomains-top1million-20000.txt     ← top 20,000 subdomains
```

---

## ffuf — Primary Fuzzing

### Directories

```bash
# Basic
ffuf -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt \
     -u http://TARGET/FUZZ

# Ignore wordlist comments (-ic)
ffuf -w wordlist.txt -ic -u http://TARGET/FUZZ
```

### Files with Extensions

```bash
# Search for files with specific extensions in a directory
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt \
     -u http://TARGET/admin/FUZZ \
     -e .php,.html,.txt,.bak,.js,.zip,.sql \
     -v

# Key extensions to always search for:
# .php .html .txt .bak .js .zip .sql .conf .log .xml .json .env
```

### Recursive Fuzzing

```bash
# Full recursive scan (be careful with the number of requests)
ffuf -w wordlist.txt -ic -v -u http://TARGET/FUZZ -e .html -recursion

# With depth limit and rate control (recommended)
ffuf -w wordlist.txt -ic -u http://TARGET/FUZZ -e .html \
     -recursion -recursion-depth 2 -rate 500
```

### POST Parameters

```bash
# Fuzz POST parameter value (form-urlencoded)
ffuf -u http://TARGET/post.php \
     -X POST \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "parameter=FUZZ" \
     -w /usr/share/seclists/Discovery/Web-Content/common.txt \
     -mc 200 -v

# POST with JSON
ffuf -u http://TARGET/api/endpoint \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"param":"FUZZ"}' \
     -w wordlist.txt \
     -mc 200
```

### vhosts with ffuf

```bash
# Fuzz virtual hosts (filter by base response size)
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt:FUZZ \
     -u http://TARGET/ \
     -H 'Host: FUZZ.domain.htb' \
     -fs BASE_SIZE      # replace BASE_SIZE with the default response size
```

---

## ffuf — Filters and Matchers

| Flag | Type | Description | Example |
|------|------|-------------|---------|
| `-mc` | Match | Only indicated status codes | `-mc 200,301` |
| `-fc` | Filter | Exclude status codes | `-fc 404,400,302` |
| `-fs` | Filter | Exclude by size (bytes) | `-fs 0` or `-fs 100-200` |
| `-ms` | Match | Only responses of that size | `-ms 3456` |
| `-fw` | Filter | Exclude by word count | `-fw 219` |
| `-mw` | Match | Only responses with that word count | `-mw 5-10` |
| `-fl` | Filter | Exclude by line count | `-fl 10` |
| `-ml` | Match | Only responses with that line count | `-ml 20` |
| `-mt` | Match | Only responses with TTFB meeting condition | `-mt >500` |
| `-mc all` | Match | Show ALL responses (including 404) | — |

```bash
# Useful combinations
ffuf -u http://TARGET/FUZZ -w wordlist.txt -mc 200 -fw 427 -ms ">500"
ffuf -u http://TARGET/FUZZ -w wordlist.txt -fc 404,401,302
ffuf -u http://TARGET/FUZZ.bak -w wordlist.txt -fs 0 -ms "10240-102400"
```

---

## gobuster — vhosts and subdomains

### vHost Fuzzing

```bash
# Add domain to /etc/hosts first
echo "TARGET_IP domain.htb" | sudo tee -a /etc/hosts

# gobuster vhost (--append-domain: appends base domain to each word)
gobuster vhost \
  -u http://domain.htb:PORT \
  -w /usr/share/seclists/Discovery/Web-Content/common.txt \
  --append-domain

# Results: look for Status 200 → valid vhosts
# Status 400 → probably invalid wordlist entries (ignore)
```

### DNS/Subdomain Fuzzing

```bash
# DNS subdomain fuzzing
gobuster dns \
  -d inlanefreight.com \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt

# Recent version note: use --domain instead of -d
gobuster dns --domain inlanefreight.com -w subdomains-wordlist.txt
```

### Directory Fuzzing with gobuster

```bash
# gobuster dir
gobuster dir -u http://TARGET/ -w wordlist.txt -s 200,301 --exclude-length 0

# With extensions
gobuster dir -u http://TARGET/ -w wordlist.txt -x php,html,txt,bak
```

### gobuster Filters (dir Mode Only)

| Flag | Description |
|------|-------------|
| `-s` | Include only these codes (allowlist) |
| `-b` | Exclude these codes (denylist) |
| `--exclude-length` | Exclude by content length |

---

## wenum — Parameter Fuzzing

```bash
# Installation
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

# Filter combinations
wenum -w wordlist.txt --sc 200,301,302 -u http://TARGET/FUZZ           # success only
wenum -w wordlist.txt --hc 404,400,500 -u http://TARGET/FUZZ           # hide errors
wenum -w wordlist.txt --sr "admin\|password" -u http://TARGET/FUZZ     # regex in body
wenum -w wordlist.txt --hs 10000 -u http://TARGET/FUZZ                 # hide >10KB
```

### wenum Filters

| Flag | Type | Description |
|------|------|-------------|
| `--hc` | Filter | Hide by status code |
| `--sc` | Match | Show only these codes |
| `--hl` | Filter | Hide by line count |
| `--sl` | Match | Show by line count |
| `--hw` | Filter | Hide by word count |
| `--sw` | Match | Show by word count |
| `--hs` | Filter | Hide by size (bytes) |
| `--ss` | Match | Show by size |
| `--hr` | Filter | Hide if body matches regex |
| `--sr` | Match | Show if body matches regex |

---

## feroxbuster — Recursive Discovery

```bash
# Installation
curl -sL https://raw.githubusercontent.com/epi052/feroxbuster/main/install-nix.sh | \
  sudo bash -s $HOME/.local/bin

# Basic recursive scan
feroxbuster --url http://TARGET -w wordlist.txt

# With filters
feroxbuster --url http://TARGET -w wordlist.txt -s 200 -S 10240 -X "error"
```

### feroxbuster Filters

| Flag | Description |
|------|-------------|
| `-s`/`--status-codes` | Include only these codes (allowlist) |
| `-C`/`--filter-status` | Exclude these codes (denylist) |
| `-S`/`--filter-size` | Exclude by size (bytes) |
| `-X`/`--filter-regex` | Exclude if body/headers match regex |
| `-W`/`--filter-words` | Exclude by word count |
| `-N`/`--filter-lines` | Exclude by line count |
| `--dont-scan` | Exclude specific URLs from scan |
| `--filter-similar-to` | Exclude responses similar to a reference page |

---

## API Fuzzing

### Discovering REST Endpoints

```bash
# 1. Read documentation: /docs, /swagger, /api-docs, /openapi.json
curl -s http://TARGET/docs | jq
curl -s http://TARGET/openapi.json | jq

# 2. Fuzzing endpoints with ffuf
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt \
     -u http://TARGET/FUZZ \
     -mc 200,201,204,301,302,405

# 3. Verify 405 (Method Not Allowed) → endpoint exists, incorrect method
curl -X POST http://TARGET/items -H 'Content-Type: application/json' -d '{}'

# 4. Fuzz path parameters (IDs)
ffuf -w /usr/share/seclists/Fuzzing/Integers/Integers-Medium.txt \
     -u http://TARGET/api/users/FUZZ \
     -mc 200
```

### CRUD Operations with APIs

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

### GraphQL — Introspection

```bash
# Introspection (discover complete schema)
curl -X POST http://TARGET/graphql \
     -H 'Content-Type: application/json' \
     -d '{"query":"{ __schema { types { name } } }"}'

# List available queries and mutations
curl -X POST http://TARGET/graphql \
     -H 'Content-Type: application/json' \
     -d '{"query":"{ __schema { queryType { fields { name } } mutationType { fields { name } } } }"}'
```

---

## Validating Findings

```bash
# 1. Confirm that the directory exists and lists content
curl http://TARGET/backup/

# 2. Verify headers only (without downloading content)
curl -I http://TARGET/backup/dump.sql
# Look for: Content-Length > 0 (confirms the file contains content)
# Content-Type: application/sql, text/plain, etc.

# 3. Confirm valid parameter without exploiting
curl "http://TARGET/page?id=FOUND_VALUE"

# 4. Directory listing enabled → list content
# The HTML response will include <h2>Index of /backup/</h2>
```

---

## Complete Web Reconnaissance Flow

```bash
# STEP 1: Base directories
ffuf -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt \
     -ic -u http://TARGET/FUZZ -mc 200,301,302,401,403

# STEP 2: For each interesting directory → search for files
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt \
     -u http://TARGET/DIRECTORY/FUZZ \
     -e .php,.bak,.txt,.html,.js,.sql,.env,.zip

# STEP 3: vhosts (if a domain is configured in /etc/hosts)
gobuster vhost -u http://DOMAIN:PORT \
     -w /usr/share/seclists/Discovery/Web-Content/common.txt \
     --append-domain

# STEP 4: GET parameters
wenum -w /usr/share/seclists/Discovery/Web-Content/common.txt \
      --hc 404 -u "http://TARGET/page?FUZZ=test"

# STEP 5: Validate findings with curl
curl -I http://TARGET/FINDING
```

---

## Pitfalls / Gotchas

- **Base size for vhosts:** before fuzzing vhosts with ffuf, make a request without a custom Host to obtain the base `Size`. Use `-fs BASE_SIZE` to filter out generic responses.
- **-ic is mandatory with directory-list-2.3-medium.txt:** this wordlist contains comments at the beginning. Without `-ic`, ffuf will attempt to fuzz the comment lines.
- **gobuster --append-domain vs without:** without `--append-domain`, the Host header will contain only the wordlist term (e.g., `admin`), instead of `admin.domain.htb`. Almost always required.
- **405 Method Not Allowed = valid endpoint:** a 405 confirms the endpoint exists. Test with all HTTP methods.
- **Feroxbuster for recursion, ffuf for everything else:** feroxbuster is more efficient for deeply recursive scans; ffuf is more flexible for custom fuzzing.
- **Rate limit before aggressive fuzzing:** `-rate 100` prevents getting blocked by WAFs or overloading the server.
- **-recursion-depth 2 in CTF/exam:** more depth = exponentially more requests. Start with 2 and expand if necessary.
- **wenum vs wfuzz:** wenum is the active fork; commands are interchangeable. On Kali, wfuzz might be preinstalled; use whichever is available.
- **Validate before reporting:** a 200 in fuzzing does not always mean a vulnerability. Confirm manually with curl.

---

## Related Cheatsheets

- [Web Requests](/en/metodologias/fundamentos/web-requests/) — HTTP, cURL, methods, headers
- [JavaScript Deobfuscation](/en/metodologias/recon/javascript-deobfuscation/) — find endpoints in JS bundles
- [API Attacks](/en/metodologias/web/api-attacks/) — exploit the discovered endpoints
- [Attacking GraphQL](/en/metodologias/web/attacking-graphql/) — GraphQL intrusion after endpoint discovery
- [Broken Authentication](/en/metodologias/web/broken-authentication/) — fuzz credentials and auth parameters
