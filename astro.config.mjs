// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
  site: 'https://docs.pwnvader.com',
  integrations: [
    starlight({
      title: 'docs.pwnvader.com',
      favicon: '/favicon.png',
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'Español',
          lang: 'es',
        },
        en: {
          label: 'English',
          lang: 'en',
        },
      },
      logo: {
        src: './src/assets/logo.webp',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/pwnVader' }
      ],
      customCss: [
        './src/styles/custom.css',
        '@fontsource/jetbrains-mono/400.css',
        '@fontsource/jetbrains-mono/500.css',
        '@fontsource/jetbrains-mono/700.css',
      ],
      components: {
        ThemeSelect: './src/components/ThemeSelect.astro',
        Header: './src/components/Header.astro',
        Footer: './src/components/Footer.astro',
      },
      head: [
        // ─── CSS crítico inline para eliminar FOUC del header ───────────
        // Estas reglas duplican las que viven en custom.css pero se inlinean
        // en el <head> para que apliquen en el PRIMER paint del navegador,
        // antes de que se descargue el <link rel="stylesheet"> externo.
        // Sin esto se ve por ~50ms el header pegado a la izquierda antes
        // de que custom.css lo centre.
        {
          tag: 'style',
          content: `
            :root { --sl-nav-height: 5.25rem !important; }
            header.header {
              padding: 0 !important;
              display: flex !important;
              flex-direction: column !important;
              height: auto !important;
              min-height: var(--sl-nav-height) !important;
            }
            header.header > div.header {
              flex: 1 !important;
              width: 100% !important;
            }
            :root:not([data-has-sidebar]) header.header > div.header {
              max-width: 72rem !important;
              margin-inline: auto !important;
              padding-inline: 1rem !important;
            }
          `.replace(/\s+/g, ' ').trim(),
        },
        {
          tag: 'meta',
          attrs: { name: 'description', content: 'Base de conocimiento técnico, writeups de entornos corporativos y documentación metodológica de explotación.' }
        },
        {
          tag: 'meta',
          attrs: { property: 'og:title', content: 'Knowledge Base | Metodologías de Seguridad Ofensiva' }
        },
        {
          tag: 'meta',
          attrs: { property: 'og:description', content: 'Base de conocimiento técnico, writeups de entornos corporativos y documentación metodológica de explotación.' }
        },
        {
          tag: 'meta',
          attrs: { property: 'og:type', content: 'website' }
        },
        {
          tag: 'meta',
          attrs: { property: 'og:url', content: 'https://docs.pwnvader.com' }
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: 'https://docs.pwnvader.com/og-image.png' }
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:card', content: 'summary_large_image' }
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:title', content: 'Knowledge Base | Metodologías de Seguridad Ofensiva' }
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:description', content: 'Base de conocimiento técnico, writeups de entornos corporativos y documentación metodológica de explotación.' }
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:image', content: 'https://docs.pwnvader.com/og-image.png' }
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:url', content: 'https://docs.pwnvader.com' }
        }
      ],
      sidebar: [
        {
          label: '🏴‍☠️ Writeups',
          translations: {
            en: '🏴‍☠️ Writeups',
          },
          collapsed: true,
          items: [
            {
              label: 'HackTheBox',
              translations: {
                en: 'HackTheBox',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'writeups/hackthebox', collapsed: true } }]
            },
            {
              label: 'TryHackMe',
              translations: {
                en: 'TryHackMe',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'writeups/tryhackme', collapsed: true } }]
            },
            {
              label: 'CTFs',
              translations: {
                en: 'CTFs',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'writeups/ctfs', collapsed: true } }]
            }
          ]
        },
        {
          label: '🎓 HTB Academy',
          translations: {
            en: '🎓 HTB Academy',
          },
          collapsed: true,
          items: [
            {
              label: 'CPTS (Certified PenTester)',
              translations: {
                en: 'CPTS (Certified PenTester)',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'writeups/htb-academy/cpts', collapsed: true } }]
            },
            {
              label: 'COAE (Certified Offense AI)',
              translations: {
                en: 'COAE (Certified Offense AI)',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'writeups/htb-academy/coae', collapsed: true } }]
            }
          ]
        },
        {
          label: '📖 Metodologías',
          translations: {
            en: '📖 Methodologies',
          },
          collapsed: true,
          items: [
            {
              label: '📋 Fundamentos & Metodología',
              translations: {
                en: '📋 Fundamentals & Methodology',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/fundamentos', collapsed: true } }]
            },
            {
              label: '🔍 Recon & Enumeración',
              translations: {
                en: '🔍 Recon & Enumeration',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/recon', collapsed: true } }]
            },
            {
              label: '🌐 Web Exploitation',
              translations: {
                en: '🌐 Web Exploitation',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/web', collapsed: true } }]
            },
            {
              label: '⚙️ Servicios Comunes',
              translations: {
                en: '⚙️ Common Services',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/servicios', collapsed: true } }]
            },
            {
              label: '💻 Exploitation & Foothold',
              translations: {
                en: '💻 Exploitation & Foothold',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/exploitation', collapsed: true } }]
            },
            {
              label: '🔐 Escalada de Privilegios',
              translations: {
                en: '🔐 Privilege Escalation',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/privesc', collapsed: true } }]
            },
            {
              label: '🏢 Active Directory',
              translations: {
                en: '🏢 Active Directory',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/active-directory', collapsed: true } }]
            },
            {
              label: '🔀 Pivoting & Lateral',
              translations: {
                en: '🔀 Pivoting & Lateral Movement',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/pivoting', collapsed: true } }]
            }
          ]
        }
      ],
    }),
    icon(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
