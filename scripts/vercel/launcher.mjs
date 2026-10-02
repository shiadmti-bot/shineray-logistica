// Entrada da função na Vercel: sobe o servidor embutido do PHP e repassa cada
// requisição para ele.
//
// Substitui o launcher do vercel-php. O handler dele ("launcher.launcher", no
// formato AWS) deixou de ser entendido pelo bootstrap Node da Vercel, que passou
// a importá-lo como caminho de arquivo e derruba a função antes de o PHP subir
// (vercel-community/php#650). Aqui o handler é um módulo com export default.

import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TASK_ROOT = path.dirname(fileURLToPath(import.meta.url));
const USER_DIR = path.join(TASK_ROOT, 'user');
const PHP_DIR = path.join(TASK_ROOT, 'php');
const LIB_DIR = path.join(TASK_ROOT, 'lib');
const ROUTER = path.join(USER_DIR, 'api', 'index.php');
const HOST = '127.0.0.1';
const STARTUP_TIMEOUT_MS = 10_000;

// Cabeçalhos que só valem para a conexão local entre o Node e o PHP.
const HOP_BY_HOP = new Set([
    'connection',
    'expect',
    'keep-alive',
    'proxy-connection',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
]);

// Promise com a porta do servidor PHP desta instância (null = subir na próxima requisição).
let phpServer = null;

export default async function handler(req, res) {
    let port;
    try {
        port = await ensurePhpServer();
    } catch (error) {
        console.error('Falha ao iniciar o PHP:', error);
        sendError(res, 500, 'Falha ao iniciar o PHP.');
        return;
    }

    try {
        const body = await readBody(req);
        await forward(req, res, port, body);
    } catch (error) {
        console.error('Falha ao processar a requisição:', error);
        if (res.headersSent) {
            res.destroy(error);
        } else {
            sendError(res, 502, 'Falha ao processar a requisição.');
        }
    }
}

function ensurePhpServer() {
    if (!phpServer) {
        const starting = startPhpServer(() => {
            if (phpServer === starting) {
                phpServer = null;
            }
        });
        phpServer = starting;
        starting.catch(() => {
            if (phpServer === starting) {
                phpServer = null;
            }
        });
    }
    return phpServer;
}

async function startPhpServer(onExit) {
    const port = await findFreePort();
    const php = spawn(
        path.join(PHP_DIR, 'php'),
        [
            '-c', path.join(PHP_DIR, 'php.ini'),
            // O php.ini da libphp fixa /var/task/php/modules; aqui vale onde a função estiver.
            '-d', `extension_dir=${path.join(PHP_DIR, 'modules')}`,
            '-S', `${HOST}:${port}`,
            '-t', USER_DIR,
            ROUTER,
        ],
        {
            cwd: PHP_DIR,
            env: {
                ...process.env,
                PATH: `${PHP_DIR}:${process.env.PATH ?? ''}`,
                LD_LIBRARY_PATH: `${LIB_DIR}:${process.env.LD_LIBRARY_PATH ?? ''}`,
                // A Vercel pode mandar requisições simultâneas para a mesma instância;
                // sem workers o servidor embutido atende uma de cada vez.
                PHP_CLI_SERVER_WORKERS: process.env.PHP_CLI_SERVER_WORKERS ?? '4',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        },
    );

    php.stdout.on('data', (data) => console.log(data.toString().trimEnd()));
    php.stderr.on('data', (data) => console.error(data.toString().trimEnd()));

    let dead = false;
    const exited = new Promise((_, reject) => {
        php.once('error', (error) => {
            dead = true;
            reject(error);
        });
        php.once('exit', (code, signal) => {
            dead = true;
            onExit();
            const message = `Servidor PHP encerrado (code=${code}, signal=${signal}).`;
            console.error(message);
            reject(new Error(message));
        });
    });
    // Se o PHP cair depois de subir, a próxima requisição sobe outro (onExit).
    exited.catch(() => {});

    try {
        await Promise.race([waitForPort(port, () => dead), exited]);
    } catch (error) {
        php.kill();
        throw error;
    }
    return port;
}

function findFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.once('error', reject);
        server.listen(0, HOST, () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

function waitForPort(port, isDead) {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
        const attempt = () => {
            const socket = net.connect(port, HOST);
            socket.once('connect', () => {
                socket.destroy();
                resolve();
            });
            socket.once('error', () => {
                socket.destroy();
                if (isDead()) {
                    return;
                }
                if (Date.now() > deadline) {
                    reject(new Error(`O PHP não abriu a porta ${port} em ${STARTUP_TIMEOUT_MS} ms.`));
                    return;
                }
                setTimeout(attempt, 10);
            });
        };
        attempt();
    });
}

async function readBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

function forward(req, res, port, body) {
    const headers = {};
    for (const [name, value] of Object.entries(req.headers)) {
        if (!HOP_BY_HOP.has(name)) {
            headers[name] = value;
        }
    }
    // O corpo já foi lido inteiro: o PHP recebe um tamanho fixo e coerente.
    headers['content-length'] = String(body.length);

    return new Promise((resolve, reject) => {
        const upstream = http.request(
            { host: HOST, port, method: req.method, path: req.url, headers },
            (phpRes) => {
                res.statusCode = phpRes.statusCode ?? 502;
                for (const [name, value] of Object.entries(phpRes.headers)) {
                    // O servidor embutido devolve "Host" na resposta; não é para o cliente.
                    if (value !== undefined && name !== 'host' && !HOP_BY_HOP.has(name)) {
                        res.setHeader(name, value);
                    }
                }
                phpRes.once('error', reject);
                res.once('close', resolve);
                res.once('finish', resolve);
                phpRes.pipe(res);
            },
        );
        upstream.once('error', reject);
        upstream.end(body);
    });
}

function sendError(res, status, message) {
    res.statusCode = status;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(message);
}
