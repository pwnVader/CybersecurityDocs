import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('src/content/docs/metodologias');
const destDir = path.resolve('src/content/docs/en/metodologias');

// Banner de advertencia en inglés para los cheatsheets en español
const fallbackBanner = `
<aside class="my-8 p-5 rounded-lg border-l-4 border-[#cba6f7] bg-[#cba6f7]/5 not-prose shadow-lg backdrop-blur-sm">
  <div class="text-xs uppercase tracking-widest text-[#cba6f7] font-bold mb-2 font-mono flex items-center gap-2">
    <span class="inline-block w-2 h-2 rounded-full bg-[#cba6f7] animate-pulse"></span>
    Language Fallback · Contenido en Español
  </div>
  <p class="text-sm text-zinc-300 leading-relaxed">
    This methodology cheatsheet is currently written in Spanish. Technical command syntaxes, cheatsheets, and checklists remain highly readable. You can switch back to Spanish at any time using the language toggle above.
  </p>
</aside>

`;

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

function processFile(srcPath, destPath) {
  let content = fs.readFileSync(srcPath, 'utf8');

  // Separar frontmatter y body
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
  const match = content.match(frontmatterRegex);

  if (match) {
    const frontmatter = match[0];
    let body = content.substring(match[0].length);

    // Ajustar enlaces internos de metodologías para mantener la navegación en inglés (/en/metodologias/)
    body = body.replace(/\/metodologias\//g, '/en/metodologias/');

    // Unir de nuevo inyectando el banner de fallback arriba del cuerpo
    content = frontmatter + fallbackBanner + body;
  } else {
    // Si no tiene frontmatter (raro), inyectar al principio
    content = fallbackBanner + content.replace(/\/metodologias\//g, '/en/metodologias/');
  }

  ensureDirectoryExistence(destPath);
  fs.writeFileSync(destPath, content, 'utf8');
}

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(file => {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      walk(filepath, callback);
    } else if (file.endsWith('.md') || file.endsWith('.mdx')) {
      callback(filepath);
    }
  });
}

console.log('🔄 Sincronizando metodologías para localización en inglés...');

if (fs.existsSync(srcDir)) {
  // Limpiar destino viejo para evitar huerfanos
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destDir, { recursive: true });

  walk(srcDir, (srcPath) => {
    const relativePath = path.relative(srcDir, srcPath);
    const destPath = path.join(destDir, relativePath);
    processFile(srcPath, destPath);
    console.log(`  ✓ Clonado con fallback: metodologias/${relativePath}`);
  });
  console.log('✨ Sincronización de metodologías completada con éxito.');
} else {
  console.error('❌ Error: El directorio de origen de las metodologías no existe.');
}
