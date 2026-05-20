---
title: "Using Web Proxies"
description: "Burp Suite, ZAP, HTTP traffic interception and manipulation."
sidebar:
  order: 1
  label: "Using Web Proxies"
---
> HTTP traffic interception, manipulation, and automation with Burp Suite and ZAP. The foundation for any web attack.

---


## Initial Setup

### FoxyProxy

```
1. Firefox/Chrome extension: FoxyProxy Standard
2. Add proxy: IP 127.0.0.1, Port 8080, Type HTTP
3. Activate → all traffic goes through Burp/ZAP
```

### CA Certificates — HTTPS without Warning

```bash
# Burp Suite
# Navegar a: http://burp
# → descargar cacert.der → importar en Firefox/Chrome como CA de confianza
# Firefox: about:preferences → Privacy → View Certificates → Import

# ZAP
# Tools → Options → Network → Server Certificates → Save → importar en browser
```

### Default Ports

| Tool | Port |
|-------------|--------|
| Burp Suite | 8080 |
| ZAP | 8080 |

---

## Intercepting Requests

### Burp Suite

```
Proxy → Intercept → "Intercept is on"
→ Modify body/headers → Forward
→ Drop to discard
```

### ZAP

```
CTRL+B → enable/disable interception
Left HUD panel → button 2 (circular arrow)
→ Step: advance request by request
```

### Intercepting RESPONSES

```bash
# Burp
Proxy → Proxy settings → Response interception rules
→ "Intercept responses based on the following rules"
→ Enable default rule

# ZAP
→ Step button → forward response
```

---

## Manipulating Intercepted Requests

```
Typical use cases:
- SQL Injection: change value → ' OR 1=1--
- Command injection: add ; id to the parameter
- File upload: change Content-Type or extension
- Auth bypass: modify role/cookie
- SSRF: change URL to internal host
```

---

## Automatic Modification (Without Intercepting)

### Burp — Match and Replace

```
Proxy → Proxy settings → HTTP match and replace rules → Add
  Type: Request header / Request body / Response header / Response body
  Match: regex or string literal (e.g., ^User-Agent.*$)
  Replace: new value (e.g., User-Agent: Mozilla/5.0)
  → Applies to EVERY request passing through the proxy
```

### ZAP — Replacer

```
CTRL+R → Replacer
→ Add rule → Description, Match Type, Match String, Replacement
→ Enable → applies automatically
```

---

## Repeater / Repeating Requests

### Burp Repeater

```
From history or Intercept:
→ CTRL+R → send to Repeater
→ CTRL+SHIFT+R → open Repeater tab
→ Modify → Send
→ Navigate history with arrows ← →
```

### ZAP — Resend with Request Editor

```
History → right click → Open/Resend with Request Editor
→ Modify → Send
```

### ZAP — HUD Replay

```
In HUD panel → Replay in Console
→ Replay in Browser (re-executes in browser)
```

---

## Encoding / Decoding

### Burp Decoder

```
Select text → CTRL+SHIFT+D → Decoder tab
→ Decode as: URL / HTML / Base64 / ASCII hex / Hex / Octal / Binary / GZIP
→ Encode as: same menu
→ Smart Decode: automatically detects

Quick shortcut in Repeater/Intercept:
→ Select text → CTRL+U (URL-encode selection)
```

### ZAP — Encoder/Decoder/Hash

```
CTRL+E → Encoder/Decoder/Hash
→ Input → Output in multiple formats simultaneously
→ Soporta: URL, HTML, Base64, SHA-1/256/512, MD5
```

---

## Proxying CLI Tools

### proxychains

```bash
# Edit /etc/proxychains.conf — add at the end:
http 127.0.0.1 8080

# Use with any tool
proxychains -q curl http://target/api/v1/users
proxychains -q sqlmap -u "http://target/page?id=1"
proxychains -q nmap -sT -Pn 192.168.1.1
```

### Metasploit Through a Proxy

```bash
msf6 > use auxiliary/scanner/http/http_version
msf6 > set PROXIES HTTP:127.0.0.1:8080
msf6 > set RHOSTS target.com
msf6 > run
```

---

## Burp Intruder — Fuzzing

### Attack Configuration

```
1. Request in Repeater/Intercept → CTRL+I → Intruder
2. Positions tab:
   - "Clear §" → remove existing markers
   - Select value to fuzz → "Add §"
   - Result: ...?param=§value§
3. Payloads tab:
   - Payload type: Simple List (small wordlist)
   - Payload type: Runtime file (large wordlist — loads in real-time)
   - Load → select file
4. Payload Processing:
   - Add rule → "Skip if matches regex": ^\..*$  (exclude dotfiles)
5. Settings → Grep-Match: add "200 OK" (highlight successful responses)
6. Attack → Start Attack
```

### Attack Types

| Type | Use |
|------|-----|
| **Sniper** | One parameter, one wordlist — the most common |
| **Battering ram** | Same word in all parameters simultaneously |
| **Pitchfork** | N wordlists, one per parameter — paired line-by-line |
| **Cluster bomb** | Cartesian product of all wordlists (username × password) |

> ⚠️ **Burp Community Edition:** throttled at 1 req/s. For fast fuzzing use ZAP Fuzzer.

---

## ZAP Fuzzer — Fuzzing

```
1. Request in history → right click → Attack → Fuzz
2. Fuzz Locations:
   - Select text in request → Add
3. Payloads → Add:
   - File: own wordlist
   - File Fuzzers: dirbuster / common.txt, Numberzz, etc.
4. Processors → Add (to process each payload):
   - URL Encode
   - Base64 Encode
   - MD5 Hash
   - Prefix/Postfix String
   - Script
5. Options:
   - Concurrent threads: 20 (adjust based on target)
   - Retries: 3
   - Depth-first / Breadth-first strategy
6. Start Fuzzer
```

> **Advantage over Intruder:** ZAP Fuzzer has no throttle — full speed for free.

---

## Burp Scanner (Pro)

### Crawler — Discovery

```
1. Target → Site map → navigate the target to populate the map
2. Right click on host/path → Add to Scope
3. Target → Scope → verify/adjust included paths
4. Dashboard → New Scan
   - Crawl: discover paths only
   - Crawl and Audit: discover + find vulnerabilities
5. Choose preset:
   - Crawl strategy - fastest
   - Crawl strategy - more complete
   - Never stop crawl
```

### Passive Scanner

```
1. Manually browse the site with the active proxy
2. History → select request → right click → Do passive scan
3. Dashboard → Issue activity → view findings
   (without sending active requests — only analyzes what has already been captured)
```

### Active Scanner

```
1. Target → Site map → right click on host → Scan
   or Dashboard → New Scan → Crawl and Audit
2. Reports vulnerabilities in Dashboard → Issue activity:
   - SQL injection, XSS, XXE, SSRF, path traversal, etc.
3. Click on finding → Advisory → description + evidence + remediation
```

> ⚠️ Active scanner **only with explicit authorization** — generates aggressive traffic and can crash services.

---

## ZAP Scanner

```
# Scan automático desde UI
Tools → Active Scan → select target → Start Scan

# Desde línea de comandos (headless)
zap-cli quick-scan --self-contained --start-options "-config api.disablekey=true" http://target

# Spider (crawler equivalent)
Tools → Spider → select target → Start Scan
→ Dashboard → Spider tab → view discovered URLs

# Reporte
Report → Generate Report → HTML/XML/JSON
```

---

## Quick Reference — Burp vs ZAP

| Feature | Burp (Community) | Burp (Pro) | ZAP |
|---------|-----------------|------------|-----|
| Price | Free | $449/year | Free |
| Intercept | ✅ | ✅ | ✅ |
| Repeater | ✅ | ✅ | ✅ (Request Editor) |
| Intruder/Fuzzer | ✅ throttled | ✅ full speed | ✅ full speed |
| Scanner | ❌ | ✅ | ✅ |
| Crawler | ❌ | ✅ | ✅ |
| Extensions | ✅ (limited) | ✅ (BApp Store) | ✅ (Marketplace) |
| HUD en browser | ❌ | ❌ | ✅ |

---

## Pitfalls / Gotchas

- **CA cert not installed:** HTTPS will give a certificate error and the proxy will not capture anything. Always install it before starting.
- **FoxyProxy disabled:** traffic does not pass through the proxy. Verify that the icon is active before intercepting.
- **Burp Community throttle:** 1 req/s in Intruder. For directory fuzzing, use ZAP or ffuf directly.
- **Intercept enabled and forgotten:** the browser hangs waiting for Forward. Always check the status of intercept.
- **proxychains without `-q` tool:** prints verbose output. Add `-q` for clean output.
- **Metasploit PROXIES:** if the module does not support proxies, the option is silently ignored.
- **Active scanner without scope:** it can scan domains out of scope and lead to legal issues. Define a strict scope.
- **ZAP HUD on HTTPS:** requires the ZAP CA to be installed in the browser. Same steps as Burp.
- **Cluster Bomb in Burp Community:** generates many requests but at 1 req/s it is useless. Use Pitchfork as a more efficient alternative with credentials.
- **Automatic Intruder § markers:** Burp adds markers to all parameters. Always "Clear §" and only add the target parameter.

---

## Related Cheatsheets

- [Attacking Web Applications with Ffuf](/en/metodologias/recon/attacking-web-applications-ffuf/) — directory/parameter fuzzing without throttle
- [Login Brute Forcing](/en/metodologias/web/login-brute-forcing/) — brute-forcing HTTP forms with Hydra/Medusa
- [SQL Injection Fundamentals](/en/metodologias/web/sql-injection-fundamentals/) — manipulating SQL queries via proxy
- [File Upload Attacks](/en/metodologias/web/file-upload-attacks/) — Content-Type bypass via interception
- [Command Injections](/en/metodologias/web/command-injections/) — modifying parameters for command injection
- [Web Attacks](/en/metodologias/web/web-attacks/) — IDOR, XXE, JWT via proxy
