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

---

## 🛠️ Herramientas Relacionadas (Ecosistema pwnVader)

<aside class="my-6 p-4 rounded-md border-l-4 border-[#cba6f7] bg-[#cba6f7]/5 not-prose">
  <div class="text-[10px] uppercase tracking-widest text-[#cba6f7] font-bold mb-1">
    Herramienta · hacking.pwnvader.com
  </div>
  <p class="text-sm text-zinc-300">
    ¿Conseguiste dumpear las credenciales locales de SAM o hashes del directorio activo? Rompe las contraseñas offline diseñando patrones en el <a href="https://hacking.pwnvader.com/cracking/hashcat" class="text-[#cba6f7] hover:underline">Hashcat Mask Builder</a>.
  </p>
</aside>

<aside class="my-6 p-4 rounded-md border-l-4 border-[#cba6f7] bg-[#cba6f7]/5 not-prose">
  <div class="text-[10px] uppercase tracking-widest text-[#cba6f7] font-bold mb-1">
    Herramienta · hacking.pwnvader.com
  </div>
  <p class="text-sm text-zinc-300">
    ¿Necesitas codificar exploits en Base64, Hex o URL para transferir archivos al host objetivo sin activar detecciones? Usa la suite <a href="https://hacking.pwnvader.com/encoders/recipes" class="text-[#cba6f7] hover:underline">Encoders & Decoders Recipes</a>.
  </p>
</aside>
