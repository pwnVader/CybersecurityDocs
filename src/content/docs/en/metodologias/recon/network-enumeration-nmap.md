---
title: "Network Enumeration · Nmap"
description: "Host discovery, port scanning, NSE, performance, and firewall/IDS evasion with Nmap."
sidebar:
  order: 1
  label: "Network Enumeration · Nmap"
---
> Nmap is the central tool for network enumeration. This cheatsheet covers host discovery, port scanning, service/OS detection, NSE scripts, performance optimization, and firewall/IDS evasion.

---

## Host Discovery

### Discovering Active Hosts on a Network

```bash
# Ping sweep (ICMP + ARP) — disables port scan
sudo nmap 10.129.2.0/24 -sn -oA tnet

# From an IP list
sudo nmap -sn -iL hosts.lst -oA tnet

# IP range
sudo nmap -sn 10.129.2.18-20 -oA tnet

# ICMP Echo only (no ARP)
sudo nmap 10.129.2.18 -sn -PE --disable-arp-ping -oA host

# See why Nmap marks the host as alive
sudo nmap 10.129.2.18 -sn -PE --reason --disable-arp-ping

# Debug — show all packets sent/received
sudo nmap 10.129.2.18 -sn -PE --packet-trace --disable-arp-ping
```

| Flag | Description |
|------|-------------|
| `-sn` | Disables port scanning (host discovery only) |
| `-PE` | Explicit ICMP Echo Request |
| `--disable-arp-ping` | Forces ICMP instead of ARP (in local networks) |
| `--packet-trace` | Displays all sent/received packets |
| `--reason` | Shows the reason why a port/host has its status |
| `-iL` | Reads targets from a file |

---

## Port Scanning

### Port States

| State | Meaning |
|--------|-------------|
| `open` | Connection established |
| `closed` | Receives RST — port closed but host is alive |
| `filtered` | No response or ICMP error — firewall dropping packets |
| `unfiltered` | ACK scan: accessible but open/closed state is indeterminate |
| `open\|filtered` | No response in UDP or firewall interference |
| `closed\|filtered` | Only seen in IP ID idle scan |

### TCP Scan Types

```bash
# SYN Scan (default, requires root) — half-open, stealthier
sudo nmap -sS <IP>

# Connect Scan (without root) — full TCP handshake, noisier
nmap -sT <IP>

# ACK Scan — to map firewall rules
sudo nmap -sA -p 21,22,25 <IP>

# UDP Scan (slow)
sudo nmap -sU -F <IP>

# OS Detection
sudo nmap -O <IP>

# Everything (sV + sC + O + traceroute)
sudo nmap -A <IP>
```

### Port Selection

```bash
nmap -p 22,80,443 <IP>          # specific ports
nmap -p 22-445 <IP>             # port range
nmap -p- <IP>                   # all ports (65535)
nmap -F <IP>                    # top 100 ports
nmap --top-ports=10 <IP>        # top N ports
```

### Scan Control Flags

| Flag | Description |
|------|-------------|
| `-Pn` | Assume host is alive (no ICMP ping) — useful if firewall blocks ping |
| `-n` | Disable DNS resolution |
| `--disable-arp-ping` | Disable ARP ping |
| `-v` / `-vv` | Verbose (displays discovered open ports in real-time) |
| `--stats-every=5s` | Display progress every 5 seconds |
| `[Space Bar]` | Press Space Bar to view live progress of the active scan |

---

## Service & Version Detection

```bash
# Service version detection
sudo nmap -sV <IP>

# Version + default scripts
sudo nmap -sV -sC <IP>

# Manual banner grabbing
nc -nv <IP> <port>
sudo tcpdump -i eth0 host <attacker_IP> and <target_IP>

# Example: SMTP banner grabbing
nc -nv 10.129.2.28 25
# → 220 inlane ESMTP Postfix (Ubuntu)
```

> **Tip:** Nmap does not always capture the full banner. Use `nc` + `--packet-trace` to view the complete response.

---

## NSE Scripts (Nmap Scripting Engine)

### Script Categories

| Category | Usage |
|-----------|-----|
| `auth` | Authentication credentials checks |
| `brute` | Brute force services |
| `default` | Safe default scripts (`-sC`) |
| `discovery` | Evaluation of accessible services |
| `exploit` | Exploitation of known vulnerabilities |
| `safe` | Non-intrusive scripts |
| `version` | Detections extensions for version analysis |
| `vuln` | Identification of vulnerabilities |

### Script Usage

```bash
# Default scripts
sudo nmap <IP> -sC

# By category
sudo nmap <IP> --script vuln
sudo nmap <IP> --script discovery

# Specific script(s)
sudo nmap <IP> -p 25 --script banner,smtp-commands
sudo nmap <IP> -p 80 --script http-enum
sudo nmap <IP> -p 445 --script smb-os-discovery.nse

# Aggressive (sV + sC + O + traceroute)
sudo nmap <IP> -p 80 -A

# Vuln assessment with version detection
sudo nmap <IP> -p 80 -sV --script vuln
```

### Search for Available Scripts

```bash
locate scripts/smb
locate scripts/http
ls /usr/share/nmap/scripts/ | grep <keyword>
```

---

## Saving Results

```bash
# Specific format
sudo nmap <IP> -p- -oN output.nmap   # normal (.nmap)
sudo nmap <IP> -p- -oG output.gnmap  # grepable
sudo nmap <IP> -p- -oX output.xml    # XML

# All formats at once (recommended)
sudo nmap <IP> -p- -oA scan_name

# Convert XML → readable HTML
xsltproc scan_name.xml -o scan_name.html
```

### Extracting Info from Grepable Output

```bash
grep "/tcp" scan.gnmap | wc -l          # count open ports
grep "open" scan.nmap | awk '{print $1}' # list ports
cat tnet.gnmap | grep "Up" | cut -d" " -f2  # list active IPs
```

---

## Performance — Speed Optimization

### Timing Templates

| Template | Usage |
|----------|-----|
| `-T0` (paranoid) | Maximum stealth, very slow |
| `-T1` (sneaky) | Stealthy |
| `-T2` (polite) | Do not saturate the network |
| `-T3` (normal) | **Default** |
| `-T4` (aggressive) | Fast/reliable networks |
| `-T5` (insane) | Maximum speed (may lose results) |

```bash
sudo nmap 10.129.2.0/24 -F -T4           # fast aggressive scan
sudo nmap 10.129.2.0/24 -F -T1           # stealthy scan
```

### Fine-Tuning Performance

```bash
# Limit RTT timeout (accelerates on low latency networks)
sudo nmap 10.129.2.0/24 -F --initial-rtt-timeout 50ms --max-rtt-timeout 100ms

# Reduce max retries (speeds up, might miss ports)
sudo nmap 10.129.2.0/24 -F --max-retries 0

# Minimum packet rate per second (useful if whitelisted)
sudo nmap 10.129.2.0/24 -F --min-rate 300

# Parallelism
sudo nmap 10.129.2.0/24 --min-parallelism 100
```

> ⚠️ Speed breeds noise. In environments with active IDS/IPS, prefer `-T1` or `-T2` combined with `--max-retries 1`.

---

## Firewall & IDS/IPS Evasion

### Mapping Firewall Rules

```bash
# SYN scan — detects open/filtered/closed states
sudo nmap -sS -p 21,22,25 <IP> -Pn -n --disable-arp-ping

# ACK scan — detects if a port is filtered by a firewall
# (open and closed return RST; filtered returns no response)
sudo nmap -sA -p 21,22,25 <IP> -Pn -n --disable-arp-ping
```

**Key Rule:** If SYN says `filtered` but ACK says `unfiltered` → the firewall is blocking SYN but letting ACK pass. Real port: probably open.

### Decoys

```bash
# Generate 5 random IPs as decoys
sudo nmap 10.129.2.28 -p 80 -sS -Pn -n --disable-arp-ping -D RND:5

# Use specific IPs as decoys
sudo nmap 10.129.2.28 -p 80 -sS -D 10.10.14.5,10.10.14.6,ME
```

### Source Port Spoofing (Firewall Bypass)

```bash
# Many firewalls allow outbound traffic from port 53 (DNS)
sudo nmap 10.129.2.28 -p 50000 -sS -Pn -n --disable-arp-ping --source-port 53

# Confirm with ncat
ncat -nv --source-port 53 10.129.2.28 50000
```

### Source IP & DNS Proxying

```bash
# Scan from a different IP (requires ownership/access to that IP)
sudo nmap 10.129.2.28 -p 445 -O -S 10.129.2.200 -e tun0 -Pn -n

# Specify custom DNS server (useful in DMZ)
sudo nmap <IP> --dns-server <internal_dns>

# Force DNS over TCP (port 53 TCP)
sudo nmap <IP> --source-port 53
```

### Packet Fragmentation & Additional Options

```bash
# Fragment packets (bypass some firewalls/IDS)
sudo nmap -f <IP>
sudo nmap -f -f <IP>    # 8-byte fragments

# Custom MTU
sudo nmap --mtu 24 <IP>

# Idle/Zombie scan (maximum stealth — requires active zombie host)
sudo nmap -sI <zombie_IP> <target_IP>
```

---

## Reference Scans (Copy-paste for Exams)

```bash
# Complete discovery
sudo nmap 10.10.10.0/24 -sn -PE --disable-arp-ping -oA discovery

# Quick initial scan (save for timeline)
sudo nmap -sV --open -oA initial_<IP> <IP>

# Full scan with scripts
sudo nmap -sV -sC -p- -oA full_<IP> <IP>

# Full TCP without ping (target behind firewall)
sudo nmap -sS -Pn -n --disable-arp-ping -p- -oA full_noping <IP>

# UDP top 100 ports
sudo nmap -sU -F -oA udp_<IP> <IP>

# Quick vuln scan
sudo nmap -sV --script vuln -p 80,443,8080,8443 <IP>

# SMB vuln scanning
sudo nmap --script smb-os-discovery.nse,smb-vuln-ms17-010 -p 445 <IP>

# HTTP enum scanning
sudo nmap -sV --script http-enum,http-title,http-headers -p 80,443 <IP>

# Evasion via source-port 53
sudo nmap -sS -Pn -n --disable-arp-ping --source-port 53 -p- -oA evasion <IP>
```

---

## Pitfalls / Gotchas

- **`-p-` is slow** (~20 mins on slow networks). Launch it in the background and work with the initial quick scan in the meantime.
- **UDP scan is extremely slow** (`-sU -F` can take 2 mins for the top 100). Add `-Pn -n` to speed it up.
- **`filtered` ≠ closed.** A `filtered` port might be open behind a firewall — always double-check with an ACK scan or source-port 53 spoofing.
- **No `sudo`** → Nmap uses `-sT` (Connect scan) instead of `-sS` (SYN). Always run with `sudo`.
- **`-T5` in environments with active IDS** → Will get you banned/blocked. Use `-T2` or manual rates with `--max-retries 1 --min-rate 100`.
- **Setting `--initial-rtt-timeout` too low** → Will drop hosts. High risk in high latency networks.
- **Always use `-oA`** → Saves in all 3 formats. The `.gnmap` format is the most useful for post-recon grepping.
- **Decoys must be active** → If a decoy IP is down, the target might detect the scan as SYN-flooding.

---

## Related Cheatsheets

- [Getting Started](/en/metodologias/fundamentos/getting-started/) — Basic Nmap commands as an entry point
- [Footprinting](/en/metodologias/recon/footprinting/) — Deep service enumeration (FTP, SMB, DNS, SMTP...)
- [Vulnerability Assessment](/en/metodologias/fundamentos/vulnerability-assessment/) — Nessus, OpenVAS, and scoring after service discovery
- [Attacking Common Services](/en/metodologias/servicios/attacking-common-services/) — Next step after identifying open ports
