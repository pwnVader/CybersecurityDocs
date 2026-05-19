---
title: Escalada de Privilegios
description: Técnicas de post-explotación y elevación de privilegios en Linux y Windows.
sidebar:
  order: 1
---

# 📈 Escalada de Privilegios (PrivEsc)

Estrategias estructuradas para obtener los máximos privilegios administrativos en sistemas comprometidos.

---

## 🐧 PrivEsc en Linux

### Tareas de Enumeración Rápida
```bash
# Permisos SUID
find / -perm -u=s -type f 2>/dev/null

# Permisos de Sudo
sudo -l

# Procesos que corren como root
ps -ef | grep root
```

---

## 🪟 PrivEsc en Windows

### Enumeración Básica
```cmd
:: Información del sistema operativo y parches
systeminfo

:: Permisos del token de usuario actual
whoami /priv

:: Servicios con rutas sin comillas (Unquoted Service Paths)
wmic service get name,displayname,pathname,startmode | findstr /i "auto" | findstr /i /v "c:\windows\\" | findstr /i /v """
```
