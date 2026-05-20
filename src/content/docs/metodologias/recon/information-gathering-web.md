---
title: "Information Gathering · Web"
description: "OSINT, subdominios, virtual hosts y WHOIS para targets web."
sidebar:
  order: 3
  label: "Information Gathering · Web"
---
> Reconocimiento web pasivo y activo: WHOIS, DNS, subdominios, virtual hosts, CT logs, fingerprinting, crawling, Google Dorking y Wayback Machine. La base de cualquier engagement web.

---


## WHOIS

```bash
# Lookup básico
whois inlanefreight.com

# Qué buscar:
# - Registrant: nombre, email, organización → phishing targets
# - Name Servers: hosting provider, cloud (AWS/GCP/Azure)
# - Creation Date: dominio joven → sospechoso
# - Expiry Date: dominio próximo a expirar → posible secuestro
```

**Registros de privacidad** ocultan datos personales (GDPR / privacy services). Buscar historial en WhoisFreaks.

---

## DNS Enumeration

### Comandos dig esenciales

```bash
dig inlanefreight.com              # A record por defecto
dig inlanefreight.com A            # IPv4
dig inlanefreight.com AAAA         # IPv6
dig inlanefreight.com MX           # Servidores de correo
dig inlanefreight.com NS           # Nameservers autoritativos
dig inlanefreight.com TXT          # SPF, DKIM, verificaciones
dig inlanefreight.com CNAME        # Aliases
dig inlanefreight.com SOA          # Start of Authority
dig inlanefreight.com ANY          # Todos (muchos servidores ignoran esto)

# Especificar nameserver
dig @8.8.8.8 inlanefreight.com A
dig @10.129.14.128 inlanefreight.htb A

# Output limpio
dig +short inlanefreight.com
dig +noall +answer inlanefreight.com MX

# Reverse lookup (IP → hostname)
dig -x 192.168.1.1

# Trace completo de resolución
dig +trace inlanefreight.com

# Versión del servidor DNS
dig CH TXT version.bind @<nameserver>
```

### Zone Transfer (AXFR) — jackpot si funciona

```bash
# Identificar nameservers primero
dig NS inlanefreight.htb @<IP>

# Intentar zone transfer
dig axfr inlanefreight.htb @10.129.14.128
dig axfr internal.inlanefreight.htb @10.129.14.128

# Si funciona → lista completa de subdominios, IPs internas, DCs
```

### Tipos de registros DNS clave

| Registro | Descripción |
|----------|-------------|
| `A` | IPv4 del hostname |
| `AAAA` | IPv6 del hostname |
| `CNAME` | Alias → otro hostname |
| `MX` | Servidor de correo (con prioridad) |
| `NS` | Nameserver autoritativo |
| `TXT` | SPF, DKIM, verificaciones (revela tech stack) |
| `SOA` | Start of Authority — serial, refresh |
| `SRV` | Hostname + puerto para servicios específicos |
| `PTR` | Reverse DNS |

---

## Subdomain Enumeration

### Passive — CT Logs (sin tocar el target)

```bash
# crt.sh — Certificate Transparency logs
curl -s "https://crt.sh/?q=inlanefreight.com&output=json" | jq -r '.[].name_value' | sort -u

# Filtrar subdominos "dev" en facebook.com
curl -s "https://crt.sh/?q=facebook.com&output=json" | \
  jq -r '.[] | select(.name_value | contains("dev")) | .name_value' | sort -u

# theHarvester — emails + subdominios via OSINT
theHarvester -d inlanefreight.com -b google,bing,crtsh,dnsdumpster
```

### Active — Brute Force DNS

```bash
# dnsenum — todo en uno (brute + AXFR + Google scraping)
dnsenum --enum inlanefreight.com \
  -f /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt -r

# Especificar nameserver
dnsenum --dnsserver 10.129.14.128 --enum -p 0 -s 0 \
  -f /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt inlanefreight.htb

# Brute force manual con dig
for sub in $(cat /opt/useful/seclists/Discovery/DNS/subdomains-top1million-110000.txt); do
  dig $sub.inlanefreight.htb @10.129.14.128 | grep -v ';\|SOA' | \
  sed -r '/^\s*$/d' | grep $sub | tee -a subdomains.txt
done

# ffuf — rápido, filtrando por tamaño de respuesta
ffuf -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt \
  -u http://inlanefreight.htb -H "Host: FUZZ.inlanefreight.htb" \
  -fs <size_of_default_response>
```

---

## Virtual Host Discovery

Los VHosts pueden no tener registro DNS — se acceden mediante el header `Host`.

```bash
# gobuster vhost — fuzz el header Host
gobuster vhost -u http://<IP> \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt \
  --append-domain

# Con opciones extra
gobuster vhost -u http://inlanefreight.htb:81 \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt \
  --append-domain -t 50 -k -o vhosts.txt

# Añadir VHost encontrado al /etc/hosts
echo "10.129.X.X forum.inlanefreight.htb" | sudo tee -a /etc/hosts
```

**Diferencia clave:** subdominio = registro DNS propio; VHost = solo configuración en el servidor web, mismo IP.

---

## Fingerprinting

### Banner grabbing con curl

```bash
# Headers del servidor (HTTP)
curl -I http://inlanefreight.com

# Seguir redirects y ver todos los headers
curl -IL https://inlanefreight.com

# Buscar: Server:, X-Powered-By:, X-Redirect-By:, wp-json → WordPress
```

### Herramientas de fingerprinting

```bash
# whatweb — identificación automática de tecnologías
whatweb inlanefreight.com
whatweb --no-errors 10.10.10.0/24  # barrido de red

# wafw00f — detectar WAF antes de escanear
wafw00f inlanefreight.com
pip3 install git+https://github.com/EnableSecurity/wafw00f

# nikto — fingerprinting + vulnerabilidades conocidas
nikto -h inlanefreight.com -Tuning b   # solo fingerprinting
nikto -h inlanefreight.com             # full scan

# nmap — scripts HTTP
sudo nmap -sV --script http-headers,http-title,http-enum -p80,443 <IP>
```

### Qué buscar en headers HTTP

| Header | Información |
|--------|-------------|
| `Server:` | Tecnología y versión del servidor (Apache 2.4.41, nginx) |
| `X-Powered-By:` | Lenguaje/framework (PHP 7.4, ASP.NET) |
| `X-Redirect-By:` | WordPress, framework de redirección |
| `Set-Cookie:` | PHPSESSID → PHP; JSESSIONID → Java; `wp_` → WordPress |
| `Link:` | `/wp-json/` → WordPress REST API |
| `Strict-Transport-Security` | Ausente → inseguro |
| `X-Content-Type-Options` | Ausente → posible MIME sniffing |

---

## Crawling — robots.txt, sitemap.xml

```bash
# robots.txt — siempre verificar
curl http://target.com/robots.txt

# sitemap.xml — mapa completo de URLs indexadas
curl http://target.com/sitemap.xml

# .well-known — endpoints especiales
curl http://target.com/.well-known/security.txt
curl http://target.com/.well-known/openid-configuration   # OAuth endpoints
```

**`robots.txt` Disallow** → rutas que el owner no quiere indexar → /admin/, /backup/, /private/ son objetivos de interés.

### Scrapy / ReconSpider

```bash
pip3 install scrapy
wget -O ReconSpider.zip https://academy.hackthebox.com/storage/modules/144/ReconSpider.v1.2.zip
unzip ReconSpider.zip
python3 ReconSpider.py http://inlanefreight.com
# → results.json con emails, links, external_files, js_files, comments
```

---

## Google Dorking

```bash
# Encontrar páginas de login
site:example.com inurl:login
site:example.com (inurl:login OR inurl:admin)

# Archivos expuestos
site:example.com filetype:pdf
site:example.com (filetype:xls OR filetype:docx)
site:example.com filetype:sql           # backups de BD
site:example.com filetype:env           # archivos .env

# Config files
site:example.com inurl:config.php
site:example.com (ext:conf OR ext:cnf OR ext:ini)
site:example.com inurl:backup
site:example.com inurl:.git             # repos git expuestos

# Info sensible
site:example.com intitle:"index of"    # directory listing
site:example.com "password" filetype:txt
site:example.com "db_password" OR "db_pass"
inurl:example.com intext:"internal use only"

# Versiones/tech stack
site:example.com inurl:wp-login.php    # WordPress
site:example.com "powered by"
```

**Google Hacking Database (GHDB):** exploit-db.com/google-hacking-database — miles de dorks categorizados.

### Operadores clave

| Operador | Uso |
|----------|-----|
| `site:` | Limitar a un dominio |
| `inurl:` | Término en la URL |
| `intitle:` | Término en el título |
| `intext:` | Término en el cuerpo |
| `filetype:` / `ext:` | Tipo de archivo |
| `"texto"` | Frase exacta |
| `-término` | Excluir |
| `OR` / `AND` | Booleanos |
| `cache:` | Versión cacheada |

---

## Wayback Machine

```bash
# Via curl (API)
curl "https://web.archive.org/cdx/search/cdx?url=inlanefreight.com/*&output=text&fl=original&collapse=urlkey"

# Buscar URLs antiguas con extensiones interesantes
curl "https://web.archive.org/cdx/search/cdx?url=inlanefreight.com/*&output=text&fl=original&collapse=urlkey" \
  | grep -E "\.(php|asp|aspx|jsp|bak|old|sql|conf|env)"
```

**Qué buscar:** páginas admin eliminadas, archivos de backup, credenciales en código fuente antiguo, subdominios que ya no existen pero apuntan a infra activa.

---

## Frameworks de automatización

```bash
# FinalRecon — todo en uno
git clone https://github.com/thewhiteh4t/FinalRecon.git
cd FinalRecon && pip3 install -r requirements.txt
./finalrecon.py --headers --whois --url http://inlanefreight.com
./finalrecon.py --full --url http://inlanefreight.com

# Módulos:
# --headers → HTTP headers
# --sslinfo → Certificado SSL (SANs → subdominios)
# --whois → WHOIS lookup
# --crawl → Spider del sitio
# --dns → 40+ registros DNS
# --sub → Subdominios (crt.sh, Shodan, VirusTotal...)
# --dir → Directory brute force
# --wayback → URLs históricas
# --ps → Port scan rápido
# --full → Todo lo anterior

# theHarvester — emails, subdominios, IPs via OSINT
theHarvester -d inlanefreight.com -b all
theHarvester -d inlanefreight.com -b google,bing,crtsh -f output.html
```

---

## Quick Reference — Checklist de recon web

```
[ ] whois <dominio>                    → registrante, NS, fechas
[ ] dig NS / MX / TXT <dominio>        → infraestructura, emails
[ ] dig axfr <dominio> @<nameserver>   → zone transfer (jackpot)
[ ] curl -s crt.sh/?q=<dominio>        → subdominios via CT logs
[ ] dnsenum --enum <dominio> -f <wl>   → brute force subdominios
[ ] gobuster vhost -u <IP> -w <wl>    → virtual hosts ocultos
[ ] curl -IL <dominio>                 → headers, server version
[ ] wafw00f <dominio>                  → WAF presente?
[ ] whatweb <dominio>                  → tech stack
[ ] nikto -h <dominio> -Tuning b       → fingerprinting + vulns
[ ] curl /robots.txt + /sitemap.xml    → rutas ocultas
[ ] curl /.well-known/security.txt     → endpoints OAuth
[ ] Google dorks: site: filetype:      → info expuesta públicamente
[ ] web.archive.org                    → versiones antiguas
```

---

## Pitfalls / Gotchas

- **VHost ≠ subdominio DNS** — gobuster vhost puede encontrar VHosts que no resuelven en DNS. Siempre añadir al `/etc/hosts` con la IP del target.
- **AXFR raramente funciona** en sistemas bien configurados. Si falla, pasar a brute force.
- **crt.sh incluye wildcards** (`*.ejemplo.com`) — siempre hacer `sort -u` y limpiar duplicados.
- **robots.txt es una pista, no una barrera** — lo que está en Disallow es exactamente lo que hay que revisar.
- **`curl -I` solo muestra el primer redirect** — usar `-IL` para seguir todos y ver los headers finales. El `X-Powered-By` suele desaparecer en redirects intermedios.
- **whatweb en rango de red** (`--no-errors 10.10.10.0/24`) es ideal para discovery inicial antes de elegir targets.
- **Google Dorking**: algunos resultados son de cachés antiguas — verificar que el archivo/ruta siga existiendo.
- **Nikto es ruidoso** — genera muchas peticiones. Usar `-Tuning b` (solo fingerprinting) si hay WAF o IDS.
- **FinalRecon `--sub`** usa APIs externas — algunas requieren API key (Shodan, VirusTotal). Sin key, funciona pero con menos fuentes.

---

## Cheatsheets relacionados

- [Network Enumeration with Nmap](/metodologias/recon/network-enumeration-nmap/) — Port scan antes del recon web
- [Footprinting](/metodologias/recon/footprinting/) — Enumeración DNS/SMTP en profundidad
- [Attacking Web Applications with Ffuf](/metodologias/recon/attacking-web-applications-ffuf/) — Fuzzing de directorios, parámetros y VHosts
- [Using Web Proxies](/metodologias/web/using-web-proxies/) — Intercepción y análisis con Burp Suite / ZAP
- [SQL Injection Fundamentals](/metodologias/web/sql-injection-fundamentals/) — Siguiente paso tras identificar tech stack (DBMS)
- [Attacking Common Applications](/metodologias/web/attacking-common-applications/) — WordPress, Joomla, Tomcat, etc.
