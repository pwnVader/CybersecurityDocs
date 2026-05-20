---
title: "Network Enumeration · Nmap"
description: "Host discovery, port scanning, NSE, performance y evasión de firewall/IDS con Nmap."
sidebar:
  order: 1
  label: "Network Enumeration · Nmap"
---
> Nmap es la herramienta central de enumeración de red. Este cheatsheet cubre host discovery, port scanning, service/OS detection, NSE scripts, optimización de rendimiento y evasión de firewalls/IDS.

---


## Host Discovery

### Descubrir hosts vivos en red

```bash
# Ping sweep (ICMP + ARP) — deshabilita port scan
sudo nmap 10.129.2.0/24 -sn -oA tnet

# Desde lista de IPs
sudo nmap -sn -iL hosts.lst -oA tnet

# Rango de IPs
sudo nmap -sn 10.129.2.18-20 -oA tnet

# Solo ICMP Echo (sin ARP)
sudo nmap 10.129.2.18 -sn -PE --disable-arp-ping -oA host

# Ver por qué Nmap marca el host como vivo
sudo nmap 10.129.2.18 -sn -PE --reason --disable-arp-ping

# Debug — ver todos los paquetes enviados/recibidos
sudo nmap 10.129.2.18 -sn -PE --packet-trace --disable-arp-ping
```

| Flag | Descripción |
|------|-------------|
| `-sn` | Deshabilita port scan (solo host discovery) |
| `-PE` | ICMP Echo Request explícito |
| `--disable-arp-ping` | Fuerza ICMP en vez de ARP (en red local) |
| `--packet-trace` | Muestra todos los paquetes |
| `--reason` | Muestra por qué un puerto/host tiene ese estado |
| `-iL` | Lee targets de un archivo |

---

## Port Scanning

### Estados de puertos

| Estado | Significado |
|--------|-------------|
| `open` | Conexión establecida |
| `closed` | Recibe RST — puerto cerrado pero host vivo |
| `filtered` | Sin respuesta o ICMP error — firewall dropping |
| `unfiltered` | ACK scan: accesible pero open/closed indeterminado |
| `open\|filtered` | Sin respuesta en UDP o firewall |
| `closed\|filtered` | Solo en IP ID idle scan |

### Tipos de scan TCP

```bash
# SYN Scan (default, requiere root) — half-open, más sigiloso
sudo nmap -sS <IP>

# Connect Scan (sin root) — full TCP handshake, más ruidoso
nmap -sT <IP>

# ACK Scan — para mapear reglas de firewall
sudo nmap -sA -p 21,22,25 <IP>

# UDP Scan (lento)
sudo nmap -sU -F <IP>

# OS Detection
sudo nmap -O <IP>

# Todo (sV + sC + O + traceroute)
sudo nmap -A <IP>
```

### Selección de puertos

```bash
nmap -p 22,80,443 <IP>          # puertos específicos
nmap -p 22-445 <IP>             # rango
nmap -p- <IP>                   # todos (65535)
nmap -F <IP>                    # top 100
nmap --top-ports=10 <IP>        # top N
```

### Flags de control de scan

| Flag | Descripción |
|------|-------------|
| `-Pn` | Asumir host vivo (no ICMP ping) — útil si firewall bloquea ping |
| `-n` | Sin resolución DNS |
| `--disable-arp-ping` | Sin ARP ping |
| `-v` / `-vv` | Verbose (muestra puertos abiertos en tiempo real) |
| `--stats-every=5s` | Mostrar progreso cada 5 segundos |
| `[Space Bar]` | Ver progreso del scan en curso |

---

## Service & Version Detection

```bash
# Versión de servicios
sudo nmap -sV <IP>

# Versión + scripts default
sudo nmap -sV -sC <IP>

# Banner grabbing manual
nc -nv <IP> <puerto>
sudo tcpdump -i eth0 host <IP_atacante> and <IP_target>

# Ejemplo: banner SMTP
nc -nv 10.129.2.28 25
# → 220 inlane ESMTP Postfix (Ubuntu)
```

> **Tip:** Nmap no siempre captura todo el banner. Usa `nc` + `--packet-trace` para ver la respuesta completa.

---

## NSE Scripts (Nmap Scripting Engine)

### Categorías de scripts

| Categoría | Uso |
|-----------|-----|
| `auth` | Credenciales de autenticación |
| `brute` | Brute force a servicios |
| `default` | Scripts seguros por defecto (`-sC`) |
| `discovery` | Evaluación de servicios accesibles |
| `exploit` | Explotación de vulnerabilidades conocidas |
| `safe` | Scripts no intrusivos |
| `version` | Extensión para detección de versiones |
| `vuln` | Identificación de vulnerabilidades |

### Uso de scripts

```bash
# Scripts default
sudo nmap <IP> -sC

# Por categoría
sudo nmap <IP> --script vuln
sudo nmap <IP> --script discovery

# Script(s) específicos
sudo nmap <IP> -p 25 --script banner,smtp-commands
sudo nmap <IP> -p 80 --script http-enum
sudo nmap <IP> -p 445 --script smb-os-discovery.nse

# Aggressive (sV + sC + O + traceroute)
sudo nmap <IP> -p 80 -A

# Vuln assessment con versiones
sudo nmap <IP> -p 80 -sV --script vuln
```

### Buscar scripts disponibles

```bash
locate scripts/smb
locate scripts/http
ls /usr/share/nmap/scripts/ | grep <keyword>
```

---

## Guardar Resultados

```bash
# Un formato específico
sudo nmap <IP> -p- -oN output.nmap   # normal (.nmap)
sudo nmap <IP> -p- -oG output.gnmap  # grepable
sudo nmap <IP> -p- -oX output.xml    # XML

# Todos los formatos a la vez (recomendado)
sudo nmap <IP> -p- -oA scan_name

# Convertir XML → HTML legible
xsltproc scan_name.xml -o scan_name.html
```

### Extraer info del grepable output

```bash
grep "/tcp" scan.gnmap | wc -l          # contar puertos abiertos
grep "open" scan.nmap | awk '{print $1}' # listar puertos
cat tnet.gnmap | grep "Up" | cut -d" " -f2  # listar IPs activas
```

---

## Performance — Optimización de velocidad

### Timing templates

| Template | Uso |
|----------|-----|
| `-T0` (paranoid) | Máximo sigilo, muy lento |
| `-T1` (sneaky) | Sigiloso |
| `-T2` (polite) | No saturar la red |
| `-T3` (normal) | **Default** |
| `-T4` (aggressive) | Redes rápidas/confiables |
| `-T5` (insane) | Máxima velocidad (puede perder resultados) |

```bash
sudo nmap 10.129.2.0/24 -F -T4           # scan rápido agresivo
sudo nmap 10.129.2.0/24 -F -T1           # scan sigiloso
```

### Control fino de rendimiento

```bash
# Limitar RTT timeout (acelera en redes con baja latencia)
sudo nmap 10.129.2.0/24 -F --initial-rtt-timeout 50ms --max-rtt-timeout 100ms

# Reducir reintentos (acelera, puede perder puertos)
sudo nmap 10.129.2.0/24 -F --max-retries 0

# Tasa mínima de paquetes/segundo (útil si estás whitelisted)
sudo nmap 10.129.2.0/24 -F --min-rate 300

# Paralelismo
sudo nmap 10.129.2.0/24 --min-parallelism 100
```

> ⚠️ Cuanto más rápido, más ruido. En entornos con IDS/IPS, usa `-T1` o `-T2` + `--max-retries 1`.

---

## Evasión de Firewall e IDS/IPS

### Mapear reglas de firewall

```bash
# SYN scan — detecta open/filtered/closed
sudo nmap -sS -p 21,22,25 <IP> -Pn -n --disable-arp-ping

# ACK scan — detecta si un puerto está filtrado por firewall
# (open y closed devuelven RST; filtered no devuelve nada)
sudo nmap -sA -p 21,22,25 <IP> -Pn -n --disable-arp-ping
```

**Regla clave:** si SYN dice `filtered` pero ACK dice `unfiltered` → el firewall bloquea SYN pero deja pasar ACK. Puerto real: probablemente abierto.

### Decoys (señuelos)

```bash
# Generar 5 IPs aleatorias como señuelos
sudo nmap 10.129.2.28 -p 80 -sS -Pn -n --disable-arp-ping -D RND:5

# Usar IPs específicas como señuelos
sudo nmap 10.129.2.28 -p 80 -sS -D 10.10.14.5,10.10.14.6,ME
```

### Source Port spoofing (bypass de firewall)

```bash
# Muchos firewalls permiten tráfico saliente desde puerto 53 (DNS)
sudo nmap 10.129.2.28 -p 50000 -sS -Pn -n --disable-arp-ping --source-port 53

# Confirmar con ncat
ncat -nv --source-port 53 10.129.2.28 50000
```

### Source IP y DNS Proxy

```bash
# Escanear desde una IP diferente (requiere acceso a esa IP)
sudo nmap 10.129.2.28 -p 445 -O -S 10.129.2.200 -e tun0 -Pn -n

# Especificar servidor DNS propio (útil en DMZ)
sudo nmap <IP> --dns-server <dns_interno>

# Forzar DNS por TCP (puerto 53 TCP)
sudo nmap <IP> --source-port 53
```

### Fragmentación y opciones adicionales

```bash
# Fragmentar paquetes (bypass de algunos firewalls/IDS)
sudo nmap -f <IP>
sudo nmap -f -f <IP>    # fragmentos de 8 bytes

# MTU personalizado
sudo nmap --mtu 24 <IP>

# Idle/Zombie scan (máximo sigilo — requiere zombie vivo)
sudo nmap -sI <zombie_IP> <target_IP>
```

---

## Scans de referencia (copy-paste para examen)

```bash
# Discovery completo
sudo nmap 10.10.10.0/24 -sn -PE --disable-arp-ping -oA discovery

# Scan inicial rápido (guardar para timeline)
sudo nmap -sV --open -oA initial_<IP> <IP>

# Scan completo con scripts
sudo nmap -sV -sC -p- -oA full_<IP> <IP>

# Full TCP sin ping (target detrás de firewall)
sudo nmap -sS -Pn -n --disable-arp-ping -p- -oA full_noping <IP>

# UDP top 100
sudo nmap -sU -F -oA udp_<IP> <IP>

# Vuln scan rápido
sudo nmap -sV --script vuln -p 80,443,8080,8443 <IP>

# SMB
sudo nmap --script smb-os-discovery.nse,smb-vuln-ms17-010 -p 445 <IP>

# HTTP enum
sudo nmap -sV --script http-enum,http-title,http-headers -p 80,443 <IP>

# Evasión firewall via source-port 53
sudo nmap -sS -Pn -n --disable-arp-ping --source-port 53 -p- -oA evasion <IP>
```

---

## Pitfalls / Gotchas

- **`-p-` es lento** (~20 min en red lenta). Lánzalo en background y trabaja con el scan inicial mientras tanto.
- **UDP scan es muy lento** (`-sU -F` puede tardar 2 min en top 100). Añade `-Pn -n` para acelerar.
- **`filtered` ≠ cerrado.** Un puerto `filtered` puede estar abierto detrás del firewall — siempre probar con ACK scan o source-port 53.
- **Sin `sudo`** → Nmap usa `-sT` (Connect scan) en vez de `-sS` (SYN). Siempre usar `sudo`.
- **`-T5` en entornos con IDS** → te pueden banear. Usar `-T2` o ajuste manual con `--max-retries 1 --min-rate 100`.
- **`--initial-rtt-timeout` demasiado bajo** → se pierden hosts. Riesgo real en redes con latencia alta.
- **Siempre `-oA`** → guarda en los 3 formatos. El `.gnmap` es el más útil para grep posterior.
- **Decoys necesitan estar vivos** → si la IP señuelo está down, el target puede detectar SYN-flooding.

---

## Cheatsheets relacionados

- [Getting Started](/metodologias/fundamentos/getting-started/) — Comandos básicos de Nmap como punto de entrada
- [Footprinting](/metodologias/recon/footprinting/) — Enumeración profunda por servicio (FTP, SMB, DNS, SMTP...)
- [Vulnerability Assessment](/metodologias/fundamentos/vulnerability-assessment/) — Nessus, OpenVAS y scoring tras identificar servicios
- [Attacking Common Services](/metodologias/servicios/attacking-common-services/) — Siguiente paso tras identificar servicios abiertos
