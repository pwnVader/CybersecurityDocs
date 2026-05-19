import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('writeups_src');
const destDir = path.resolve('src/content/docs/writeups');

// Limpiar el directorio de destino para evitar archivos huérfanos o de plantilla
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir, { recursive: true });

// Procesa y enriquece un archivo Markdown para garantizar que tenga el frontmatter requerido por Starlight
function processAndCopyMarkdown(srcPath, destPath) {
  let content = fs.readFileSync(srcPath, 'utf-8');
  
  // Detectar bloque de frontmatter existente
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
  const match = content.match(frontmatterRegex);
  
  let title = '';
  let hasFrontmatter = false;
  
  if (match) {
    hasFrontmatter = true;
    const yamlContent = match[1];
    // Intentar extraer el título del frontmatter
    const titleMatch = yamlContent.match(/^title:\s*(.*)$/m);
    if (titleMatch) {
      title = titleMatch[1].replace(/['"]/g, '').trim();
    }
  }
  
  // Si no hay título en el frontmatter, extraerlo del primer encabezado H1 (# ...) del Markdown
  if (!title) {
    const h1Match = content.match(/^#\s+(.*)$/m);
    if (h1Match) {
      title = h1Match[1].trim();
    } else {
      // Fallback: usar el nombre del archivo formateado en caso extremo
      const basename = path.basename(srcPath, '.md');
      title = basename
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    }
  }

  // Sanitizar título de comillas extras
  title = title.replace(/"/g, '\\"');

  // Asegurar que el frontmatter tenga el título correcto
  if (hasFrontmatter) {
    if (!content.match(/^title:/m)) {
      content = content.replace(/^---/, `---\ntitle: "${title}"`);
    }
  } else {
    // Si no tiene frontmatter, inyectar uno limpio al inicio
    content = `---\ntitle: "${title}"\n---\n\n` + content;
  }
  
  fs.writeFileSync(destPath, content, 'utf-8');
}

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    for (const file of files) {
      if (file === '.git' || file === '.gitignore') continue;
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    const filename = path.basename(src);
    let finalDest = dest;
    
    // Convertir README.md a index.md para enrutamiento limpio
    if (filename.toLowerCase() === 'readme.md') {
      finalDest = path.join(path.dirname(dest), 'index.md');
    }
    
    const ext = path.extname(src).toLowerCase();
    if (ext === '.md' || ext === '.mdx') {
      processAndCopyMarkdown(src, finalDest);
    } else {
      // Archivos no markdown (imágenes, pdfs, etc.) se copian tal cual
      fs.copyFileSync(src, finalDest);
    }
  }
}

if (fs.existsSync(srcDir)) {
  console.log('🔄 Sincronizando writeups y formateando metadatos frontmatter...');
  copyRecursive(srcDir, destDir);
  console.log('✓ Writeups sincronizados y frontmatter procesado correctamente.');
} else {
  console.warn('⚠️ Advertencia: No se encontró la carpeta writeups_src. Saltando sincronización.');
}
