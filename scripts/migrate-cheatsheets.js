// scripts/migrate-cheatsheets.js
// Convierte cheatsheets Obsidian (CPTS_Cheatsheets, CWES_Cheatsheets)
// → Starlight (src/content/docs/metodologias/<bucket>/<slug>.md)
//
// Reglas:
//   1. Strip frontmatter Obsidian + sustituir por Starlight (title/description/sidebar.order/sidebar.label).
//   2. Eliminar el H1 explícito (Starlight lo renderiza desde frontmatter).
//   3. Strip emojis SOLO de líneas de header (## / ### …).
//   4. Convertir wikilinks [[X]] y [[X|alias]] a [text](/metodologias/<bucket>/<slug>/).
//   5. Eliminar "Volver al índice" y la firma final "*Cheatsheet del módulo: X*".
//   6. Normalizar separadores y trailing newline.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DEST_BASE = path.join(ROOT, 'src/content/docs/metodologias');
const SOURCES = ['CPTS_Cheatsheets', 'CWES_Cheatsheets'];

// ─── Mapeo único: filename (sin .md) → metadatos destino ──────────────
const MAP = {
  // Fundamentos & Metodología
  'Penetration Testing Process':              { bucket: 'fundamentos',      slug: 'penetration-testing-process',         order: 1,  label: 'Penetration Testing Process',         description: 'Metodología, fases y mindset del pentest profesional.' },
  'Getting Started':                          { bucket: 'fundamentos',      slug: 'getting-started',                      order: 2,  label: 'Getting Started',                      description: 'Setup base, herramientas y workflow inicial para auditorías ofensivas.' },
  'Documentation & Reporting':                { bucket: 'fundamentos',      slug: 'documentation-reporting',              order: 3,  label: 'Documentation & Reporting',            description: 'Notas, evidencia y entrega del reporte final de pentest.' },
  'Vulnerability Assessment':                 { bucket: 'fundamentos',      slug: 'vulnerability-assessment',             order: 4,  label: 'Vulnerability Assessment',             description: 'Nessus, OpenVAS y scoring CVSS para evaluación de vulnerabilidades.' },
  'Introduction to Web Applications':         { bucket: 'fundamentos',      slug: 'introduction-web-applications',        order: 5,  label: 'Introduction to Web Applications',     description: 'Arquitectura web, tecnologías, HTTP, cookies y seguridad básica.' },
  'Web Requests':                             { bucket: 'fundamentos',      slug: 'web-requests',                         order: 6,  label: 'Web Requests',                         description: 'HTTP/HTTPS con cURL, verbos, headers y autenticación.' },

  // Recon & Enumeración
  'Network Enumeration with Nmap':            { bucket: 'recon',            slug: 'network-enumeration-nmap',             order: 1,  label: 'Network Enumeration · Nmap',           description: 'Host discovery, port scanning, NSE, performance y evasión de firewall/IDS con Nmap.' },
  'Footprinting':                             { bucket: 'recon',            slug: 'footprinting',                         order: 2,  label: 'Footprinting',                         description: 'Enumeración por servicio: FTP, SMB, NFS, DNS, SMTP y más.' },
  'Information Gathering - Web Edition':      { bucket: 'recon',            slug: 'information-gathering-web',            order: 3,  label: 'Information Gathering · Web',          description: 'OSINT, subdominios, virtual hosts y WHOIS para targets web.' },
  'Web Fuzzing':                              { bucket: 'recon',            slug: 'web-fuzzing',                          order: 4,  label: 'Web Fuzzing · ffuf',                   description: 'Fuzzing de directorios, parámetros, subdominios y vhosts con bypass de WAF.' },
  'Attacking Web Applications with Ffuf':     { bucket: 'recon',            slug: 'attacking-web-applications-ffuf',      order: 5,  label: 'Attacking Web Apps · Ffuf',            description: 'Fuzzing de directorios, subdominios y parámetros para descubrimiento web.' },
  'JavaScript Deobfuscation':                 { bucket: 'recon',            slug: 'javascript-deobfuscation',             order: 6,  label: 'JavaScript Deobfuscation',             description: 'Análisis, deobfuscación y extracción de secretos en código JavaScript.' },

  // Web Exploitation
  'Using Web Proxies':                        { bucket: 'web',              slug: 'using-web-proxies',                    order: 1,  label: 'Using Web Proxies',                    description: 'Burp Suite, ZAP, intercepción y manipulación de tráfico HTTP.' },
  'Login Brute Forcing':                      { bucket: 'web',              slug: 'login-brute-forcing',                  order: 2,  label: 'Login Brute Forcing',                  description: 'Hydra, medusa, wordlists y ataques a formularios HTTP.' },
  'SQL Injection Fundamentals':               { bucket: 'web',              slug: 'sql-injection-fundamentals',           order: 3,  label: 'SQL Injection Fundamentals',           description: 'UNION, error-based, blind y técnicas manuales de SQLi.' },
  'SQLMap Essentials':                        { bucket: 'web',              slug: 'sqlmap-essentials',                    order: 4,  label: 'SQLMap Essentials',                    description: 'Automatización, tamper scripts, --os-shell y --dump con SQLMap.' },
  'Cross-Site Scripting (XSS)':               { bucket: 'web',              slug: 'cross-site-scripting-xss',             order: 5,  label: 'Cross-Site Scripting (XSS)',           description: 'Reflected, stored, DOM XSS, payloads y bypass de filtros.' },
  'Command Injections':                       { bucket: 'web',              slug: 'command-injections',                   order: 6,  label: 'Command Injections',                   description: 'Operadores, bypass de filtros, blind injection y técnicas de evasión.' },
  'File Upload Attacks':                      { bucket: 'web',              slug: 'file-upload-attacks',                  order: 7,  label: 'File Upload Attacks',                  description: 'Bypass de extensión/MIME, polyglots y webshells via file upload.' },
  'File Inclusion':                           { bucket: 'web',              slug: 'file-inclusion',                       order: 8,  label: 'File Inclusion',                       description: 'LFI, RFI, log poisoning y wrappers PHP.' },
  'Web Attacks':                              { bucket: 'web',              slug: 'web-attacks',                          order: 9,  label: 'Web Attacks',                          description: 'IDOR, XXE, JWT attacks y deserialización insegura.' },
  'Attacking Common Applications':            { bucket: 'web',              slug: 'attacking-common-applications',        order: 10, label: 'Attacking Common Applications',        description: 'WordPress, Joomla, Drupal, Tomcat, Jenkins y Splunk.' },
  'Broken Authentication':                    { bucket: 'web',              slug: 'broken-authentication',                order: 11, label: 'Broken Authentication',                description: 'Weak passwords, session hijacking, MFA bypass y credential stuffing.' },
  'Server-side Attacks':                      { bucket: 'web',              slug: 'server-side-attacks',                  order: 12, label: 'Server-side Attacks',                  description: 'SSRF, SSTI, SSI injection y XSLT injection.' },
  'API Attacks':                              { bucket: 'web',              slug: 'api-attacks',                          order: 13, label: 'API Attacks',                          description: 'REST API enumeration, mass assignment, broken object auth y rate limit bypass.' },
  'Attacking GraphQL':                        { bucket: 'web',              slug: 'attacking-graphql',                    order: 14, label: 'Attacking GraphQL',                    description: 'Introspección, queries maliciosas, injection y auth bypass en GraphQL.' },
  'Bug Bounty Hunting Process':               { bucket: 'web',              slug: 'bug-bounty-hunting-process',           order: 15, label: 'Bug Bounty Process',                   description: 'Metodología, scope, reporting y plataformas (HackerOne, Bugcrowd).' },

  // Servicios Comunes
  'Attacking Common Services':                { bucket: 'servicios',        slug: 'attacking-common-services',            order: 1,  label: 'Attacking Common Services',            description: 'FTP, SMB, SQL, RDP, WinRM, DNS y email — ataques a servicios típicos.' },

  // Exploitation & Foothold
  'Shells & Payloads':                        { bucket: 'exploitation',     slug: 'shells-payloads',                      order: 1,  label: 'Shells & Payloads',                    description: 'Bind/reverse shells, msfvenom, encoders y stagers.' },
  'Using the Metasploit Framework':           { bucket: 'exploitation',     slug: 'metasploit-framework',                 order: 2,  label: 'Metasploit Framework',                 description: 'Modules, sessions, post-exploit y evasión con Metasploit.' },
  'Password Attacks':                         { bucket: 'exploitation',     slug: 'password-attacks',                     order: 3,  label: 'Password Attacks',                     description: 'Hashcat, john, Kerberoasting, AS-REPRoasting y NTDS dumps.' },

  // Escalada de Privilegios
  'File Transfers':                           { bucket: 'privesc',          slug: 'file-transfers',                       order: 1,  label: 'File Transfers',                       description: 'Windows/Linux, PowerShell, certutil, base64 y smbserver para post-explotación.' },
  'Linux Privilege Escalation':               { bucket: 'privesc',          slug: 'linux-privilege-escalation',           order: 2,  label: 'Linux PrivEsc',                        description: 'SUID, sudo, cron jobs, capabilities y exploits de kernel.' },
  'Windows Privilege Escalation':             { bucket: 'privesc',          slug: 'windows-privilege-escalation',         order: 3,  label: 'Windows PrivEsc',                      description: 'UAC bypass, token impersonation, services y AlwaysInstallElevated.' },

  // Active Directory
  'Active Directory Enumeration & Attacks':   { bucket: 'active-directory', slug: 'active-directory-enumeration-attacks', order: 1,  label: 'AD Enumeration & Attacks',             description: 'BloodHound, Kerberos, ACL abuse y trust attacks en Active Directory.' },
  'Attacking Enterprise Networks':            { bucket: 'active-directory', slug: 'attacking-enterprise-networks',        order: 2,  label: 'Attacking Enterprise Networks',        description: 'Workflow end-to-end de pentest empresarial.' },

  // Pivoting & Lateral
  'Pivoting, Tunneling, and Port Forwarding': { bucket: 'pivoting',         slug: 'pivoting-tunneling-port-forwarding',   order: 1,  label: 'Pivoting & Tunneling',                 description: 'Chisel, ligolo, SSH tunnels y proxychains para movimiento lateral.' },

  // Quick Reference (PRIVADOS — no se publican)
  // 'Quick_Recon_Workflow', 'AD_Attack_Path', 'Reverse_Shell_Oneliners', 'Exam_Day_Checklist'
  // → omitidos intencionalmente del MAP: cheatsheets personales del autor, no van a producción.
};

// Tabla inversa: nombre del cheatsheet → ruta absoluta destino (para wikilinks)
const SLUG_MAP = {};
for (const [name, meta] of Object.entries(MAP)) {
  SLUG_MAP[name] = `/metodologias/${meta.bucket}/${meta.slug}/`;
}

// Cheatsheets que el autor mantiene privados — se ignoran silenciosamente
const SKIP = new Set([
  'Quick_Recon_Workflow',
  'AD_Attack_Path',
  'Reverse_Shell_Oneliners',
  'Exam_Day_Checklist',
]);

// Emoji codepoints comunes (Unicode 15)
const EMOJI_RE = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}\u{20E3}\u{20D0}-\u{20FF}]/gu;

function stripEmojiFromHeader(line) {
  return line.replace(/^(#{1,6}\s+)(.*)$/, (_, prefix, rest) => {
    const cleaned = rest.replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
    return `${prefix}${cleaned}`;
  });
}

function quoteYaml(s) {
  if (s == null) return '""';
  return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function convertContent(srcText, meta) {
  let lines = srcText.split(/\r?\n/);

  // 1) Strip Obsidian frontmatter
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    if (end !== -1) lines = lines.slice(end + 1);
  }

  // 2) Strip primer H1
  while (lines.length && lines[0].trim() === '') lines.shift();
  if (lines.length && /^#\s+/.test(lines[0])) lines.shift();
  while (lines.length && lines[0].trim() === '') lines.shift();

  // 3) Strip emojis SOLO de headers (##, ###, …)
  lines = lines.map((line) =>
    /^#{1,6}\s+/.test(line) ? stripEmojiFromHeader(line) : line
  );

  // 3.5) Strip sección TL;DR completa: desde "## ... TL;DR ..." hasta el primer "---" standalone
  {
    const out = [];
    let inTldr = false;
    let inCode = false;
    for (const line of lines) {
      // Tracking de code fences (no togglear mientras saltamos contenido si abre dentro de TL;DR)
      if (/^```/.test(line)) inCode = !inCode;

      if (!inTldr) {
        // Header TL;DR (ya sin emoji por paso 3)
        if (!inCode && /^##\s+TL;DR\b/i.test(line)) {
          inTldr = true;
          continue;
        }
        out.push(line);
      } else {
        // Cierre normal: "---" fuera de codeblock
        if (!inCode && line.trim() === '---') {
          inTldr = false;
          continue;
        }
        // Defensa: si aparece otro H2 antes del "---", paramos sin consumirlo
        if (!inCode && /^##\s+/.test(line)) {
          inTldr = false;
          out.push(line);
          continue;
        }
        // Dentro del TL;DR: descartar
      }
    }
    lines = out;
    // Limpiar blancos sobrantes al inicio (por si TL;DR era la 1ª sección)
    while (lines.length && lines[0].trim() === '') lines.shift();
  }

  // 4) Convertir wikilinks [[X]] y [[X|alias]]
  lines = lines.map((line) =>
    line.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => {
      const t = target.trim();
      const a = alias?.trim();
      if (SLUG_MAP[t]) return `[${a || t}](${SLUG_MAP[t]})`;
      // 00_INDEX o no encontrado → texto plano (sin corchetes)
      return a || t;
    })
  );

  // 5) Eliminar items "Volver al índice"
  lines = lines.filter((line) => !/^[-*]\s+.*Volver al [íi]ndice/i.test(line));

  // 6) Eliminar firma final "*Cheatsheet del módulo: X*" + separadores adyacentes
  while (lines.length) {
    const last = lines[lines.length - 1];
    if (last.trim() === '') { lines.pop(); continue; }
    if (/^\*Cheatsheet del m[oó]dulo/i.test(last.trim()) || /^\*Cheatsheet:/i.test(last.trim())) {
      lines.pop();
      while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
      if (lines.length && lines[lines.length - 1].trim() === '---') lines.pop();
      continue;
    }
    break;
  }

  // 7) Trailing newline final
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  lines.push('');

  // 8) Frontmatter Starlight
  const fm = [
    '---',
    `title: ${quoteYaml(meta.label)}`,
    `description: ${quoteYaml(meta.description)}`,
    'sidebar:',
    `  order: ${meta.order}`,
    `  label: ${quoteYaml(meta.label)}`,
    '---',
    '',
  ];

  return fm.join('\n') + lines.join('\n');
}

let processed = 0;
const errors = [];
const writtenByBucket = {};

for (const dirName of SOURCES) {
  const dir = path.join(ROOT, dirName);
  if (!fs.existsSync(dir)) {
    console.warn(`SKIP missing dir: ${dir}`);
    continue;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('00_INDEX'));
  for (const f of files) {
    const baseName = path.basename(f, '.md');
    if (SKIP.has(baseName)) continue;
    const meta = MAP[baseName];
    if (!meta) {
      errors.push(`NO MAP: ${dirName}/${f}`);
      continue;
    }
    const srcText = fs.readFileSync(path.join(dir, f), 'utf-8');
    const out = convertContent(srcText, meta);
    const destDir = path.join(DEST_BASE, meta.bucket);
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, `${meta.slug}.md`), out, 'utf-8');
    processed++;
    writtenByBucket[meta.bucket] = (writtenByBucket[meta.bucket] || 0) + 1;
    console.log(`  OK ${dirName}/${f}  →  metodologias/${meta.bucket}/${meta.slug}.md`);
  }
}

console.log(`\nProcessed: ${processed}`);
console.log('Per bucket:', writtenByBucket);
if (errors.length) {
  console.log('\nErrors:');
  errors.forEach((e) => console.log(`  ! ${e}`));
  process.exit(1);
}
