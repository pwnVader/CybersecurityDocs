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
          items: [
            {
              label: 'HackTheBox',
              items: [{ autogenerate: { directory: 'writeups/hackthebox' } }]
            },
            {
              label: 'TryHackMe',
              items: [{ autogenerate: { directory: 'writeups/tryhackme' } }]
            },
            {
              label: 'CTFs',
              items: [{ autogenerate: { directory: 'writeups/ctfs' } }]
            }
          ]
        },
        {
          label: '🎓 HTB Academy',
          items: [
            {
              label: 'CPTS (Certified PenTester)',
              items: [{ autogenerate: { directory: 'writeups/htb-academy/cpts' } }]
            },
            {
              label: 'COAE (Certified Offense AI)',
              items: [{ autogenerate: { directory: 'writeups/htb-academy/coae' } }]
            }
          ]
        },
        {
          label: '📖 Metodologías',
          items: [
            {
              label: 'Reconocimiento y Enumeración',
              items: [{ autogenerate: { directory: 'metodologias/recon' } }]
            },
            {
              label: 'Explotación Web',
              items: [{ autogenerate: { directory: 'metodologias/web' } }]
            },
            {
              label: 'Active Directory / Red Teams',
              items: [{ autogenerate: { directory: 'metodologias/active-directory' } }]
            },
            {
              label: 'Escalada de Privilegios',
              items: [{ autogenerate: { directory: 'metodologias/privesc' } }]
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
