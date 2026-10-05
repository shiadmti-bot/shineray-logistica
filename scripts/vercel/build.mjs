// Build da Vercel: gera .vercel/output (Build Output API v3) com o Laravel
// servido por uma função Node que sobe o PHP 8.4 de @libphp/amazon-linux-2023-v84
// (o mesmo pacote usado pelo vercel-php@0.8.0).
//
// Substitui o runtime vercel-php, cuja função deixou de ser carregada pela
// Vercel (vercel-community/php#650). A função mantém o layout do vercel-php:
//   index.mjs  launcher (scripts/vercel/launcher.mjs)
//   php/       binário, php.ini e extensões
//   lib/       bibliotecas compartilhadas do PHP
//   user/      projeto com vendor/ (api/index.php é o roteador)
//
// Roda como Build Command (vercel.json), depois do `npm run build`.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const OUTPUT_DIR = path.join(ROOT, '.vercel', 'output');
// Mesmo caminho da função no vercel-php, para as rotas continuarem em /api/index.php.
const FUNCTION_DIR = path.join(OUTPUT_DIR, 'functions', 'api', 'index.php.func');

const require = createRequire(import.meta.url);
const LIBPHP_DIR = path.dirname(require.resolve('@libphp/amazon-linux-2023-v84/package.json'));
const PHP_BIN_DIR = path.join(LIBPHP_DIR, 'native', 'php');
const PHP_LIB_DIR = path.join(LIBPHP_DIR, 'native', 'lib');

const MAX_DURATION = 10;

// Fora da função: o que o vercel-php já ignorava, mais a própria saída do build.
const PROJECT_EXCLUDES = new Set(['.git', '.vercel', 'node_modules', 'vercel.json', '.vercelignore']);
// Itens de public/ que não são arquivos estáticos.
const STATIC_EXCLUDES = new Set(['index.php', '.htaccess', 'hot', 'storage']);

// As mesmas rotas que ficavam no vercel.json.
const ROUTES = [
    {
        src: '^/(OneSignalSDKWorker\\.js|plim\\.mp3|build/.*|storage/.*|img/.*|favicon\\.ico|robots\\.txt|manifest\\.json)$',
        headers: { 'cache-control': 'public, max-age=31536000, immutable' },
        dest: '/public/$1',
    },
    { src: '^/(.*)$', dest: '/api/index.php' },
];

// No PHP 8.4, avisos de deprecated de pacotes antigos não podem sair na resposta
// antes de o Laravel assumir o tratamento de erros.
const PHP_INI_OVERRIDES = '\n; scripts/vercel/build.mjs\nerror_reporting = E_ALL & ~E_DEPRECATED\n';

try {
    main();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}

function main() {
    if (process.platform !== 'linux') {
        throw new Error('O build da Vercel usa binários Linux do PHP: rode na Vercel ou no WSL.');
    }

    installComposerDependencies();

    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    copyProject(path.join(FUNCTION_DIR, 'user'));
    copyPhpRuntime();
    fs.copyFileSync(path.join(SCRIPT_DIR, 'launcher.mjs'), path.join(FUNCTION_DIR, 'index.mjs'));
    writeJson(path.join(FUNCTION_DIR, '.vc-config.json'), {
        runtime: `nodejs${process.versions.node.split('.')[0]}.x`,
        handler: 'index.mjs',
        launcherType: 'Nodejs',
        shouldAddHelpers: false,
        maxDuration: MAX_DURATION,
    });
    copyStatic(path.join(OUTPUT_DIR, 'static', 'public'));
    writeJson(path.join(OUTPUT_DIR, 'config.json'), { version: 3, routes: ROUTES });

    console.log(`Função PHP gerada: ${formatSize(directorySize(FUNCTION_DIR))} (limite da Vercel: 250 MB).`);
}

function installComposerDependencies() {
    // Mesmos parâmetros do vercel-php: sem dev, sem scripts e sem checagem de plataforma.
    runComposer(['install', '--no-dev', '--no-interaction', '--no-scripts', '--ignore-platform-reqs', '--no-progress']);

    // O vercel-php também rodava o script "vercel" do composer.json, se existisse.
    const composer = JSON.parse(fs.readFileSync(path.join(ROOT, 'composer.json'), 'utf8'));
    if (composer.scripts?.vercel) {
        runComposer(['run-script', 'vercel', '--no-interaction']);
    }
}

function runComposer(args) {
    const result = spawnSync(
        path.join(PHP_BIN_DIR, 'php'),
        // O php.ini ao lado do binário fixa /var/task/php/modules, que só existe na função.
        ['-d', `extension_dir=${path.join(PHP_BIN_DIR, 'modules')}`, path.join(PHP_BIN_DIR, 'composer'), ...args],
        {
            cwd: ROOT,
            stdio: 'inherit',
            env: {
                ...process.env,
                COMPOSER_HOME: path.join(os.tmpdir(), 'composer'),
                PATH: `${PHP_BIN_DIR}:${process.env.PATH ?? ''}`,
                LD_LIBRARY_PATH: `${PHP_LIB_DIR}:${process.env.LD_LIBRARY_PATH ?? ''}`,
            },
        },
    );
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`composer ${args[0]} falhou (código ${result.status}).`);
    }
}

function copyProject(destination) {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(ROOT)) {
        if (!PROJECT_EXCLUDES.has(entry)) {
            fs.cpSync(path.join(ROOT, entry), path.join(destination, entry), {
                recursive: true,
                verbatimSymlinks: true,
            });
        }
    }
}

function copyPhpRuntime() {
    // php-cgi, php-fpm e composer não são usados em execução.
    const phpDir = path.join(FUNCTION_DIR, 'php');
    fs.mkdirSync(phpDir, { recursive: true });
    fs.copyFileSync(path.join(PHP_BIN_DIR, 'php'), path.join(phpDir, 'php'));
    fs.chmodSync(path.join(phpDir, 'php'), 0o755);
    fs.writeFileSync(
        path.join(phpDir, 'php.ini'),
        fs.readFileSync(path.join(PHP_BIN_DIR, 'php.ini'), 'utf8') + PHP_INI_OVERRIDES,
    );
    fs.cpSync(path.join(PHP_BIN_DIR, 'modules'), path.join(phpDir, 'modules'), { recursive: true });
    fs.cpSync(PHP_LIB_DIR, path.join(FUNCTION_DIR, 'lib'), { recursive: true, verbatimSymlinks: true });
}

function copyStatic(destination) {
    const publicDir = path.join(ROOT, 'public');
    fs.cpSync(publicDir, destination, {
        recursive: true,
        filter: (source) => !STATIC_EXCLUDES.has(path.relative(publicDir, source)),
    });
}

function writeJson(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function directorySize(directory) {
    let total = 0;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        total += entry.isDirectory() ? directorySize(fullPath) : fs.lstatSync(fullPath).size;
    }
    return total;
}

function formatSize(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
