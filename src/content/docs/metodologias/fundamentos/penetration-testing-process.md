---
title: "Penetration Testing Process"
description: "Metodología, fases y mindset del pentest profesional."
sidebar:
  order: 1
  label: "Penetration Testing Process"
---
> Módulo metodológico. No hay comandos: hay **fases, checklists y orden de operaciones**. Memorízate este flujo — es el esqueleto sobre el que apoyan todos los demás módulos.

---


## Pre-Engagement

### Documentos legales obligatorios

| Documento | Para qué sirve |
|---|---|
| **NDA** (Non-Disclosure Agreement) | Confidencialidad de hallazgos |
| **SoW** (Statement of Work) | Define entregables y plazos |
| **MSA** (Master Service Agreement) | Términos generales del contrato |
| **RoE** (Rules of Engagement) | Qué SÍ y qué NO puedes hacer |

### Scoping Questionnaire — preguntas clave

- ¿Tipo de assessment? (black/grey/white-box)
- ¿Cuántas IPs / dominios / aplicaciones en scope?
- ¿Internal, external, web app, wireless, social engineering?
- ¿Horarios permitidos? (24/7 vs. business hours)
- ¿DoS permitido? (casi siempre **NO**)
- ¿Pivoting permitido entre subredes?
- ¿Punto de contacto técnico + número de emergencia?
- ¿Notificación previa al SOC? (announced vs. unannounced)

### Rules of Engagement — checklist

- [ ] IP/rango de origen del pentester definido
- [ ] Sistemas excluidos (production-critical, prod DBs)
- [ ] Técnicas prohibidas (DoS, social eng., physical)
- [ ] Ventana de tiempo del engagement
- [ ] Procedimiento de escalación si "rompes algo"
- [ ] Procedimiento si encuentras evidencia de breach previo
- [ ] Datos sensibles → ¿se pueden exfiltrar para PoC?

### Kick-Off Meeting — agenda mínima

- Confirmar scope final
- Intercambio de contactos (técnico + ejecutivo)
- Canal seguro de comunicación (Signal, PGP email)
- Plan de reporte de hallazgos críticos en tiempo real
- Confirmar credenciales de prueba si grey/white-box

---

## Information Gathering

Cuatro sub-fases. Profundizar en cheatsheets específicos.

| Sub-fase | Cheatsheet relacionado |
|---|---|
| **OSINT** (público, sin tocar al target) | [Information Gathering - Web Edition](/metodologias/recon/information-gathering-web/) |
| **Infrastructure Enumeration** (rangos, ASN, DNS) | [Information Gathering - Web Edition](/metodologias/recon/information-gathering-web/) |
| **Service Enumeration** (port scan + banner) | [Network Enumeration with Nmap](/metodologias/recon/network-enumeration-nmap/) |
| **Host Enumeration** (per-service deep) | [Footprinting](/metodologias/recon/footprinting/) |

**Pillaging** = recolección de info *después* del foothold. No confundir con OSINT inicial.

---

## Vulnerability Assessment

Dos productos finales:

1. **Lista priorizada de vulnerabilidades** (CVSS + exploitability + business impact)
2. **Mapa de attack vectors** (qué vuln lleva a qué activo)

Ver [Vulnerability Assessment](/metodologias/fundamentos/vulnerability-assessment/) para herramientas (Nessus, OpenVAS, scoring).

> ⚠️ **VA ≠ Pentest.** VA solo identifica; pentest explota. En el reporte deja claro qué fue *confirmed* (explotado) vs *theoretical*.

---

## Exploitation

### Priorización (la pregunta clave: ¿por dónde empiezo?)

```
Score = (Probability of success) × (Impact) × (1 / Detection risk)
```

Atacar primero lo de **alta probabilidad + bajo ruido**. Guardar lo ruidoso para después (o nunca, si RoE lo limita).

### Preparación pre-ataque (checklist)

- [ ] Exploit probado en lab idéntico (no en prod a ciegas)
- [ ] Rollback plan si el target se cae
- [ ] Logging local activo (asciinema, script, tmux capture)
- [ ] Listener preparado ([Shells & Payloads](/metodologias/exploitation/shells-payloads/))
- [ ] Timestamp de inicio anotado

---

## Post-Exploitation

Orden recomendado tras el foothold:

```
1. Situational awareness (whoami, hostname, ip, OS, AV)
2. Information Gathering local (procesos, conns, users)
3. Pillaging (credenciales, configs, docs, hashes)
4. Persistence (si RoE lo permite — opcional)
5. Privilege Escalation → [Linux Privilege Escalation](/metodologias/privesc/linux-privilege-escalation/) / [Windows Privilege Escalation](/metodologias/privesc/windows-privilege-escalation/)
6. Data Exfiltration (solo lo necesario para PoC, cifrado)
```

> ⚠️ **Evasive testing:** si el RoE exige sigilo, deshabilita scripts ruidosos y prefiere binarios LOLBAS/GTFOBins.

---

## Lateral Movement

Tras privesc, repites el ciclo desde el nuevo host:
**Pivoting** → **Info Gathering interno** → **Vuln Assessment** → **Exploitation** → **Post-Ex**.

Ver [Pivoting, Tunneling, and Port Forwarding](/metodologias/pivoting/pivoting-tunneling-port-forwarding/) para mecánica.

---

## Proof-of-Concept

El PoC debe ser **reproducible, mínimo y documentado**. Estructura típica:

```markdown
## Vulnerability: <nombre>
- Affected asset: <ip/hostname/url>
- Severity: <CVSS>
- Steps to reproduce:
  1. <comando exacto>
  2. <captura/output>
- Impact: <qué consigue el atacante>
- Remediation: <fix recomendado>
```

---

## Post-Engagement

### Cleanup checklist

- [ ] Eliminar todos los webshells / payloads subidos
- [ ] Borrar usuarios creados (`net user x /delete`)
- [ ] Revertir cambios de config / firewall rules
- [ ] Limpiar tareas programadas / servicios añadidos
- [ ] Confirmar al cliente artifact-by-artifact

### Reporting — secciones obligatorias

1. Executive Summary (1 página, sin jerga)
2. Scope & Methodology
3. Findings (ordenadas por severidad)
4. Technical Details (con PoC)
5. Remediation Recommendations
6. Appendix (tools, timeline, logs)

Detalles: [Documentation & Reporting](/metodologias/fundamentos/documentation-reporting/).

### Data Retention

Borrar evidencia tras período acordado (típico: 30-90 días post-entrega del reporte final).

---

## Pitfalls comunes en examen

- **Empezar a escanear antes de tener el contrato firmado** → no.
- Confundir **OSINT** (pre-acceso, público) con **Pillaging** (post-acceso, en el host).
- Olvidar que **Lateral Movement reabre las fases anteriores** desde el nuevo host.
- Saltarse Vulnerability Assessment y "tirar exploits a ciegas" → en examen perderás tiempo.
- No documentar timestamps → en el reporte CPTS necesitas timeline.

---

## Cheatsheets relacionados

- [Getting Started](/metodologias/fundamentos/getting-started/) — Setup técnico previo al engagement
- [Documentation & Reporting](/metodologias/fundamentos/documentation-reporting/) — Cómo entregar el reporte
