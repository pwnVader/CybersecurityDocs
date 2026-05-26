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
    <div><span class="text-slate-500">INDEXED   ·</span> <span class="text-slate-200">System Study Notes & Labs</span></div>
    <div><span class="text-sky-400 font-semibold animate-pulse">● READY</span></div>
  </div>
  
  <p class="text-slate-300 text-[0.85rem]">
    Welcome to the central documentation hub. Here you will find the general structure of my technical study guides and detailed resolutions of practical labs.
  </p>
</div>

## 📑 Table of Contents

---

### 🚩 1. Writeups (Lab Walkthroughs)
Step-by-step documentation of controlled environments and competitive machines focused on practical intrusion solving.

*   **HackTheBox (HTB):** 
    *   **HTB Academy (CPTS):** Structured and technical writeups of the official modules for the *Certified Penetration Testing Specialist* certification.
    *   **HTB Academy (COAE):** Apuntes and writeups of the practical syllabus on artificial intelligence and LLM Red Teaming (*Certified Out-of-Distribution AI Engineer*).
    *   **HTB Machines:** Detailed walkthroughs of active and retired machines from the competitive platform.
*   **TryHackMe (THM):** Resolution of thematic rooms focused on specific networking concepts and exploitation of common vulnerabilities.
*   **CTFs & Challenges:** Selected writeups of Capture The Flag style competitions.

---

### 🧠 2. Methodologies (Technical Pentesting Guides)
Structured compilation of attack vectors, key commands, and corporate intrusion methodologies based on professional certification standards.

*   **Fundamentals & Methodology:** Introduction to the pentesting process, corporate scoping, technical reporting, and web application basics.
*   **Recon & Enumeration:** Advanced passive and active information gathering, advanced scanning with Nmap, web discovery, and JavaScript deobfuscation.
*   **Web Exploitation:** Analysis and exploitation of OWASP Top 10 vulnerabilities (SQL Injection, XSS, File Inclusion, API Attacks, GraphQL, etc.).
*   **Common Services:** Enumeration and attacks against standard network services (SMB, FTP, SSH, RDP, DNS, LDAP, etc.).
*   **Exploitation & Foothold:** Shell and payload generation, basic antivirus evasion, and advanced usage of the Metasploit framework.
*   **Privilege Escalation:** Vertical movement techniques and privilege elevation on Linux and Windows operating systems.
*   **Active Directory:** Offensive auditing against Windows domain infrastructures (Kerberoasting, BloodHound, ACL abuses, delegation, etc.).
*   **Pivoting & Lateral Movement:** Internal routing, tunneling, port forwarding, and lateral movement techniques in corporate networks.

---

<aside class="my-6 p-5 rounded-xl border border-slate-800/50 bg-slate-900/30 backdrop-blur-sm not-prose">
  <div class="text-[10px] uppercase tracking-widest text-sky-400 font-semibold mb-2 font-mono flex items-center gap-2">
    <Icon name="ui-terminal" class="w-3 h-3 text-sky-400" />
    Recommended Command
  </div>
  <p class="text-sm text-slate-300 leading-relaxed font-mono">
    Use the global search (<kbd class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs">Ctrl</kbd> + <kbd class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs">K</kbd>) to instantly filter by commands, tools, or specific vulnerability names across the entire hub.
  </p>
</aside>
