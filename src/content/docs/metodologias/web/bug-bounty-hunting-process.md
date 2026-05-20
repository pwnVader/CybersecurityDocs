---
title: "Bug Bounty Process"
description: "Metodología, scope, reporting y plataformas (HackerOne, Bugcrowd)."
sidebar:
  order: 15
  label: "Bug Bounty Process"
---
> Metodología completa de bug bounty: encontrar programas, leer scope, reportar vulnerabilidades y comunicarse con triage — con ejemplos de reportes reales.

---


## Tipos de programas y plataformas

### Plataformas principales

| Plataforma | URL | Notas |
|------------|-----|-------|
| HackerOne | hackerone.com | Mayor comunidad; Directory público |
| Bugcrowd | bugcrowd.com | También privados y VDPs |
| Intigriti | intigriti.com | Fuerte presencia europea |
| YesWeHack | yeswehack.com | Europa/global |
| Synack | synack.com | Privado/selecto; Red Team |
| Open Bug Bounty | openbugbounty.org | Sin recompensa monetaria, XSS/CSRF |

### Tipos de programa

```
Private BBP: solo por invitación
  → Invitaciones basadas en: track record, % valid reports, sin violaciones
  → Empezar en públicos para construir reputación

Public BBP: abierto a toda la comunidad
  → Más competencia pero más scope para practicar

VDP (Vulnerability Disclosure Program): sin reward económico
  → Solo guía de disclosure responsable, sin bounty

Parent/Child: holding con subsidiarias
  → Un solo pool de bounty; reportar al child o al parent según policy
```

### Buscar programas

```bash
# HackerOne Directory
# https://hackerone.com/directory/programs
# Filtrar por: tipo de reward, industria, scope, response time

# Bugcrowd Disclosure
# https://bugcrowd.com/programs
```

---

## Leer el programa — Elementos clave

Antes de tocar nada, leer estos apartados de la policy:

```
□ Scope → dominios/IPs/apps en scope
□ Out of Scope → lo que NO testear (ej: *.cdn.empresa.com, third-party services)
□ Rules of Engagement → qué ataques están permitidos/prohibidos
□ Eligibility Criteria → "first reporter only", requisitos de cuenta, etc.
□ Reporting Format → formato esperado del reporte
□ Rewards → tabla de severidades y cantidades
□ Responsible Disclosure Policy → timeline de disclosure (ej: 90 días)
□ Safe Harbor → protección legal para el hunter
□ Access → cómo obtener cuentas de test
□ Vendor Response SLAs → tiempos de respuesta esperados
```

> **Regla de oro:** lo que no está explícitamente en scope = out of scope. En caso de duda, preguntar antes de testear.

---

## Estructura de un buen reporte

```
Vulnerability Title  → tipo vuln + dominio/endpoint/parámetro + impacto breve
CWE                  → número + nombre (ej: CWE-79: Cross-site Scripting)
CVSS 3.1 Score       → número + severidad (ej: 7.5 High)
Description          → causa de la vulnerabilidad (técnico pero claro)
Proof of Concept     → pasos REPRODUCIBLES para explotar (1, 2, 3...)
Impact               → qué puede lograr un atacante al explotar la vuln
Remediation          → opcional pero valorado; propuesta de fix
```

### Plantilla de reporte

```markdown
## Title
[Vuln Type] in [Parameter/Endpoint] of [Domain] — [Impact summary]

## CWE
CWE-XXX: [Nombre completo]

## CVSS 3.1 Score
X.X ([Critical/High/Medium/Low])
Vector: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H

## Description
[Descripción técnica de la vulnerabilidad: qué, dónde, por qué existe]

## Steps to Reproduce (POC)
1. Navegar a [URL]
2. Ingresar en el campo [X]: [payload]
3. Observar que [comportamiento esperado]
4. [Resultado que demuestra la vulnerabilidad]

## Impact
[Impacto máximo: qué puede lograr el atacante, datos afectados, usuarios impactados]

## Remediation
[Propuesta de fix: sanitización, validación, configuración]
```

---

## CVSS 3.1 — Calculadora de severidad

**Calculadora oficial:** https://www.first.org/cvss/calculator/3.1

### Métricas del Base Score

| Métrica | Opciones | Guía rápida |
|---------|----------|-------------|
| **Attack Vector (AV)** | N/A/L/P | N=remoto vía internet; L=acceso local; P=físico |
| **Attack Complexity (AC)** | L/H | L=exploit repetible sin prep; H=condiciones especiales |
| **Privileges Required (PR)** | N/L/H | N=sin auth; L=user normal; H=admin |
| **User Interaction (UI)** | N/R | N=sin víctima; R=víctima debe hacer clic/visitar |
| **Scope (S)** | U/C | U=impacto en el mismo componente; C=afecta otros |
| **Confidentiality (C)** | N/L/H | H=acceso total a datos confidenciales |
| **Integrity (I)** | N/L/H | H=modificar todos los datos críticos |
| **Availability (A)** | N/L/H | H=DoS completo posible |

### Ejemplos de scores comunes

| Vuln | AV | AC | PR | UI | S | C | I | A | Score |
|------|----|----|----|----|---|---|---|---|-------|
| RCE sin auth (internet) | N | L | N | N | U | H | H | H | **9.8 Critical** |
| SQLi auth requerida | N | L | L | N | U | H | H | H | **8.8 High** |
| Stored XSS admin→admin | N | L | H | N | C | L | L | N | **5.5 Medium** |
| CSRF (registro) | N | L | N | R | U | L | L | N | **5.4 Medium** |
| IDOR (leer datos) | N | L | L | N | U | L | N | N | **4.3 Medium** |
| Info Disclosure mínima | N | L | N | N | U | L | N | N | **5.3 Medium** |

---

## CWE — Referencias más comunes en web

| CWE | Nombre | Vulnerabilidad |
|-----|--------|----------------|
| CWE-79 | Improper Neutralization of Input During Web Page Generation | XSS (stored, reflected, DOM) |
| CWE-89 | Improper Neutralization of Special Elements used in an SQL Command | SQL Injection |
| CWE-352 | Cross-Site Request Forgery (CSRF) | CSRF |
| CWE-502 | Deserialization of Untrusted Data | Java deserialization, pickle |
| CWE-918 | Server-Side Request Forgery (SSRF) | SSRF |
| CWE-94 | Improper Control of Generation of Code | SSTI, code injection |
| CWE-78 | Improper Neutralization of Special Elements used in an OS Command | Command injection |
| CWE-22 | Improper Limitation of a Pathname to a Restricted Directory | Path traversal / LFI |
| CWE-287 | Improper Authentication | Auth bypass, weak auth |
| CWE-284 | Improper Access Control | IDOR, BOLA, BFLA |
| CWE-200 | Exposure of Sensitive Information to an Unauthorized Actor | Info disclosure |
| CWE-862 | Missing Authorization | Missing auth checks |

---

## Ejemplos de reportes — Resumen de estructura

### Stored XSS en panel de admin (CVSS 5.5 Medium)

```
Title: Stored XSS in X Admin Panel — File Upload Filename
CWE: CWE-79
CVSS: 5.5 (Medium) — AV:N/AC:L/PR:H/UI:N/S:C/C:L/I:L/A:N

POC:
1. Login como admin → Admin Info → Secure Data Transfer → Load of Data
2. Subir archivo con nombre: "><svg onload=alert(document.cookie)>.docx
3. Otro admin visita la página de archivos → JS ejecutado en su browser
4. Cookie del admin capturada → session hijacking posible

Impact: Cualquier admin puede atacar a otros admins → session hijacking,
        defacement del panel, acciones no autorizadas en nombre de admin
```

### CSRF en registro de consumer (CVSS 5.4 Medium)

```
Title: CSRF in Consumer Registration — Involuntary API Key Creation
CWE: CWE-352
CVSS: 5.4 (Medium) — AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N

POC:
1. Capturar request POST a /consumer-registration con Burp (sin anti-CSRF token)
2. Crear HTML malicioso con <form method="POST" action="/consumer-registration">
3. Enviar el link al target con sesión activa
4. La víctima visita la página → crea app fintech como la víctima sin saberlo

Impact: Creación de aplicaciones y API keys sin consentimiento del usuario
```

### RCE via Deserialization (CVSS 9.8 Critical)

```
Title: IBM WebSphere Java Object Deserialization RCE
CWE: CWE-502
CVSS: 9.8 (Critical) — AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H

POC:
1. Capturar request a puerto 8880 → body contiene "rO0" (base64 Java object)
2. Craftar SOAP request con payload serializado para Apache Commons Collections
3. Enviar request → servidor ejecuta el comando embebido (ping hacia nuestro host)
4. Verificar con Wireshark → ICMP request recibida desde el target

Impact: RCE como usuario del proceso WebSphere → acceso total al sistema
```

---

## Comunicación con el triage

```
DO:
  ✓ Esperar el SLA antes de hacer follow-up
  ✓ Anotar username del triage member → taggear en futuros mensajes
  ✓ Responder con datos técnicos y calma
  ✓ Si desacuerdo en severity → explicar métricas CVSS paso a paso
  ✓ Si el programa incumple → escalar a "Mediation" en la plataforma

DON'T:
  ✗ Spam al equipo de triage en días seguidos
  ✗ Contactar por canales no oficiales (Twitter, LinkedIn, email personal)
  ✗ Amenazar con disclosure antes del plazo pactado
  ✗ Divulgar públicamente sin autorización del programa
  ✗ Escalar antes de intentar resolver la discrepancia directamente
```

### Estados comunes del reporte

| Estado | Significado |
|--------|-------------|
| New | Recibido, pendiente de revisión |
| Pending Program Review | El triage lo ha revisado, espera al vendor |
| Triaged | Aceptado como válido, en proceso |
| Needs more info | Triage pide más detalles/pasos para reproducir |
| Informative | No es un bug explotable, solo información |
| Not Applicable | Out of scope o no vuln |
| Duplicate | Ya reportado por otro hunter |
| Resolved | Fix aplicado |

---

## Pitfalls / Gotchas

- **Scope = ley:** testear fuera de scope puede resultar en ban de la plataforma y consecuencias legales. Verificar dominio exacto incluyendo subdominios.
- **"First reporter" ≠ tu reporte primero:** si alguien envió el mismo bug antes (aunque sea minutos antes), probablemente sea "Duplicate". Moverse rápido al encontrar bugs críticos.
- **CVSS ≠ bounty amount:** el programa define su propia tabla. Un 9.8 puede dar $50 o $50,000 según el programa. Leer la reward policy antes de invertir tiempo.
- **VDP ≠ BBP:** si el programa es VDP, no hay recompensa monetaria. No confundir al seleccionar targets.
- **Reproducibilidad es lo más importante del reporte:** si el triage no puede reproducir → "Needs more info" o cierre. Incluir headers completos, cookies, versión del browser si relevante.
- **Impacto de negocio para audiencias no técnicas:** algunas empresas menos maduras necesitan que el impacto se traduzca a términos de negocio: pérdida de datos de clientes, multas GDPR, daño reputacional.
- **No escalar a Mediation prematuramente:** Mediation es el último recurso. Intentar primero resolver la discrepancia directamente con el equipo de triage.
- **Plazo de disclosure responsable:** la mayoría son 90 días. Si el fix no llega, se puede divulgar públicamente al vencer el plazo, pero avisar al programa con antelación.

---

## Cheatsheets relacionados

- [Web Fuzzing](/metodologias/recon/web-fuzzing/) — recon de subdominios y endpoints para bug bounty
- [JavaScript Deobfuscation](/metodologias/recon/javascript-deobfuscation/) — encontrar endpoints y secrets en JS
- [Broken Authentication](/metodologias/web/broken-authentication/) — vulnerabilidades de auth frecuentes en BBP
- [Server-side Attacks](/metodologias/web/server-side-attacks/) — SSRF, SSTI — bugs de alto impacto en BBP
- [API Attacks](/metodologias/web/api-attacks/) — API security bugs — categoría muy valorada en BBP
- [Attacking GraphQL](/metodologias/web/attacking-graphql/) — GraphQL bugs emergentes en BBP
