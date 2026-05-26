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
    <div class="flex items-center gap-2">
      <Icon name="ui-terminal" class="w-4 h-4 text-sky-400" />
      <span>SYSTEM INDEX · v1.0.0</span>
    </div>
    <div><span class="text-sky-400 font-semibold animate-pulse">● LOADED</span></div>
  </div>
  
  <p class="text-slate-300 text-[0.82rem] leading-relaxed">
    Nexo central de documentación y guías de estudio táctico. Este panel proporciona una visión estructurada de los laboratorios resueltos y los frameworks metodológicos de pentesting.
  </p>
</div>

## 1. Writeups & Laboratorios

Resolución técnica de entornos controlados y de intrusión en máquinas de seguridad ofensiva.

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">

  <div class="p-5 bg-slate-900/25 border border-slate-800/40 rounded-lg flex gap-4">
    <Icon name="tech-htb" class="w-10 h-10 text-sky-400 shrink-0" />
    <div>
      <h3 class="text-slate-200 font-mono font-semibold text-sm mb-1.5">HackTheBox</h3>
      <p class="text-slate-400 text-xs leading-relaxed">
        Writeups detallados de los módulos de <strong>HTB Academy (CPTS / COAE)</strong> y resolución práctica de máquinas activas/retiradas enfocadas en compromiso de infraestructuras.
      </p>
    </div>
  </div>

  <div class="p-5 bg-slate-900/25 border border-slate-800/40 rounded-lg flex gap-4">
    <Icon name="social-thm" class="w-10 h-10 text-sky-400 shrink-0" />
    <div>
      <h3 class="text-slate-200 font-mono font-semibold text-sm mb-1.5">TryHackMe</h3>
      <p class="text-slate-400 text-xs leading-relaxed">
        Guías de resolución de salas temáticas enfocadas en la comprensión práctica de redes y explotación de vulnerabilidades comunes de red.
      </p>
    </div>
  </div>

</div>

## 2. Notas Metodológicas

Compilación ordenada de comandos clave, vectores de ataque y guías estructuradas basadas en las principales certificaciones profesionales del sector.

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6 font-mono text-xs">

  <div class="p-4 bg-slate-900/15 border border-slate-800/30 rounded-lg">
    <div class="flex items-center gap-2.5 mb-2.5 text-sky-400 font-semibold">
      <Icon name="ui-book" class="w-4 h-4" />
      <span>FASES INICIALES</span>
    </div>
    <ul class="text-slate-400 space-y-1.5 list-none pl-0">
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Fundamentos:</strong> Procesos corporativos de auditoría, scoping y documentación técnica.</span>
      </li>
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Recon & Enumeración:</strong> Recopilación pasiva/activa y escaneo avanzado con Nmap.</span>
      </li>
    </ul>
  </div>

  <div class="p-4 bg-slate-900/15 border border-slate-800/30 rounded-lg">
    <div class="flex items-center gap-2.5 mb-2.5 text-sky-400 font-semibold">
      <Icon name="ui-globe" class="w-4 h-4" />
      <span>APLICACIONES WEB</span>
    </div>
    <ul class="text-slate-400 space-y-1.5 list-none pl-0">
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Web Exploitation:</strong> Vulnerabilidades OWASP Top 10, SQL Injection, XSS, APIs y GraphQL.</span>
      </li>
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Servicios Web:</strong> Análisis de gestores de contenido, APIs e inyecciones avanzadas.</span>
      </li>
    </ul>
  </div>

  <div class="p-4 bg-slate-900/15 border border-slate-800/30 rounded-lg">
    <div class="flex items-center gap-2.5 mb-2.5 text-sky-400 font-semibold">
      <Icon name="ui-terminal" class="w-4 h-4" />
      <span>EXPLOTACIÓN & SISTEMAS</span>
    </div>
    <ul class="text-slate-400 space-y-1.5 list-none pl-0">
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Foothold & Payload:</strong> Generación de shells y payloads, Metasploit y evasión básica.</span>
      </li>
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Escalada de Privilegios:</strong> Elevación de privilegios en sistemas Linux y Windows.</span>
      </li>
    </ul>
  </div>

  <div class="p-4 bg-slate-900/15 border border-slate-800/30 rounded-lg">
    <div class="flex items-center gap-2.5 mb-2.5 text-sky-400 font-semibold">
      <Icon name="ui-flag" class="w-4 h-4" />
      <span>INFRAESTRUCTURA & DOMINIO</span>
    </div>
    <ul class="text-slate-400 space-y-1.5 list-none pl-0">
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Active Directory:</strong> Auditoría ofensiva de dominios Windows, delegación y ACLs.</span>
      </li>
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Pivoting & Túneles:</strong> Enrutamiento interno, port forwarding y saltos laterales de red.</span>
      </li>
    </ul>
  </div>

</div>

<aside class="my-6 p-5 rounded-xl border border-slate-800/50 bg-slate-900/30 backdrop-blur-sm not-prose">
  <p class="text-xs text-slate-400 leading-relaxed font-mono">
    Utiliza el buscador global (<kbd class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300">Ctrl</kbd> + <kbd class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300">K</kbd>) para filtrar de forma inmediata por comandos, herramientas o nombres específicos de vulnerabilidades en todo el repositorio.
  </p>
</aside>
