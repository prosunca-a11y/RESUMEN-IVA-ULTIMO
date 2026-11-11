import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const zip = new JSZip();
const rootDir = process.cwd();
const outputFile = path.join(rootDir, 'public', 'proyecto-iva-actualizado.zip');

const ignoreDirs = ['node_modules', 'dist', '.git', '.aistudio', '.aistudio_artifacts'];

function addFilesToZip(dirPath, zipFolder) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const relativePath = path.relative(rootDir, fullPath);

    if (file === 'proyecto-iva-actualizado.zip' || file === 'proyecto-iva-actualizado.tar.gz') continue;
    if (ignoreDirs.some(ignore => relativePath === ignore || relativePath.startsWith(ignore + '/'))) {
      continue;
    }

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const subZipFolder = zipFolder.folder(file);
      addFilesToZip(fullPath, subZipFolder);
    } else {
      const content = fs.readFileSync(fullPath);
      zipFolder.file(file, content);
    }
  }
}

console.log('Creando archivo ZIP del proyecto...');
addFilesToZip(rootDir, zip);

zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }).then(buffer => {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, buffer);
  console.log(`¡Archivo ZIP creado exitosamente en ${outputFile}! (${buffer.length} bytes)`);
}).catch(err => {
  console.error('Error al generar ZIP:', err);
});
