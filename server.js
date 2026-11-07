import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, extname, resolve, sep} from 'node:path';
import {pipeline} from 'node:stream/promises';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = '127.0.0.1';
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp'};
const server = createServer(async (request, response) => {
  try {
    if (!['GET','HEAD'].includes(request.method)) {
      response.writeHead(405, {Allow:'GET, HEAD'}).end(); return;
    }
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    const type = mime[extname(file)];
    if (!type || !file.startsWith(root + sep) || path.split('/').some(part => part.startsWith('.'))) {
      response.writeHead(404).end(); return;
    }
    const info = await stat(file);
    if (!info.isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, {'Content-Type':type, 'Content-Length':info.size, 'X-Content-Type-Options':'nosniff'});
    if (request.method === 'HEAD') response.end();
    else await pipeline(createReadStream(file),response);
  } catch {
    if (!response.headersSent) response.writeHead(404);
    response.end();
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, host, () => console.log('Нулевой корпус · http://' + host + ':' + server.address().port + '/'));
