import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

const dataDir = '/data';
const uploadsDir = `${dataDir}/uploads`;
const textsDir = `${dataDir}/texts`;
const sslDir = '/ssl';
const metaFile = `${textsDir}/.meta.json`;

// Criar diretórios se não existirem
[uploadsDir, textsDir, sslDir].forEach(dir => !existsSync(dir) && mkdirSync(dir, { recursive: true }));

// Carregar metadata
let textsMeta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf-8')) : {};

// Sessões em memória
const sessions = new Map();

// Verificar porta 80
const port80Taken = await new Promise(resolve => {
    const cmd = spawn('ss', ['-tuln']);
    let output = '';
    cmd.stdout.on('data', data => output += data);
    cmd.on('close', () => resolve(output.includes(':80')));
});

let finalPort = 8081;
let finalSsl = false;

if (!port80Taken) {
    // Verificar certificados SSL
    const certsExist = existsSync(`${sslDir}/fullchain.pem`) && existsSync(`${sslDir}/privkey.pem`);
    
    if (certsExist) {
        finalPort = 443;
        finalSsl = true;
    } else if (process.env.DOMAIN && process.env.EMAIL) {
        // Tentar obter certificados via certbot
        const certbotSuccess = await new Promise(resolve => {
            const cmd = spawn('certbot', [
                'certonly', '--standalone',
                '-d', process.env.DOMAIN,
                '--non-interactive', '--agree-tos',
                '-m', process.env.EMAIL
            ]);
            cmd.on('close', code => {
                if (code === 0) {
                    const certPath = `/etc/letsencrypt/live/${process.env.DOMAIN}`;
                    try {
                        ['fullchain.pem', 'privkey.pem'].forEach(f => {
                            const content = readFileSync(`${certPath}/${f}`);
                            writeFileSync(`${sslDir}/${f}`, content);
                        });
                        resolve(true);
                    } catch (e) {
                        resolve(false);
                    }
                } else {
                    resolve(false);
                }
            });
        });
        
        if (certbotSuccess) {
            finalPort = 443;
            finalSsl = true;
        } else {
            finalPort = 80;
            finalSsl = false;
        }
    } else {
        finalPort = 80;
        finalSsl = false;
    }
}

console.log(`Starting server on port ${finalPort} with SSL: ${finalSsl}`);

// Autenticação
const auth = req => {
    const sid = req.headers.get('cookie')?.match(/sid=([^;]+)/)?.[1];
    if (!sid || !sessions.has(sid)) return false;
    const session = sessions.get(sid);
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const ua = req.headers.get('user-agent') || '';
    if (session.ip !== ip || session.ua !== ua) return false;
    session.expires = Date.now() + 30 * 60 * 1000;
    return true;
};

// Sanitização
const sanitize = name => name.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\.\./g, '').slice(0, 100);

// Servidor
Bun.serve({
    port: finalPort,
    ...(finalSsl && {
        tls: {
            cert: readFileSync(`${sslDir}/fullchain.pem`),
            key: readFileSync(`${sslDir}/privkey.pem`)
        }
    }),
    async fetch(req) {
        const url = new URL(req.url);
        const path = url.pathname;
        const method = req.method;

        // Página inicial
        if (path === '/' && method === 'GET') {
            return new Response(readFileSync('/app/index.html'), { 
                headers: { 'Content-Type': 'text/html' } 
            });
        }

        // Login
        if (path === '/login' && method === 'POST') {
            const { password } = await req.json();
            if (password === process.env.PASSWORD) {
                const sid = randomUUID();
                const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
                const ua = req.headers.get('user-agent') || '';
                sessions.set(sid, { ip, ua, expires: Date.now() + 30 * 60 * 1000 });
                const cookieOptions = `sid=${sid}; HttpOnly; Path=/; Max-Age=1800; SameSite=Lax${finalSsl ? '; Secure' : ''}`;
                return new Response(null, { 
                    status: 200, 
                    headers: { 'Set-Cookie': cookieOptions } 
                });
            }
            return new Response('Unauthorized', { status: 401 });
        }

        // Verificar sessão
        if (path === '/auth' && method === 'GET') {
            return new Response(auth(req) ? 'OK' : 'Unauthorized', { 
                status: auth(req) ? 200 : 401 
            });
        }

        // Textos públicos (sem auth)
        if (path.startsWith('/txt/') && method === 'GET') {
            const name = sanitize(path.split('/')[2]);
            const txtPath = `${textsDir}/${name}.txt`;
            if (textsMeta[name]?.open && existsSync(txtPath)) {
                const content = readFileSync(txtPath, 'utf8');
                const acceptHeader = req.headers.get('accept') || '';
                const isJsonRequest = acceptHeader.includes('application/json');
                
                if (isJsonRequest) {
                    // Fetch/AJAX: retorna JSON completo
                    return new Response(content, { headers: { 'Content-Type': 'application/json' } });
                } else {
                    // Browser direto: retorna apenas content em plain text
                    const data = JSON.parse(content);
                    return new Response(data.content, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
                }
            }
        }

        // HTML público (sem auth) - arquivos .html públicos servidos como HTML
        if (path.startsWith('/h/') && method === 'GET') {
            const name = sanitize(path.split('/')[2]);
            const htmlName = name.endsWith('.html') ? name.slice(0, -5) : name;
            const txtPath = `${textsDir}/${htmlName}.html.txt`;
            if (textsMeta[`${htmlName}.html`]?.open && existsSync(txtPath)) {
                const data = JSON.parse(readFileSync(txtPath, 'utf8'));
                return new Response(data.content, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            }
            return new Response('Not Found', { status: 404 });
        }

        // Verificar autenticação para rotas protegidas
        if (!auth(req)) return new Response('Unauthorized', { status: 401 });

        // Upload arquivo
        if (path === '/upload' && method === 'POST') {
            const data = await req.formData();
            const file = data.get('file');
            if (!file || file.size > 50 * 1024 * 1024) {
                return new Response('Bad Request', { status: 400 });
            }
            const safeName = sanitize(file.name);
            await Bun.write(`${uploadsDir}/${safeName}`, file);
            return new Response('OK');
        }

        // Listar arquivos
        if (path === '/files' && method === 'GET') {
            const files = readdirSync(uploadsDir)
                .filter(name => !name.startsWith('.'))
                .map(name => ({ 
                    name, 
                    size: statSync(`${uploadsDir}/${name}`).size 
                }));
            return new Response(JSON.stringify(files), { 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Download arquivo
        if (path.startsWith('/files/') && method === 'GET') {
            const name = sanitize(path.split('/')[2]);
            const filePath = `${uploadsDir}/${name}`;
            if (!existsSync(filePath)) return new Response('Not Found', { status: 404 });
            return new Response(Bun.file(filePath));
        }

        // Deletar arquivo
        if (path.startsWith('/files/') && method === 'DELETE') {
            const name = sanitize(path.split('/')[2]);
            const filePath = `${uploadsDir}/${name}`;
            if (existsSync(filePath)) unlinkSync(filePath);
            return new Response('OK');
        }

        // Salvar texto
        if (path.startsWith('/txt/') && method === 'POST') {
            const name = sanitize(path.split('/')[2]);
            const { content, open } = await req.json();
            writeFileSync(`${textsDir}/${name}.txt`, JSON.stringify({ content, open }));
            textsMeta[name] = { open: open ? 1 : 0 };
            writeFileSync(metaFile, JSON.stringify(textsMeta));
            return new Response('OK');
        }

        // Ler texto (autenticado)
        if (path.startsWith('/txt/') && method === 'GET') {
            const name = sanitize(path.split('/')[2]);
            const txtPath = `${textsDir}/${name}.txt`;
            if (!existsSync(txtPath)) return new Response('Not Found', { status: 404 });
            
            const content = readFileSync(txtPath, 'utf8');
            const acceptHeader = req.headers.get('accept') || '';
            const isJsonRequest = acceptHeader.includes('application/json');
            
            if (isJsonRequest) {
                // Fetch/AJAX: retorna JSON completo
                return new Response(content, { headers: { 'Content-Type': 'application/json' } });
            } else {
                // Browser direto: retorna apenas content em plain text
                const data = JSON.parse(content);
                return new Response(data.content, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
            }
        }

        // Listar textos
        if (path === '/txts' && method === 'GET') {
            const txts = Object.entries(textsMeta).map(([name, { open }]) => ({ name, open }));
            return new Response(JSON.stringify(txts), { 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Deletar texto
        if (path.startsWith('/txt/') && method === 'DELETE') {
            const name = sanitize(path.split('/')[2]);
            const txtPath = `${textsDir}/${name}.txt`;
            if (existsSync(txtPath)) unlinkSync(txtPath);
            delete textsMeta[name];
            writeFileSync(metaFile, JSON.stringify(textsMeta));
            return new Response('OK');
        }

        return new Response('Not Found', { status: 404 });
    }
});

// Limpeza de sessões expiradas
setInterval(() => {
    const now = Date.now();
    for (const [sid, session] of sessions.entries()) {
        if (session.expires < now) sessions.delete(sid);
    }
}, 60 * 1000);
