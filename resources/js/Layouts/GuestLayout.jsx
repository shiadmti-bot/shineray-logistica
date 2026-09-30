import { Link } from '@inertiajs/react';

/**
 * Casca das telas de acesso (V3).
 *
 * DUAS SUPERFÍCIES, E CADA UMA MANDA NO PRÓPRIO TEXTO
 *
 *   FUNDO DE MARCA  -> `brand-*` é paleta fixa de propósito: marca não muda
 *                      com o tema do usuário. Sobre ele o texto é branco fixo,
 *                      porque `text-content-primary` daria preto sobre
 *                      vermelho no tema claro.
 *   CARTÃO          -> tokens (`surface-card`, `content-*`, `line`). É o que
 *                      faz a tela acompanhar claro e escuro sem variante
 *                      `dark:`, já que o tema troca as variáveis CSS.
 *
 * Misturar os dois é o erro clássico — e a razão de `text-white` e `bg-white`
 * aparecerem aqui sem serem descuido.
 *
 * O que saiu: o cartão era `bg-white/98` com `backdrop-blur-xl`, ou seja,
 * branco fixo. No tema escuro ele continuaria branco enquanto o resto do
 * sistema escurecia. Agora é `surface-card`.
 *
 * Também saíram cinco divs decorativos com `animate-pulse` e `animate-ping`:
 * movimento contínuo numa tela de formulário compete com o campo que a pessoa
 * veio preencher, e nada ali respeitava `prefers-reduced-motion`.
 */
export default function GuestLayout({ titulo, descricao, children }) {
    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-950 via-brand-800 to-brand-700 px-4 py-12">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:28px_28px]"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-48 -top-48 h-[34rem] w-[34rem] rounded-full bg-white/10 blur-3xl"
            />

            <div className="relative z-10 w-full max-w-md space-y-6">
                <div className="flex justify-center">
                    <Link href="/" className="rounded-2xl bg-white px-7 py-4 shadow-xl shadow-black/20 transition hover:shadow-2xl">
                        <img
                            src="/img/logo.png"
                            alt="Shineray By Sabel"
                            className="h-11 w-auto object-contain"
                        />
                    </Link>
                </div>

                {/* Daqui para dentro é superfície de token: segue o tema. */}
                <div className="overflow-hidden rounded-2xl border border-line bg-surface-card shadow-2xl shadow-black/30">
                    <div className="h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-brand-700" />

                    <div className="px-8 py-9 sm:px-10">
                        {(titulo || descricao) && (
                            <div className="mb-7">
                                {titulo && (
                                    <h1 className="text-2xl font-bold tracking-tight text-content-primary">
                                        {titulo}
                                    </h1>
                                )}
                                {descricao && (
                                    <p className="mt-1 text-sm text-content-secondary">
                                        {descricao}
                                    </p>
                                )}
                            </div>
                        )}

                        {children}
                    </div>
                </div>

                {/* De volta à superfície de marca: branco fixo, não token. */}
                <div className="space-y-1.5 text-center text-white/80">
                    <p className="text-xs">
                        © {new Date().getFullYear()} Shineray By Sabel · Logística &amp; Distribuição
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">
                        Sistema V3 · Hub &amp; Spoke · Milk Run
                    </p>
                </div>
            </div>
        </div>
    );
}
