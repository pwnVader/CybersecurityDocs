// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: 'docs.pwnvader.com',
      logo: {
        src: './src/assets/logo.svg',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/pwnVader/CybersecurityDocs' }
      ],
      customCss: [
        './src/styles/custom.css',
        '@fontsource/jetbrains-mono/400.css',
        '@fontsource/jetbrains-mono/700.css',
      ],
      components: {
        ThemeSelect: './src/components/ThemeSelect.astro',
      },
      sidebar: [
        {
          label: '🏴‍☠️ Writeups',
          collapsed: true,
          items: [
            {
              label: 'HackTheBox',
              collapsed: true,
              items: [{ autogenerate: { directory: 'writeups/hackthebox', collapsed: true } }]
            },
            {
              label: 'TryHackMe',
              collapsed: true,
              items: [{ autogenerate: { directory: 'writeups/tryhackme', collapsed: true } }]
            },
            {
              label: 'CTFs',
              collapsed: true,
              items: [{ autogenerate: { directory: 'writeups/ctfs', collapsed: true } }]
            }
          ]
        },
        {
          label: '🎓 HTB Academy',
          collapsed: true,
          items: [
            {
              label: 'CPTS (Certified PenTester)',
              collapsed: true,
              items: [{ autogenerate: { directory: 'writeups/htb-academy/cpts', collapsed: true } }]
            },
            {
              label: 'COAE (Certified Offense AI)',
              collapsed: true,
              items: [{ autogenerate: { directory: 'writeups/htb-academy/coae', collapsed: true } }]
            }
          ]
        },
        {
          label: '📖 Metodologías',
          collapsed: true,
          items: [
            {
              label: 'Reconocimiento y Enumeración',
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/recon', collapsed: true } }]
            },
            {
              label: 'Explotación Web',
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/web', collapsed: true } }]
            },
            {
              label: 'Active Directory / Red Teams',
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/active-directory', collapsed: true } }]
            },
            {
              label: 'Escalada de Privilegios',
              collapsed: true,
              items: [{ autogenerate: { directory: 'metodologias/privesc', collapsed: true } }]
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
