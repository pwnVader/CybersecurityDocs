---
title: Home
description: General index of offensive methodology study notes and technical writeups.
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
    Central documentation hub and tactical study guides. This panel provides a structured overview of solved labs and pentesting methodological frameworks.
  </p>
</div>

## 1. Writeups & Labs

Technical resolution of controlled environments and machine intrusions in offensive security.

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">

  <div class="p-5 bg-slate-900/25 border border-slate-800/40 rounded-lg flex gap-4">
    <Icon name="tech-htb" class="w-10 h-10 text-sky-400 shrink-0" />
    <div>
      <h3 class="text-slate-200 font-mono font-semibold text-sm mb-1.5">HackTheBox</h3>
      <p class="text-slate-400 text-xs leading-relaxed">
        Detailed writeups of <strong>HTB Academy (CPTS / COAE)</strong> modules and practical resolution of active/retired machines focused on infrastructure compromise.
      </p>
    </div>
  </div>

  <div class="p-5 bg-slate-900/25 border border-slate-800/40 rounded-lg flex gap-4">
    <Icon name="social-thm" class="w-10 h-10 text-sky-400 shrink-0" />
    <div>
      <h3 class="text-slate-200 font-mono font-semibold text-sm mb-1.5">TryHackMe</h3>
      <p class="text-slate-400 text-xs leading-relaxed">
        Walkthroughs of thematic rooms focused on the practical understanding of networks and the exploitation of common vulnerabilities.
      </p>
    </div>
  </div>

</div>

## 2. Methodological Notes

Ordered compilation of key commands, attack vectors, and structured guides based on the main professional certifications in the sector.

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6 font-mono text-xs">

  <div class="p-4 bg-slate-900/15 border border-slate-800/30 rounded-lg">
    <div class="flex items-center gap-2.5 mb-2.5 text-sky-400 font-semibold">
      <Icon name="ui-book" class="w-4 h-4" />
      <span>INITIAL PHASES</span>
    </div>
    <ul class="text-slate-400 space-y-1.5 list-none pl-0">
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Fundamentals:</strong> Corporate scoping, auditing processes, and technical reporting.</span>
      </li>
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Recon & Enumeration:</strong> Active/passive gathering and advanced scanning with Nmap.</span>
      </li>
    </ul>
  </div>

  <div class="p-4 bg-slate-900/15 border border-slate-800/30 rounded-lg">
    <div class="flex items-center gap-2.5 mb-2.5 text-sky-400 font-semibold">
      <Icon name="ui-globe" class="w-4 h-4" />
      <span>WEB APPLICATIONS</span>
    </div>
    <ul class="text-slate-400 space-y-1.5 list-none pl-0">
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Web Exploitation:</strong> OWASP Top 10, SQL Injection, XSS, APIs, and GraphQL.</span>
      </li>
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Web Services:</strong> CMS analysis, unprotected APIs, and advanced injections.</span>
      </li>
    </ul>
  </div>

  <div class="p-4 bg-slate-900/15 border border-slate-800/30 rounded-lg">
    <div class="flex items-center gap-2.5 mb-2.5 text-sky-400 font-semibold">
      <Icon name="ui-terminal" class="w-4 h-4" />
      <span>EXPLOITATION & SYSTEMS</span>
    </div>
    <ul class="text-slate-400 space-y-1.5 list-none pl-0">
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Foothold & Payload:</strong> Shell and payload generation, Metasploit, and basic evasion.</span>
      </li>
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Privilege Escalation:</strong> Privilege elevation on Linux (SUID, sudo) and Windows systems.</span>
      </li>
    </ul>
  </div>

  <div class="p-4 bg-slate-900/15 border border-slate-800/30 rounded-lg">
    <div class="flex items-center gap-2.5 mb-2.5 text-sky-400 font-semibold">
      <Icon name="ui-flag" class="w-4 h-4" />
      <span>INFRASTRUCTURE & DOMAIN</span>
    </div>
    <ul class="text-slate-400 space-y-1.5 list-none pl-0">
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Active Directory:</strong> Offensive auditing of Windows domains, delegation, and ACLs.</span>
      </li>
      <li class="flex items-baseline gap-1.5">
        <span class="text-sky-500 font-bold">></span>
        <span><strong>Pivoting & Tunnels:</strong> Internal routing, port forwarding, and lateral network hops.</span>
      </li>
    </ul>
  </div>

</div>

<aside class="my-6 p-5 rounded-xl border border-slate-800/50 bg-slate-900/30 backdrop-blur-sm not-prose">
  <p class="text-xs text-slate-400 leading-relaxed font-mono">
    Use the global search (<kbd class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300">Ctrl</kbd> + <kbd class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300">K</kbd>) to instantly filter by commands, tools, or specific vulnerability names across the entire hub.
  </p>
</aside>
