---
title: "Documentation & Reporting"
description: "Notas, evidencia y entrega del reporte final de pentest."
sidebar:
  order: 3
  label: "Documentation & Reporting"
---
> Notetaking estructurado, gestión de evidencias y redacción de reportes de pentest. El reporte es el entregable final que el cliente paga — sin documentación sólida, el trabajo no existe.

---


## Estructura de carpetas del proyecto

```bash
mkdir -p CLIENTE-IPT/{Admin,Deliverables,Evidence/{Findings,Scans/{Vuln,Service,Web,'AD Enumeration'},Notes,OSINT,Wireless,'Logging output','Misc Files'},Retest}
```

| Carpeta | Contenido |
|---------|-----------|
| `Admin/` | SoW, notas del kickoff, status reports |
| `Deliverables/` | Report (draft y final), spreadsheet, slides |
| `Evidence/Findings/` | Una subcarpeta por finding con evidencias |
| `Evidence/Scans/` | Output de Nmap, Nessus, BloodHound, CME |
| `Evidence/Notes/` | Notas del engagement |
| `Evidence/Logging output/` | Logs de Tmux, Metasploit |
| `Evidence/Misc Files/` | Webshells, payloads, scripts custom |
| `Retest/` | Retesting separado del assessment original |

---

## Estructura de notas (secciones mínimas)

| Sección | Propósito |
|---------|-----------|
| **Attack Path** | Outline completo: foothold → DA, con screenshots y output |
| **Credentials** | Repositorio centralizado de creds comprometidas |
| **Findings** | Una entrada por finding (narrativa + evidencia) |
| **Activity Log** | Registro cronológico de acciones (para correlación de eventos) |
| **Payload Log** | Hash + path de cada payload subido al target |
| **Scoping Information** | IPs/CIDRs, URLs, credenciales de cliente |
| **Service Enumeration Research** | Qué servicios se investigaron, qué falló |
| **AD Enumeration Research** | BloodHound, PowerView, paso a paso |
| **Web Application Research** | Apps encontradas, creds probadas |
| **OSINT** | Datos públicos recopilados |

---

## Tmux Logging — Setup

```bash
# 1. Instalar plugin manager
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

# 2. Crear .tmux.conf
cat > ~/.tmux.conf << 'EOF'
set -g @plugin 'tmux-plugins/tpm'
set -g @plugin 'tmux-plugins/tmux-sensible'
set -g @plugin 'tmux-plugins/tmux-logging'
set -g history-limit 50000
run '~/.tmux/plugins/tpm/tpm'
EOF

# 3. Cargar config
tmux source ~/.tmux.conf

# 4. Nueva sesión → instalar plugins
tmux new -s pentest
# Dentro: Ctrl+B → Shift+I (instala plugins)
```

```
Atajos clave de tmux-logging:
  Ctrl+B → Shift+P     → Start/stop logging de la pane actual
  Ctrl+B → Alt+Shift+P → Logging retroactivo de toda la pane
  Ctrl+B → Alt+P       → Screenshot de la pane actual (sin mezclar output)
  Ctrl+B → Alt+C       → Limpiar historial de pane
```

---

## Payload Log — Qué registrar

Por cada payload/tool subido al target:

| Campo | Ejemplo |
|-------|---------|
| Timestamp | 2026-05-16 14:32 UTC |
| Host objetivo | 192.168.1.50 (WEB01) |
| Path en target | C:\Windows\Temp\winpeas.exe |
| Hash SHA256 | `sha256sum winpeas.exe` |
| Eliminado | Sí / No (pendiente cleanup) |

> **Tip examen:** Si creaste cuentas o modificaste configuraciones, documenta hostname, timestamp, descripción y nombre de cuenta. El cliente puede pedirte que las reviertas.

---

## Tipos de reporte

| Tipo | Cuándo |
|------|--------|
| **Vulnerability Assessment** | Solo escaneo, sin explotación |
| **Internal Penetration Test** | Desde dentro de la red |
| **External Penetration Test** | Desde internet, perspectiva de atacante anónimo |
| **Draft Report** | Entrega inicial → feedback del cliente |
| **Final Report** | Tras incorporar feedback del cliente |
| **Post-Remediation Report** | Retest de findings específicos (no nuevo assessment completo) |
| **Attestation Letter** | 1-2 páginas para terceros/auditores (sin detalles técnicos) |
| **Vulnerability Notification** | RCE/data exposure crítico → notificar out-of-band inmediato |

---

## Componentes del reporte

### Estructura completa

```
1. Cover Page
2. Table of Contents
3. Executive Summary          ← escrita para no-técnicos
4. Summary of Recommendations ← short/medium/long term
5. Attack Chain               ← cadena de explotación end-to-end
6. Findings                   ← un finding = una sección
7. Appendices
   - Scope
   - Methodology
   - Severity Ratings
   - Biographies (requerido para PCI)
   - Exploitation Attempts Log
   - Password Analysis (si dumpeaste NTDS)
   - AD Hardening (best practices observadas)
```

---

## Attack Chain — Cómo escribirla

```
Estructura:
1. Resumen ejecutivo de la cadena (1 párrafo)
2. Pasos numerados con contexto narrativo
3. Por cada paso: comando + output relevante (<SNIP> para output largo)
4. Conectar findings: "Combined with finding H2, this elevated severity from Medium to High"
```

**Ejemplo de cadena típica (Internal PT):**
```
1. Responder → captura NTLMv2 de bsmith
2. Hashcat -m 5600 → cleartext password → foothold en dominio
3. BloodHound → detecta mssqlsvc con SPN + admin sobre SQL01
4. GetUserSPNs.py → Kerberoasting de mssqlsvc → crack hash
5. CrackMapExec → LSA secrets en SQL01 → cleartext de srvadmin
6. Query users en MS01 → pramirez logueado con DCSync rights
7. Rubeus dump → TGT de pramirez → Pass-the-Ticket
8. Mimikatz lsadump::dcsync → hash de Administrator → DA
```

---

## Executive Summary — Reglas

### Hacer
- Escribir para alguien no-técnico ("si tus padres no lo entienden, reescribelo")
- Ser específico con métricas: "encontramos 7 vulnerabilidades, 5 de severidad alta"
- Describir impacto en negocio: "acceso a documentos de RRHH y sistemas de banca"
- Mantener 1-2 páginas máximo
- Mencionar lo que el cliente hace bien (ej: patching maduro)
- Dar contexto de esfuerzo de remediación (bajo/medio/significativo)

### No hacer
- Usar acrónimos: no SMB, NBT-NS, TGT, PtH — usar descripción en plain English
- Recomendar vendors específicos (CrowdStrike, Splunk)
- Referenciar secciones técnicas del reporte
- Hablar de "varios/múltiples" sin dar número exacto
- Más de 2 páginas

### Vocabulario no-técnico

| Término técnico | Alternativa ejecutiva |
|----------------|----------------------|
| Hash | "forma cifrada de la contraseña" |
| Password spraying | "ataque con contraseña común en miles de cuentas" |
| Kerberoasting | "robo de ticket de autenticación para crackear offline" |
| LLMNR spoofing | "protocolo de red inseguro que permite interceptar credenciales" |
| Domain Admin | "cuenta con acceso a todos los sistemas de la organización" |
| SQL injection | "vulnerabilidad que permite manipular la base de datos" |

---

## Gestión de evidencias

### Evidencia de terminal vs. screenshot

- **Preferir output de terminal** — más fácil de redactar, se puede copiar, no infla el .docx
- **Screenshot** — cuando no puedes copiar terminal (GUI, browser)
- **Nunca alterar output** — puedes usar `<SNIP>` para recortar, pero no cambiar lo real
- **Eliminar caracteres especiales** — el copy-paste desde Word puede insertar comillas tipográficas que rompen comandos

### Redacción de credenciales

```
Terminal output:
- Contraseñas: reemplazar con <REDACTED> o <PASSWORD REDACTED>
- Hashes: mostrar primeros/últimos 4 caracteres: e4a...ba2

Screenshots:
- NO pixelar/difuminar (reversible con Unredacter)
- Usar barra sólida negra directamente sobre el texto
- Editar la imagen, no aplicar forma en Word (puede borrarse)
```

### Qué NO archivar

- PII sin redactar (DNI, SSN, datos bancarios)
- Contenido de archivos sensibles — screenshot del directorio es suficiente
- Data que requiera cumplimiento GDPR/HIPAA para almacenar

---

## Summary of Recommendations

Priorizar en tres horizontes:

| Plazo | Tipo | Ejemplo |
|-------|------|---------|
| **Corto** | Fix específico y accionable | Parchear CVE-XXXX, cambiar contraseña default |
| **Medio** | Proceso/configuración | Implementar política de contraseñas fuertes |
| **Largo** | Programa/madurez | Establecer programa de vulnerability management |

> **Tip examen:** Un finding puede tener recomendación corto Y largo plazo. Ej: parche inmediato + revisión del proceso de patch management.

---

## Pitfalls / Gotchas

- **Retest ≠ nuevo assessment:** el post-remediation report solo cubre los findings originales en los hosts originales. Si haces nuevos scans, encontrarás nuevas cosas y el scope se dispara.
- **Draft antes que final:** siempre entregar draft primero. Los auditores de PCI no aceptan drafts para cumplimiento.
- **Snapshot en el tiempo:** siempre especificar fechas exactas ("testing realizado del 7 al 19 de enero de 2026"). Los cambios posteriores no están cubiertos.
- **Retroactive Tmux logging:** si olvidaste activar el log, usa `prefix + Alt+Shift+P`. Pero depende del scrollback buffer — configura `history-limit 50000` desde el inicio.
- **Artefactos dejados:** si no puedes limpiar shells o herramientas, documentar en el reporte. Nunca quedarse callado.
- **Atribución de lentitud de red:** siempre tener logs de herramientas y timestamps exactos. Te pueden culpar de cualquier problema de red durante el engagement.
- **Scope creep en retest:** limitar el tiempo de aceptación de retest. Si el cliente pide retest 1 año después, el entorno habrá cambiado y la comparación no será válida.
- **Executive Summary acusatorio:** no insinuar que el cliente hizo algo intencionalmente mal. Usa "parece indicar" en vez de afirmaciones absolutas (ej: "parece que las actividades de testing no fueron detectadas").
- **Creds en el reporte Word:** verificar que no queden hashes completos ni passwords en texto plano en el documento final. Revisar con búsqueda en el .docx.
- **Tmux panes mezclados:** usar screenshot de pane (`prefix + Alt+P`) cuando tienes split panes para capturar output limpio de cada herramienta.

---

## Cheatsheets relacionados

- [Penetration Testing Process](/metodologias/fundamentos/penetration-testing-process/) — fases del pentest que determina qué documentar
- [Active Directory Enumeration & Attacks](/metodologias/active-directory/active-directory-enumeration-attacks/) — BloodHound, datos que capturas y reportas
- [Password Attacks](/metodologias/exploitation/password-attacks/) — análisis de contraseñas del dominio para appendix
- [Attacking Enterprise Networks](/metodologias/active-directory/attacking-enterprise-networks/) — engagement completo donde aplica todo esto
