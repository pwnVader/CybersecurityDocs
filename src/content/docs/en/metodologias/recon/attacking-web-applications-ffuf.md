---
title: "Attacking Web Apps · Ffuf"
description: "Directory, subdomain, and parameter fuzzing for web discovery."
sidebar:
  order: 5
  label: "Attacking Web Apps · Ffuf"
---
> ffuf: ultra-fast fuzzing of directories, extensions, VHosts, GET/POST parameters, and values. No throttling, no limits.

---


## Reference Wordlists

```bash
# Directories
/opt/useful/seclists/Discovery/Web-Content/directory-list-2.3-small.txt
/opt/useful/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt

# Web extensions
/opt/useful/seclists/Discovery/Web-Content/web-extensions.txt

# Subdomains / VHosts
/opt/useful/seclists/Discovery/DNS/subdomains-top1million-5000.txt
/opt/useful/seclists/Discovery/DNS/subdomains-top1million-20000.txt

# HTTP Parameters
/opt/useful/seclists/Discovery/Web-Content/burp-parameter-names.txt

# Generate numerical wordlist (for IDs)
for i in $(seq 1 1000); do echo $i >> ids.txt; done
```

---

## Directory Fuzzing

```bash
# Basic directory fuzzing
ffuf -w /opt/useful/seclists/Discovery/Web-Content/directory-list-2.3-small.txt:FUZZ \
  -u http://TARGET:PORT/FUZZ

# With verbose and output to file
ffuf -w <wordlist>:FUZZ -u http://TARGET/FUZZ -v -o results.json -of json

# Output options
-o results.txt    # save output
-of json          # format: json, ejson, html, md, csv, ecsv
```

---

## Extension Fuzzing — Identifying Language

```bash
# Fuzz index extension to know if it is PHP, ASP, etc.
ffuf -w /opt/useful/seclists/Discovery/Web-Content/web-extensions.txt:FUZZ \
  -u http://TARGET:PORT/blog/indexFUZZ

# Expected result: .php → 200, .phps → 403, etc.
# Confirms language → use in page fuzzing
```

---

## Page Fuzzing — Files under Directory

```bash
# Once the extension (.php) is identified
ffuf -w /opt/useful/seclists/Discovery/Web-Content/directory-list-2.3-small.txt:FUZZ \
  -u http://TARGET:PORT/blog/FUZZ.php
```

---

## Recursive Fuzzing

```bash
# Recursive scan: automatically searches subdirectories and pages
ffuf -w /opt/useful/seclists/Discovery/Web-Content/directory-list-2.3-small.txt:FUZZ \
  -u http://TARGET:PORT/FUZZ \
  -recursion -recursion-depth 1 \
  -e .php \
  -v

# -recursion-depth 1 → only one level of depth (avoid excessive time)
# -e .php → adds variant with extension to each entry
# -v → show full URL in output
```

> **Tip:** recursive fuzzing with `-recursion-depth 2+` can take a long time. Use depth 1 first, then run manual scans on interesting directories.

---

## DNS Subdomain Fuzzing (Public)

```bash
# Public subdomains (require public DNS record)
ffuf -w /opt/useful/seclists/Discovery/DNS/subdomains-top1million-5000.txt:FUZZ \
  -u https://FUZZ.inlanefreight.com/

# Add discovered subdomain to /etc/hosts
sudo sh -c 'echo "SERVER_IP  subdomain.domain.com" >> /etc/hosts'
```

---

## VHost Fuzzing (Public + Private)

```bash
# VHost fuzzing via Host: header — discovers VHosts without public DNS
ffuf -w /opt/useful/seclists/Discovery/DNS/subdomains-top1million-5000.txt:FUZZ \
  -u http://academy.htb:PORT/ \
  -H 'Host: FUZZ.academy.htb'

# All return 200 → filter by default response size
# First make normal request and note the size (e.g., 900)
ffuf -w /opt/useful/seclists/Discovery/DNS/subdomains-top1million-5000.txt:FUZZ \
  -u http://academy.htb:PORT/ \
  -H 'Host: FUZZ.academy.htb' \
  -fs 900

# VHost found → add to /etc/hosts
sudo sh -c 'echo "IP  admin.academy.htb" >> /etc/hosts'
```

> **Key VHost vs Subdomain:** VHost fuzzing uses `-H 'Host: FUZZ.domain'` against the main IP/domain. It detects VHosts without a public DNS record.

---

## Filters and Matchers

```bash
# MATCHER — only show if condition is met
-mc 200,301,302    # match HTTP status codes (default: 200,204,301,302,307,401,403)
-ms 1234           # match exact response size
-mw 50             # match number of words
-ml 20             # match number of lines
-mr "Welcome"      # match regexp in response

# FILTER — hide if condition is met
-fc 404,403        # filter by status code
-fs 900            # filter by size (most useful for VHost)
-fw 10             # filter by words
-fl 5              # filter by lines
-fr "Not Found"    # filter by regexp
```

---

## Parameter Fuzzing — GET

```bash
# Discover GET parameters accepted by the page
ffuf -w /opt/useful/seclists/Discovery/Web-Content/burp-parameter-names.txt:FUZZ \
  -u http://admin.academy.htb:PORT/admin/admin.php?FUZZ=key \
  -fs <default_size>

# Calculate default_size: run curl without parameter and note the size
curl -s http://admin.academy.htb:PORT/admin/admin.php | wc -c
```

---

## Parameter Fuzzing — POST

```bash
# Discover POST parameters
ffuf -w /opt/useful/seclists/Discovery/Web-Content/burp-parameter-names.txt:FUZZ \
  -u http://admin.academy.htb:PORT/admin/admin.php \
  -X POST \
  -d 'FUZZ=key' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -fs <default_size>

# Verify discovered parameter with curl
curl http://admin.academy.htb:PORT/admin/admin.php \
  -X POST -d 'id=key' \
  -H 'Content-Type: application/x-www-form-urlencoded'
```

---

## Value Fuzzing — Enumerating Valid Values

```bash
# Generate numerical wordlist
for i in $(seq 1 1000); do echo $i >> ids.txt; done

# Fuzz parameter value
ffuf -w ids.txt:FUZZ \
  -u http://admin.academy.htb:PORT/admin/admin.php \
  -X POST \
  -d 'id=FUZZ' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -fs <default_size>
```

---

## Key ffuf Flags

| Flag | Description |
|------|-------------|
| `-w <wordlist>:FUZZ` | Wordlist + keyword |
| `-u <url>` | Target URL (place FUZZ where fuzzing occurs) |
| `-H 'Header: value'` | Add/modify header (VHost: `Host: FUZZ.domain`) |
| `-X POST` | HTTP Method (default: GET) |
| `-d 'param=FUZZ'` | Data for POST |
| `-b 'cookie=value'` | Cookie for authenticated requests |
| `-e .php,.html` | Additional extensions in recursive mode |
| `-recursion` | Enable recursion |
| `-recursion-depth 1` | Maximum recursion depth |
| `-t 40` | Threads (default: 40; do not exceed 200) |
| `-mc <codes>` | Match by status code |
| `-fs <size>` | Filter by response size |
| `-fc <codes>` | Filter by status code |
| `-ic` | Ignore comments in wordlist (copyright headers) |
| `-v` | Verbose output with full URL |
| `-o <file>` | Save results to file |
| `-of json` | Output format (json, html, csv, md) |
| `-s` | Silent mode — results only |

---

## Complete Workflow — Web Fuzzing

```
1. Directory fuzzing         → discover /blog, /admin, /api...
2. Extension fuzzing         → determine tech stack (PHP, ASP, JSP...)
3. Page fuzzing              → FUZZ.php under each directory
4. Recursive scan            → cover the entire tree at once
5. VHost fuzzing             → Host: FUZZ.domain -fs <default>
6. Add VHost to /etc/hosts   → access the real VHost
7. GET param fuzzing         → ?FUZZ=key → find parameters
8. POST param fuzzing        → -X POST -d 'FUZZ=key'
9. Value fuzzing             → id=FUZZ with numerical/custom wordlist
```

---

## Pitfalls / Gotchas

- **ffuf default matchers** → includes 401, 403 as hits. Add `-fc 403` if they produce noise.
- **VHost fuzzing without filter** → all return 200 from default host. Always find the default size and add `-fs <size>`.
- **Wordlist with comments** → `directory-list-2.3` has copyright in the first lines. Use `-ic` to ignore them.
- **-t 200** → can cause DoS on sensitive targets or be detected as an attack. Keep 40 (default) in real environments.
- **Recursive + extensions** → scan size multiplies: wordlist × extensions × depth. Control with `-recursion-depth 1`.
- **POST Content-Type** → PHP only accepts `application/x-www-form-urlencoded` for POST data. Always add `-H 'Content-Type: ...'`.
- **VHost not added to /etc/hosts** → the browser cannot resolve the discovered VHost. Add it before attempting to visit.
- **Default size changes between pages** → calculate the specific default size of each endpoint before fuzzing parameters.
- **Subdomain fuzzing vs VHost** → subdomain fuzzing requires public DNS. For internal labs always use VHost fuzzing.

---

## Related Cheatsheets

- [Using Web Proxies](/en/metodologias/web/using-web-proxies/) — intercept and modify ffuf requests in Burp/ZAP
- [Login Brute Forcing](/en/metodologias/web/login-brute-forcing/) — brute-forcing login forms
- [Information Gathering - Web Edition](/en/metodologias/recon/information-gathering-web/) — OSINT and subdomains before fuzzing
- [SQL Injection Fundamentals](/en/metodologias/web/sql-injection-fundamentals/) — injection in parameters found with ffuf
- [File Inclusion](/en/metodologias/web/file-inclusion/) — LFI/RFI in paths discovered with fuzzing
