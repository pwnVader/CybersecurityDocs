---
title: "Information Gathering · Web"
description: "OSINT, subdomains, virtual hosts, and WHOIS for web targets."
sidebar:
  order: 3
  label: "Information Gathering · Web"
---
> Passive and active web reconnaissance: WHOIS, DNS, subdomains, virtual hosts, CT logs, fingerprinting, crawling, Google Dorking, and Wayback Machine. The foundation of any web engagement.

---


## WHOIS

```bash
# Basic lookup
whois inlanefreight.com

# What to look for:
# - Registrant: name, email, organization → phishing targets
# - Name Servers: hosting provider, cloud (AWS/GCP/Azure)
# - Creation Date: young domain → suspicious
# - Expiry Date: domain close to expiring → potential hijack
```

**Privacy records** hide personal data (GDPR / privacy services). Search history on WhoisFreaks.

---

## DNS Enumeration

### Essential dig Commands

```bash
dig inlanefreight.com              # A record by default
dig inlanefreight.com A            # IPv4
dig inlanefreight.com AAAA         # IPv6
dig inlanefreight.com MX           # Mail servers
dig inlanefreight.com NS           # Authoritative nameservers
dig inlanefreight.com TXT          # SPF, DKIM, verifications
dig inlanefreight.com CNAME        # Aliases
dig inlanefreight.com SOA          # Start of Authority
dig inlanefreight.com ANY          # All (many servers ignore this)

# Specify nameserver
dig @8.8.8.8 inlanefreight.com A
dig @10.129.14.128 inlanefreight.htb A

# Clean output
dig +short inlanefreight.com
dig +noall +answer inlanefreight.com MX

# Reverse lookup (IP → hostname)
dig -x 192.168.1.1

# Full resolution trace
dig +trace inlanefreight.com

# DNS server version
dig CH TXT version.bind @<nameserver>
```

### Zone Transfer (AXFR) — Jackpot If Active

```bash
# Identify nameservers first
dig NS inlanefreight.htb @<IP>

# Attempt zone transfer
dig axfr inlanefreight.htb @10.129.14.128
dig axfr internal.inlanefreight.htb @10.129.14.128

# If successful → complete list of subdomains, internal IPs, DCs
```

### Key DNS Record Types

| Record | Description |
|----------|-------------|
| `A` | IPv4 of the hostname |
| `AAAA` | IPv6 of the hostname |
| `CNAME` | Alias → another hostname |
| `MX` | Mail server (with priority) |
| `NS` | Authoritative nameserver |
| `TXT` | SPF, DKIM, verifications (reveals tech stack) |
| `SOA` | Start of Authority — serial, refresh |
| `SRV` | Hostname + port for specific services |
| `PTR` | Reverse DNS |

---

## Subdomain Enumeration

### Passive — CT Logs (Without Touching the Target)

```bash
# crt.sh — Certificate Transparency logs
curl -s "https://crt.sh/?q=inlanefreight.com&output=json" | jq -r '.[].name_value' | sort -u

# Filter "dev" subdomains on facebook.com
curl -s "https://crt.sh/?q=facebook.com&output=json" | \
  jq -r '.[] | select(.name_value | contains("dev")) | .name_value' | sort -u

# theHarvester — emails + subdomains via OSINT
theHarvester -d inlanefreight.com -b google,bing,crtsh,dnsdumpster
```

### Active — DNS Brute-Force

```bash
# dnsenum — all-in-one (brute + AXFR + Google scraping)
dnsenum --enum inlanefreight.com \
  -f /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt -r

# Specify nameserver
dnsenum --dnsserver 10.129.14.128 --enum -p 0 -s 0 \
  -f /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt inlanefreight.htb

# Manual brute-force with dig
for sub in $(cat /opt/useful/seclists/Discovery/DNS/subdomains-top1million-110000.txt); do
  dig $sub.inlanefreight.htb @10.129.14.128 | grep -v ';\|SOA' | \
  sed -r '/^\s*$/d' | grep $sub | tee -a subdomains.txt
done

# ffuf — fast, filtering by response size
ffuf -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt \
  -u http://inlanefreight.htb -H "Host: FUZZ.inlanefreight.htb" \
  -fs <size_of_default_response>
```

---

## Virtual Host Discovery

VHosts may not have a DNS record — they are accessed via the `Host` header.

```bash
# gobuster vhost — fuzz the Host header
gobuster vhost -u http://<IP> \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt \
  --append-domain

# With extra options
gobuster vhost -u http://inlanefreight.htb:81 \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt \
  --append-domain -t 50 -k -o vhosts.txt

# Add discovered VHost to /etc/hosts
echo "10.129.X.X forum.inlanefreight.htb" | sudo tee -a /etc/hosts
```

**Key Difference:** subdomain = its own DNS record; VHost = only configuration on the web server, same IP.

---

## Fingerprinting

### Banner Grabbing with curl

```bash
# Server headers (HTTP)
curl -I http://inlanefreight.com

# Follow redirects and see all headers
curl -IL https://inlanefreight.com

# Look for: Server:, X-Powered-By:, X-Redirect-By:, wp-json → WordPress
```

### Fingerprinting Tools

```bash
# whatweb — automatic technology identification
whatweb inlanefreight.com
whatweb --no-errors 10.10.10.0/24  # network sweep

# wafw00f — detect WAF before scanning
wafw00f inlanefreight.com
pip3 install git+https://github.com/EnableSecurity/wafw00f

# nikto — fingerprinting + known vulnerabilities
nikto -h inlanefreight.com -Tuning b   # fingerprinting only
nikto -h inlanefreight.com             # full scan

# nmap — HTTP scripts
sudo nmap -sV --script http-headers,http-title,http-enum -p80,443 <IP>
```

### What to Look for in HTTP Headers

| Header | Information |
|--------|-------------|
| `Server:` | Server technology and version (Apache 2.4.41, nginx) |
| `X-Powered-By:` | Language/framework (PHP 7.4, ASP.NET) |
| `X-Redirect-By:` | WordPress, redirection framework |
| `Set-Cookie:` | PHPSESSID → PHP; JSESSIONID → Java; `wp_` → WordPress |
| `Link:` | `/wp-json/` → WordPress REST API |
| `Strict-Transport-Security` | Absent → insecure |
| `X-Content-Type-Options` | Absent → possible MIME sniffing |

---

## Crawling — robots.txt, sitemap.xml

```bash
# robots.txt — always check
curl http://target.com/robots.txt

# sitemap.xml — complete map of indexed URLs
curl http://target.com/sitemap.xml

# .well-known — special endpoints
curl http://target.com/.well-known/security.txt
curl http://target.com/.well-known/openid-configuration   # OAuth endpoints
```

**`robots.txt` Disallow** → routes that the owner does not want to index → `/admin/`, `/backup/`, `/private/` are prime targets of interest.

### Scrapy / ReconSpider

```bash
pip3 install scrapy
wget -O ReconSpider.zip https://academy.hackthebox.com/storage/modules/144/ReconSpider.v1.2.zip
unzip ReconSpider.zip
python3 ReconSpider.py http://inlanefreight.com
# → results.json with emails, links, external_files, js_files, comments
```

---

## Google Dorking

```bash
# Find login pages
site:example.com inurl:login
site:example.com (inurl:login OR inurl:admin)

# Exposed files
site:example.com filetype:pdf
site:example.com (filetype:xls OR filetype:docx)
site:example.com filetype:sql           # DB backups
site:example.com filetype:env           # .env files

# Config files
site:example.com inurl:config.php
site:example.com (ext:conf OR ext:cnf OR ext:ini)
site:example.com inurl:backup
site:example.com inurl:.git             # exposed git repos

# Sensitive info
site:example.com intitle:"index of"    # directory listing
site:example.com "password" filetype:txt
site:example.com "db_password" OR "db_pass"
inurl:example.com intext:"internal use only"

# Versions/tech stack
site:example.com inurl:wp-login.php    # WordPress
site:example.com "powered by"
```

**Google Hacking Database (GHDB):** exploit-db.com/google-hacking-database — thousands of categorized dorks.

### Key Operators

| Operator | Usage |
|----------|-----|
| `site:` | Limit to a single domain |
| `inurl:` | Term in the URL |
| `intitle:` | Term in the title |
| `intext:` | Term in the body |
| `filetype:` / `ext:` | File type |
| `"text"` | Exact phrase |
| `-term` | Exclude |
| `OR` / `AND` | Booleans |
| `cache:` | Cached version |

---

## Wayback Machine

```bash
# Via curl (API)
curl "https://web.archive.org/cdx/search/cdx?url=inlanefreight.com/*&output=text&fl=original&collapse=urlkey"

# Search ancient URLs with interesting extensions
curl "https://web.archive.org/cdx/search/cdx?url=inlanefreight.com/*&output=text&fl=original&collapse=urlkey" \
  | grep -E "\.(php|asp|aspx|jsp|bak|old|sql|conf|env)"
```

**What to look for:** deleted admin pages, backup files, credentials in old source code, subdomains that no longer exist but point to active infrastructure.

---

## Automation Frameworks

```bash
# FinalRecon — all-in-one
git clone https://github.com/thewhiteh4t/FinalRecon.git
cd FinalRecon && pip3 install -r requirements.txt
./finalrecon.py --headers --whois --url http://inlanefreight.com
./finalrecon.py --full --url http://inlanefreight.com

# Modules:
# --headers → HTTP headers
# --sslinfo → SSL Certificate (SANs → subdomains)
# --whois → WHOIS lookup
# --crawl → Web spider
# --dns → 40+ DNS records
# --sub → Subdomains (crt.sh, Shodan, VirusTotal...)
# --dir → Directory brute force
# --wayback → Historical URLs
# --ps → Fast port scan
# --full → All of the above

# theHarvester — emails, subdomains, IPs via OSINT
theHarvester -d inlanefreight.com -b all
theHarvester -d inlanefreight.com -b google,bing,crtsh -f output.html
```

---

## Quick Reference — Web Recon Checklist

```
[ ] whois <domain>                    → registrant, NS, dates
[ ] dig NS / MX / TXT <domain>        → infrastructure, emails
[ ] dig axfr <domain> @<nameserver>   → zone transfer (jackpot)
[ ] curl -s crt.sh/?q=<domain>        → subdomains via CT logs
[ ] dnsenum --enum <domain> -f <wl>   → brute-force subdomains
[ ] gobuster vhost -u <IP> -w <wl>    → hidden virtual hosts
[ ] curl -IL <domain>                 → headers, server version
[ ] wafw00f <domain>                  → WAF present?
[ ] whatweb <domain>                  → tech stack
[ ] nikto -h <domain> -Tuning b       → fingerprinting + vulns
[ ] curl /robots.txt + /sitemap.xml    → hidden paths
[ ] curl /.well-known/security.txt     → OAuth endpoints
[ ] Google dorks: site: filetype:      → publicly exposed info
[ ] web.archive.org                    → archive versions
```

---

## Pitfalls / Gotchas

- **VHost ≠ DNS subdomain** — `gobuster vhost` can find VHosts that do not resolve in DNS. Always add them to `/etc/hosts` with the target IP.
- **AXFR rarely works** on well-configured systems. If it fails, move to brute-force.
- **crt.sh includes wildcards** (`*.example.com`) — always run `sort -u` and clean duplicates.
- **robots.txt is a clue, not a barrier** — what is in Disallow is exactly what needs to be checked.
- **curl -I only shows the first redirect** — use `-IL` to follow all and see final headers. `X-Powered-By` often disappears in intermediate redirects.
- **whatweb on network range** (`--no-errors 10.10.10.0/24`) is ideal for initial discovery before choosing targets.
- **Google Dorking**: some results are from old caches — verify that the file/path still exists.
- **Nikto is noisy** — it generates many requests. Use `-Tuning b` (fingerprinting only) if a WAF or IDS is present.
- **FinalRecon `--sub`** uses external APIs — some require API keys (Shodan, VirusTotal). Without a key, it works but with fewer sources.

---

## Related Cheatsheets

- [Network Enumeration with Nmap](/en/metodologias/recon/network-enumeration-nmap/) — Port scan before web recon
- [Footprinting](/en/metodologias/recon/footprinting/) — Deep DNS/SMTP enumeration
- [Attacking Web Applications with Ffuf](/en/metodologias/recon/attacking-web-applications-ffuf/) — Fuzzing directories, parameters, and VHosts
- [Using Web Proxies](/en/metodologias/web/using-web-proxies/) — Interception and analysis with Burp Suite / ZAP
- [SQL Injection Fundamentals](/en/metodologias/web/sql-injection-fundamentals/) — Next step after identifying tech stack (DBMS)
- [Attacking Common Applications](/en/metodologias/web/attacking-common-applications/) — WordPress, Joomla, Tomcat, etc.
