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
        Sidebar: './src/components/Sidebar.astro',
        ThemeProvider: './src/components/ForceDarkTheme.astro',
        SiteTitle: './src/components/SiteTitle.astro',
      },
      head: [
        // ─── CSS crítico inline para eliminar FOUC del header y sidebar ───
        // Estas reglas duplican las que viven en custom.css pero se inlinean
        // en el <head> para que apliquen en el PRIMER paint del navegador,
        // antes de que se descargue el <link rel="stylesheet"> externo.
        {
          tag: 'style',
          content: `
            :root {
              --eco-strip-height: 2rem;
              --eco-header-row: 3.5rem;
              --eco-logo-height: 2.25rem;
              --sl-nav-height: calc(var(--eco-strip-height) + var(--eco-header-row) + 1px) !important;
            }
            html {
              background-color: #050810 !important;
              color: #cbd5e1 !important;
              color-scheme: dark !important;
              scrollbar-gutter: stable;
            }
            body {
              background-color: #050810 !important;
              color: #cbd5e1 !important;
            }
            .sidebar-pane {
              background-color: #0f172a !important;
            }
            header.header {
              padding: 0 !important;
              display: flex !important;
              flex-direction: column !important;
              height: auto !important;
              min-height: var(--sl-nav-height) !important;
              background-color: #0f172a !important;
              z-index: 50 !important;
              border-bottom: 1px solid rgba(14, 165, 233, 0.18) !important;
              box-shadow: 0 2px 24px rgba(0, 0, 0, 0.55) !important;
            }
            header.header > .ecosystem-strip {
              height: var(--eco-strip-height) !important;
            }
            header.header > div.header {
              flex: none !important;
              width: 100% !important;
              height: var(--eco-header-row) !important;
              min-height: 0 !important;
              padding-block: 0 !important;
              max-width: 56rem !important;
              margin-inline: auto !important;
              padding-inline: 1.5rem !important;
            }
            header.header .site-title img {
              height: var(--eco-logo-height) !important;
            }
            [data-has-sidebar] .content-panel .sl-container {
              max-width: 56rem !important;
              margin-inline: auto !important;
              width: 100% !important;
            }
            @media (min-width: 90rem) {
              :root {
                --app-gutter: calc((100vw - 90rem) / 2);
              }
              [data-has-sidebar] .sidebar-pane {
                inset-inline-start: var(--app-gutter) !important;
              }
              [data-has-sidebar] {
                --sl-content-inline-start: calc(var(--app-gutter) + var(--sl-sidebar-width)) !important;
              }
              [data-has-sidebar] .main-frame {
                padding-inline-end: var(--app-gutter) !important;
              }
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
          label: 'Home',
          translations: {
            en: 'Home',
          },
          link: '/home/',
        },
        {
          label: 'Writeups',
          translations: {
            en: 'Writeups',
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
          label: 'Metodologías',
          translations: {
            en: 'Methodologies',
          },
          collapsed: true,
          items: [
            {
              label: 'Fundamentos & Metodología',
              translations: {
                en: 'Fundamentals & Methodology',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/fundamentos', collapsed: true } }]
            },
            {
              label: 'Recon & Enumeración',
              translations: {
                en: 'Recon & Enumeration',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/recon', collapsed: true } }]
            },
            {
              label: 'Web Exploitation',
              translations: {
                en: 'Web Exploitation',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/web', collapsed: true } }]
            },
            {
              label: 'Servicios Comunes',
              translations: {
                en: 'Common Services',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/servicios', collapsed: true } }]
            },
            {
              label: 'Exploitation & Foothold',
              translations: {
                en: 'Exploitation & Foothold',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/exploitation', collapsed: true } }]
            },
            {
              label: 'Escalada de Privilegios',
              translations: {
                en: 'Privilege Escalation',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/privesc', collapsed: true } }]
            },
            {
              label: 'Active Directory',
              translations: {
                en: 'Active Directory',
              },
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/active-directory', collapsed: true } }]
            },
            {
              label: 'Pivoting & Lateral',
              translations: {
                en: 'Pivoting & Lateral Movement',
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
