---
title: Home
description: Índice general de notas de estudio de metodologías ofensivas y writeups técnicos.
prev: false
next: false
sidebar:
  label: Home
  order: -1
---

import { Icon } from 'astro-icon/components';

<div class="cyber-terminal p-6 font-mono text-sm leading-relaxed space-y-4 bg-slate-900/30 backdrop-blur-sm border border-slate-800/50 rounded-xl my-6">
  <div class="text-xs border-b border-slate-800/40 pb-4 flex items-center justify-between">
    <div><span class="text-slate-500">INDEXED   ·</span> <span class="text-slate-200">System Study Notes & Labs</span></div>
    <div><span class="text-sky-400 font-semibold animate-pulse">● READY</span></div>
  </div>
  
  <p class="text-slate-300 text-[0.85rem]">
    Bienvenido al nexo central de la documentación. Aquí encontrarás la estructura general de mis guías de estudio técnico y la resolución detallada de laboratorios prácticos.
  </p>
</div>

## 📑 Índice de Contenidos

---

### 🚩 1. Writeups (Resolución de Laboratorios)
Documentación paso a paso de entornos controlados y máquinas competitivas enfocadas en la resolución práctica de intrusiones.

*   **HackTheBox (HTB):** 
    *   **HTB Academy (CPTS):** Resolución estructurada y técnica de los módulos prácticos oficiales de la certificación *Certified Penetration Testing Specialist*.
    *   **HTB Academy (COAE):** Apuntes y writeups del temario práctico de inteligencia artificial y Red Teaming en LLMs (*Certified Out-of-Distribution AI Engineer*).
    *   **HTB Machines:** Análisis detallado de máquinas activas y retiradas de la plataforma competitiva.
*   **TryHackMe (THM):** Resolución de salas temáticas enfocadas en conceptos específicos de redes y explotación de vulnerabilidades comunes.
*   **CTFs & Desafíos:** Writeups selectos de competencias estilo Capture The Flag.

---

### 🧠 2. Metodologías (Guías Técnicas de Pentesting)
Recopilación ordenada y sistemática de vectores de ataque, comandos clave y metodologías de intrusión corporativa basadas en los estándares de certificaciones profesionales.

*   **Fundamentos & Metodología:** Introducción al proceso de pentesting, scoping corporativo, documentación técnica y bases de aplicaciones web.
*   **Recon & Enumeración:** Técnicas avanzadas de recopilación de información pasiva y activa, escaneo avanzado con Nmap, descubrimiento web y deobfuscación de JavaScript.
*   **Web Exploitation:** Análisis y explotación de vulnerabilidades OWASP Top 10 (SQL Injection, XSS, File Inclusion, API Attacks, GraphQL, etc.).
*   **Servicios Comunes:** Enumeración y ataques contra servicios de red estándar (SMB, FTP, SSH, RDP, DNS, LDAP, etc.).
*   **Exploitation & Foothold:** Generación de shells y payloads, evasión básica de antivirus y uso avanzado del framework Metasploit.
*   **Escalada de Privilegios:** Técnicas de movimiento vertical y elevación de privilegios en sistemas operativos Linux y Windows.
*   **Active Directory:** Auditoría ofensiva contra infraestructuras de dominio Windows (Kerberoasting, BloodHound, abusos de ACLs, delegación, etc.).
*   **Pivoting & Lateral Movement:** Técnicas de enrutamiento interno, túneles, port forwarding y saltos laterales en redes internas corporativas.

---

<aside class="my-6 p-5 rounded-xl border border-slate-800/50 bg-slate-900/30 backdrop-blur-sm not-prose">
  <div class="text-[10px] uppercase tracking-widest text-sky-400 font-semibold mb-2 font-mono flex items-center gap-2">
    <Icon name="ui-terminal" class="w-3 h-3 text-sky-400" />
    Comando Recomendado
  </div>
  <p class="text-sm text-slate-300 leading-relaxed font-mono">
    Utiliza el buscador global (<kbd class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs">Ctrl</kbd> + <kbd class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs">K</kbd>) para filtrar al instante por comandos, herramientas o nombres específicos de vulnerabilidades en todo el nexo.
  </p>
</aside>
