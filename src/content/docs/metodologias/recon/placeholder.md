---
title: Reconocimiento y Enumeración
description: Cheatsheet táctico de comandos para reconocimiento activo y pasivo.
sidebar:
  order: 1
---

# 🔍 Reconocimiento y Enumeración Táctica

Esta sección consolida los cheatsheets de escaneo, recolección de información y enumeración de servicios.

---

## 🛰️ Escaneo de Puertos Activo

### Escaneo Completo y Rápido (Nmap)
El estándar de oro para encontrar puertos abiertos rápidamente y de forma precisa:
```bash
# -sS (TCP SYN), -p- (todos los puertos), -Pn (ignorar ping), --min-rate 5000 (velocidad)
sudo nmap -sS -p- --min-rate 5000 -Pn 10.10.10.X -oN nmap_all_ports.txt
```

### Escaneo Dirigido de Servicios
Una vez que conocemos los puertos abiertos, realizamos un escaneo exhaustivo:
```bash
# -sC (scripts por defecto), -sV (versiones de servicios)
nmap -sCV -p 22,80,443 10.10.10.X -oN nmap_services.txt
```

---

## 🌐 Enumeración Web

### Descubrimiento de Directorios (Gobuster)
```bash
gobuster dir -u http://10.10.10.X/ -w /usr/share/wordlists/dirb/common.txt -t 50 -o gobuster.txt
```

### Escaneo de Subdominios (Wfuzz)
```bash
wfuzz -c -f subdomains.json -w /usr/share/wordlists/SecLists/Discovery/DNS/subdomains-top1million-110000.txt -u http://pwnvader.com/ -H "Host: FUZZ.pwnvader.com" --hw 123
```
