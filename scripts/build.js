// Produce one portable file which also runs directly from the filesystem.
import {build} from 'esbuild';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = {'.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
async function asData(path) {
  return 'data:' + types[extname(path)] + ';base64,' + (await readFile(path)).toString('base64');
}
async function inlineCSS(path) {
  let css = await readFile(path,'utf8');
  for (const match of [...css.matchAll(/url\(["']?([^)"']+)["']?\)/g)]) {
    css = css.replace(match[0], 'url(' + await asData(resolve(dirname(path), match[1])) + ')');
  }
  return '<style>' + css + '</style>';
}
let html = await readFile(resolve(root,'index.html'),'utf8');
for (const match of [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)]) {
  const style = await inlineCSS(resolve(root,match[1]));
  html = html.replace(match[0], () => style);
}
html = html.replace(/\s*<link rel="preload"[^>]+>/,'');
html = html.replace('assets/signet.svg', await asData(resolve(root,'assets/signet.svg')));
const bundle = await build({absWorkingDir:root,entryPoints:['main.js'],bundle:true,format:'iife',target:'es2020',minify:true,write:false,legalComments:'inline'});
const code = bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
html = html.replace('<script type="module" src="main.js"></script>', () => '<script>' + code + '</script>');
const licenses = await Promise.all(['vendor/three.LICENSE','assets/fonts/roboto.LICENSE','assets/fonts/plex.LICENSE'].map(path => readFile(resolve(root,path),'utf8')));
html = html.replace('</body>', () => '<script type="text/plain" id="third-party-licenses">' + licenses.join('\n\n') + '</script>\n</body>');
const output = resolve(root,'dist');
await mkdir(output,{recursive:true});
await writeFile(resolve(output,'index.html'),html);
console.log('Готово: ' + resolve(output,'index.html'));
