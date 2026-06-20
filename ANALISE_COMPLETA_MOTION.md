# Análise Completa do Projeto Motion

**Projeto:** site-personal-trainer (brand: Motion)  
**Tipo:** Plataforma SaaS para personal trainers (gestão de alunos, treinos, biblioteca, assinaturas, progresso e comunidade)  
**Stack principal:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 4 + Supabase (auth + DB + SSR) + Stripe + Mercado Pago (híbrido) + Cloudinary  
**Data da análise:** 2026-06-11 (exploração em modo /plan)  
**Escopo explorado:** Estrutura completa de pastas, ~40+ arquivos de código-fonte (páginas, componentes, utils, APIs, guards), middleware, configs, public assets e padrões de uso em todo o app. Nenhuma alteração de código foi feita.

---

## 1. Estrutura de Pastas e Organização do Código

**Pontos positivos:**
- Uso correto do App Router do Next.js 15.
- Separação clara por papéis: `/aluno/*` (aluno logado) e `/professor/*` (com sub-rotas profundas por `[alunoId]` para CRM completo).
- Rotas públicas bem definidas: `/`, `/login`, `/p/[slug]` (perfil público do professor), `/termos`, `/privacidade`, `/planos`.
- Utils isolados para Supabase (`supabase-browser.ts`, `supabase-server.ts`, `supabaseAdmin.ts`).
- `middleware.ts` centraliza proteção de rotas + role check.
- Public com manifest, ícones, imagens e vídeo mobile (boa organização de assets).
- `components/` com seções reutilizáveis (CommunitySection, MontarTreinoExtra, MobileMenu, HeroCover16x9).

**Problemas graves de organização:**
- **Quase zero abstração compartilhada:** Tipos (Aluno, Assinatura, Plano, etc.) duplicados em praticamente todas as páginas (ver professor/dashboard, aluno/dashboard, aluno/planos, professor/alunos, treinos, etc.).
- **Helpers repetidos:** `onlyDigits`, `waLink`, `formatDate`, `parseBRLToCents`, `subToUI`, `badgeClass`, cooldown logic etc. aparecem em 5-10 arquivos.
- **Sem camadas:** Não existe `lib/`, `services/`, `hooks/`, `types/`, `components/ui/`. Tudo inline ou em páginas.
- **Páginas monolíticas:** `professor/treinos/page.tsx` e `professor/dashboard/page.tsx` são enormes (centenas de linhas com lógica de negócio + UI + fetches).
- **Falta de layouts aninhados:** Não há layout compartilhado para áreas autenticadas (header/sidebar/nav comum). Cada página repete top bar, logout, etc.
- **Arquivos órfãos/legado:** `src/app/metadata.ts` contém metadados antigos de "Jeferson Parowski" (conflito direto com `layout.tsx` que define "Motion"). Não é importado.
- **Profundidade de rotas:** Bom para features, mas sem barrel exports ou estrutura de features (ex.: feature "aluno-crm" ou "workout-builder").
- **API routes:** Apenas 4 (stripe checkout/webhook + community sign + public professor). Muita lógica sensível ainda no client.

**Resumo:** Organização inicial boa para MVP, mas escala para "spaghetti de páginas client" sem DRY ou separação de concerns.

---

## 2. Qualidade do Código (Clean Code, Boas Práticas, Repetição)

**Pontos positivos:**
- TypeScript strict habilitado.
- Uso consistente de async/await + try/catch na maioria dos lugares.
- Algumas funções utilitárias locais bem intencionadas (ex.: formatação de datas, WhatsApp links BR).
- Componentes funcionais pequenos em alguns lugares (Stat, Card, Step, Pill).

**Problemas críticos:**
- **40 arquivos com `"use client"`** (quase todo o app). Zero menção a Server Actions ou `"use server"`. Tudo é client-side data fetching.
- **Duplicação massiva de lógica de autenticação/perfil:**
  - `dashboard/page.tsx`, `aluno/dashboard`, `professor/dashboard`, `professor/alunos`, `login`, guards, etc. repetem: `supabase.auth.getUser()` + fetch `profiles` + role check + redirect.
  - `useProfessorGuard.tsx` existe mas é pouco usado / duplicado inline.
- **Tipagem fraca:** `as any` / `: any` em >30 lugares (ex.: professor/dashboard:158-175, treinos page, community, MontarTreinoExtra, APIs). Sem tipos gerados do Supabase ou schemas Zod.
- **`@ts-nocheck`** em rotas críticas de pagamento (stripe/create-checkout-session e webhook).
- **Business logic espalhada:** Cálculo de assinatura (dias restantes, subToUI), aprovação manual de pendências, vínculo aluno-professor via localStorage + RPC – tudo repetido ou inline.
- **Sem abstração de dados:** Fetches N+1 manuais (busca ids → Promise.all de várias tabelas → Map para enriquecer). Sem views, RPCs consistentes ou camada de acesso.
- **Error handling inconsistente:** Mistura de `console.error`, `setError`, `alert()`, `throw`. Sem Error Boundaries, sem tratamento centralizado.
- **Estado global ausente:** Nenhum Context, Zustand, Jotai ou similar. Cada página recarrega tudo.
- **Formulários:** Validação manual + inputs controlados simples. Sem react-hook-form, Zod, máscaras consistentes.
- **Exemplos concretos de repetição:** 
  - `waLink` / phone helpers em login, professor/dashboard, aluno/planos, professor/alunos, etc.
  - Lógica de "pending welcome" + localStorage em login, dashboard, bem-vindo.
  - Fetch + enrich de feed/conclusões em professor/dashboard e professor/alunos.

**Resumo:** Qualidade de "protótipo que virou produto". Funciona, mas alto custo de manutenção e risco de bugs por drift.

---

## 3. Performance e Otimizações

**Pontos positivos:**
- Next.js 15 + Turbopack no dev (rápido).
- `next.config.ts` bem configurado: remotePatterns para Supabase/Cloudinary/YouTube/Google, `formats: ["image/avif", "image/webp"]`, `minimumCacheTTL`, headers de cache longo para `/_next/static`.
- Uso de `<Image>` (Next) na maioria dos perfis/capas/avatars (bom).
- Landing hero com video mobile + img desktop + sticky premium effect (criativo).
- Algumas queries com `.limit()` e `head: true` para counts.

**Problemas sérios:**
- **Zero Server Components para dados:** Todas as telas principais (dashboards, listas de alunos, treinos, planos, progresso) são client e disparam fetches no mount. Sem streaming, sem Suspense para dados, sem PPR.
- **Sem caching/revalidação:** Supabase client calls são sempre fresh. Sem React Query, SWR, ou `fetch(..., { next: { revalidate } })`. Cada navegação = roundtrips extras (auth + profile + 3-5 queries).
- **Enriquecimento manual de relações:** Muitos casos de buscar lista → ids únicos → 3 fetches paralelos → map (professor/dashboard, alunos page, feed).
- **Landing e mídia:** `<img>` puro na hero desktop (sem `loading="lazy"` otimizado ou priority correto em todos), video autoplay sem otimizações avançadas (ex.: preload controlado).
- **Bundle:** Todo o app (incluindo lógica pesada de builder de treinos) é client. Sem lazy loading de modais complexos (MontarTreinoExtra).
- **Listas sem paginação/infinite scroll real:** Algumas trazem 300+ itens (conclusões).
- **Build permissivo:** `typescript: { ignoreBuildErrors: true }` + `eslint: { ignoreDuringBuilds: true }` → erros de perf/qualidade podem passar silenciosamente.
- **Sem otimizações de imagem em alguns uploads** (progresso/aluno usa supabase storage direto?).

**Resumo:** Performance aceitável para volume baixo de usuários. Degrada rápido com mais alunos/treinos por professor. TTFB e INP impactados pelo client-heavy.

---

## 4. UI/UX e Acessibilidade

**Pontos positivos:**
- Design visual premium e coeso: fundo preto, cards glassmorphism `bg-white/5`, bordas sutis, lime-400 como acento forte. Perfeito para marca fitness "Motion".
- Bom uso de Tailwind 4, tipografia Inter, espaçamentos consistentes.
- Landing limpa com storytelling (capa → sticky text → features → como funciona → footer).
- Professor alunos page tem filtros rápidos + busca + contadores (bom UX de CRM).
- Cards com hover e ícones SVG custom (Icon component).
- Perfis públicos com CommunitySection embutida.

**Problemas:**
- **Native modals ruins:** 28+ ocorrências de `alert()` e `confirm()` (deletes de planos/rotinas/exercícios, aprovar/cancelar pendências, inativar aluno, etc.). UX quebra, não acessível, mobile ruim. Alguns comentários indicam tentativas de correção mas código ainda usa.
- **Feedback de loading/estado fraco:** "Carregando Motion…", "Carregando dashboard…". Sem skeletons, spinners consistentes, optimistic UI ou transições.
- **Acessibilidade deficiente:**
  - Poucos `aria-*`, labels, roles em elementos dinâmicos (ex.: filtros, botões de ação em listas).
  - Menu mobile custom simples (sem focus trap, sem roving tabindex).
  - Botões de submit sem `disabled` + loading em todos os casos.
  - Contrastes ok mas não auditados (ex.: text-white/50 em bg-black/30).
  - Sem skip links, landmarks semânticos fortes.
- **Navegação inconsistente:** Sem sidebar ou bottom nav compartilhada para professor/aluno. Usuário se perde fácil em sub-rotas `[alunoId]/*`.
- **Formulários longos:** Builder de treinos (biblioteca + catálogo + rotinas) é complexo e tudo client-state.
- **Sem empty/loading/error states padronizados.**
- **Comunidade:** Posts pendentes (status) mas UX de moderação básica.

**Resumo:** Visual forte e "premium" para o nicho, mas polimento de UX e a11y está em nível MVP. Impacta retenção e profissionalismo.

---

## 5. Segurança e Boas Práticas (especialmente React/Next.js)

**Pontos positivos:**
- Middleware com `createServerClient` + role check em `profiles.role` antes de renderizar áreas protegidas (bom).
- Uso de `supabaseAdmin` (service role) apenas em rotas server (API stripe, webhook) – correto para ops privilegiadas.
- Auth via Supabase (email confirm, reset) + metadata no signup.
- Roteamento de `next` após login/cadastro com `?next`.
- Checks de env em vários lugares + throw em supabaseAdmin (detecta misconfig cedo).
- Public professor page usa API route (não expõe queries client diretamente).

**Problemas graves (Next.js / app patterns):**
- **Lógica sensível no cliente:** Aprovação/cancelamento de assinaturas (`aluno_assinaturas` updates), inativação de alunos, deletes de treinos/rotinas/exercícios, uploads de community – tudo via `supabase` browser client em páginas professor. Confia 100% em RLS do Supabase. Se RLS tiver falha ou for burlado (devtools, token leak), problema grave. Deve estar em Server Actions ou rotas API com validação server-side (professor_id ownership).
- **Dupla tabela de assinaturas:** Código usa `aluno_assinaturas` (nova, em dashboards e aluno) **e** `assinaturas` (antiga, em stripe APIs e professor/alunos page). Risco de inconsistência, race conditions e bypass de pagamento.
- **localStorage para controle de fluxo crítico:** 
  - `PROF_STORAGE_KEY`, `WELCOME_PENDING_KEY`, `RESET_COOLDOWN_UNTIL_KEY`.
  - Usado para auto-vincular aluno → professor e welcome. Fácil de manipular no client, não sobrevive a logout/limpeza, não seguro.
- **Webhook e checkout:** Hardcoded product names/prices (R$150), nomes de planos misturados com "mp", @ts-nocheck, tratamento parcial de eventos Stripe (muitos console.log sem ação real).
- **Ausência de validação server-side em mutations client.**
- **Exposição de service role:** O util `supabaseAdmin.ts` faz throw no import – ok, mas qualquer import acidental em client bundle é catastrófico (embora tree-shake ajude).
- **Sem proteção extra:** Sem rate limiting explícito além do Supabase, sem CSRF extra (Next cuida em alguns), sem sanitização explícita de inputs de texto (bio, descrições, feedback).
- **Build ignores:** Permite deploy de código com erros de tipo/segurança.
- **Middleware matcher:** Protege bem, mas rotas como `/dashboard` (redirector client) ainda carregam JS.

**Resumo:** Autenticação/roteamento decente para o tamanho. Autorização de dados e mutations é o maior risco (RLS + client writes). Pagamentos em estado híbrido/legacy perigoso.

---

## 6. Possibilidades de Escalabilidade

**Pontos positivos:**
- Supabase + Next serverless escala horizontalmente bem para dezenas/centenas de trainers.
- Multi-tenant natural (professor_id em quase todas tabelas + slug público).
- Features completas já cobrem o core de um personal trainer digital (biblioteca própria, builder de treinos, controle de acesso por assinatura, progresso visual, comunidade).
- Pagamento direto professor-aluno (modelo de negócio correto, Motion não é intermediário).

**Riscos e limitações atuais:**
- **Queries não otimizadas:** Sem índices implícitos garantidos, sem paginação server-side em CRM de alunos ou histórico de conclusões. Com 50+ alunos por prof + histórico, dashboards ficam lentos.
- **Ausência de jobs/cron:** Expiração de assinaturas, notificações de vencimento, limpeza de pendências – tudo reativo (aluno abre página e é redirecionado). Precisa de Edge Functions ou Vercel Cron + fila.
- **Schema em evolução:** Tabelas paralelas (assinaturas vs aluno_assinaturas), campos legacy (plano_mp_id), risco de drift.
- **Sem observabilidade:** Zero logs estruturados, métricas, error tracking (Sentry), analytics de uso.
- **Monólito de componentes:** Adicionar "exercícios globais", "modelos de treinos", "relatórios", "notificações push", "integração WhatsApp Business API" vai duplicar mais código.
- **Sem testes:** Nenhum teste unitário, integração ou E2E visível → regressões fáceis em refactors de pagamento/treino.
- **Limites de storage/imagens:** Cloudinary + Supabase storage ok, mas sem quotas por tenant ou CDN custom.
- **Internacionalização / white-label:** Difícil (strings hardcoded, sem i18n).
- **Custo:** Muitas chamadas client + realtime não usado = desperdício de quota Supabase.

**Potencial:** Excelente produto de nicho. Com refatoração de arquitetura (ver melhorias abaixo) escala para centenas de trainers e milhares de alunos.

---

## 7. Tecnologias e Stack (está usando as melhores ferramentas atuais?)

**O que está excelente (2026 standards):**
- Next.js 15 + React 19 + App Router + Turbopack + TypeScript strict + Tailwind 4 → top tier.
- Supabase (SSR client oficial, auth, DB, storage, RPCs) → escolha perfeita para este produto (rápido de iterar, RLS poderoso, barato).
- Cloudinary + next-cloudinary → bom para imagens de capa/avatar.
- Stripe para subs recorrentes → correto.

**O que está desatualizado / subótimo:**
- **Sem UI component library:** Tudo custom Tailwind. Perde velocidade, consistência e a11y (deveria ter shadcn/ui + Radix ou similar para modals, selects, forms, tables).
- **Sem data fetching library:** TanStack Query (React Query) ou SWR é essencial para este volume de client fetches + mutations + cache de perfil/assinatura.
- **Forms:** Manual. react-hook-form + zod resolver resolveria validação, UX e tipagem.
- **Pagamentos:** Híbrido confuso (Stripe checkout + manual PIX pending + resquícios de Mercado Pago). Melhor unificar em Stripe (com Pix via Stripe ou link manual seguro) ou usar uma solução BR completa.
- **Tipos:** Sem `@supabase/ssr` types gerados + Zod para domain. Confia em `as any`.
- **Sem Server Actions:** Next 15 feature madura para mutations seguras – não usado.
- **Estado/arquitetura:** Client-heavy. Poderia usar mais Server Components + revalidation tags + partial prerender.
- **DevEx:** Sem lint rules fortes (no-alert, no-console em prod, etc.), sem Husky/pre-commit, sem CI visible, sem error boundary global.
- **Observability:** Ausente.
- **Testes:** Zero.

**Conclusão stack:** Base excelente e moderna. Camada de aplicação (UI + data + forms + segurança server) está 2-3 anos atrás do que seria ideal para um produto pago em 2026. Fácil de modernizar incrementalmente.

---

## 10 Melhorias Prioritárias (ordenadas por impacto)

Ordenação por **impacto combinado** (segurança + risco de bugs + velocidade de desenvolvimento futuro + experiência do usuário final + performance). Baixo esforço relativo primeiro quando possível.

### 1. Refatorar para Server Components + Server Actions (maior impacto geral)
**Impacto:** Crítico (segurança, performance, DX, manutenção).  
**Explicação:** O app é 95% client-side fetches + lógica duplicada. Isso causa: (a) exposição de mutations sensíveis, (b) performance ruim, (c) duplicação insana de auth/profile, (d) bundle inchado. É o maior bloqueador de escalabilidade e qualidade.

**Como implementar (passos concretos):**
- Converter dashboards e páginas de listagem principais para Server Components async (use `createSupabaseServer()`).
- Criar Server Actions (`"use server"`) para todas as mutations críticas: aprovar/cancelar assinatura, inativar aluno, salvar anamnese, criar/atribuir treino, deletar rotinas, etc. Validar ownership (professor_id === user.id) no server.
- Manter apenas UI interativa complexa (builder de treinos, filtros client) como client islands com "use client".
- Adicionar `loading.tsx` e `error.tsx` em rotas principais + Suspense boundaries.
- Remover ou deprecate `useProfessorGuard` (middleware + server já cobre).
- Arquivos chave: `professor/dashboard`, `aluno/dashboard`, `professor/alunos`, `professor/treinos`, `aluno/planos`, `aluno/meus-treinos`.

### 2. Unificar modelo de Assinaturas/Pagamentos + limpar legacy
**Impacto:** Alto (segurança de receita + bugs de acesso + confusão de código).  
**Explicação:** Duas tabelas (`aluno_assinaturas` vs `assinaturas`), campos misturados com "mp", lógica de pending/activate espalhada entre client professor e APIs Stripe. Risco real de aluno acessar sem pagar ou professor não receber.

**Como implementar:**
- Escolher **uma** tabela canônica (recomendo evoluir `aluno_assinaturas` ou renomear para `subscriptions` clara).
- Fazer migration + backfill de dados existentes.
- Atualizar Stripe webhook e create-checkout para usar a tabela unificada.
- Mover toda aprovação manual (PIX) para Server Action ou rota API protegida.
- Remover todos os comentários e branches de "Mercado Pago legacy".
- Padronizar status: `pending | active | expired | canceled`.
- Adicionar campos claros: `payment_method`, `amount_cents`, `external_id`.
- Testar fluxo completo: aluno solicita via professor planos → pending → prof aprova ou Stripe checkout → active.

### 3. Substituir alert/confirm por sistema de Modal + Toast moderno
**Impacto:** Alto (UX profissional + acessibilidade + retenção).  
**Explicação:** 28+ usos de APIs nativas destroem a experiência, quebram em mobile, não são acessíveis e parecem amador.

**Como implementar:**
- Criar componentes reutilizáveis `Modal`, `ConfirmDialog`, `ToastProvider` (ou usar Sonner + shadcn dialog).
- Substituir todos os `alert()` / `confirm()` por chamadas ao sistema (ex.: `confirm("Deletar plano?")` → modal com ações).
- Adicionar feedback de sucesso/erro via toast em todas as ações (criar treino, aprovar, upload, etc.).
- Priorizar páginas de alto risco: professor/treinos, professor/alunos/[id]/* (delete/inativar), professor/dashboard (pendências), biblioteca, community.
- Fazer acessível (focus trap, ESC, aria).

### 4. Fortalecer qualidade de build e lint + adicionar tipos rigorosos
**Impacto:** Alto (prevenção de bugs + profissionalismo).  
**Explicação:** Ignorar erros de TS/ESLint no build é anti-padrão. Tipos `any` mascaram problemas reais.

**Como implementar:**
- Remover `ignoreBuildErrors` e `ignoreDuringBuilds` do `next.config.ts`.
- Expandir `eslint.config.mjs`: adicionar regras `no-alert`, `no-console` (exceto error em dev), `@typescript-eslint/no-explicit-any` como error (ou warn com allow list temporário).
- Gerar tipos Supabase (`supabase gen types typescript`) e criar `types/database.ts`.
- Introduzir Zod schemas para domain (Plano, Assinatura, TreinoInput, etc.) e usar em forms/actions.
- Adicionar pre-commit (Husky + lint-staged) e CI (GitHub Actions) que roda build + lint + typecheck.
- Corrigir o conflito `metadata.ts` vs `layout.tsx` (remover ou unificar metadados corretos do Motion).

### 5. Centralizar tipos, helpers e lógica de dados (camada de abstração)
**Impacto:** Alto (velocidade de dev + redução de bugs).  
**Explicação:** Cada página reinventa o wheel. Adicionar feature nova = copiar 100 linhas.

**Como implementar:**
- Criar `types/` (ou `lib/types`) com todos os modelos compartilhados + Zod.
- Criar `lib/supabase/` ou `services/` com funções reutilizáveis: `getCurrentProfile()`, `getAlunoAssinatura(alunoId)`, `linkAlunoToProfessor(slug)`, `getProfessorAlunos(profId)`, `enrichConclusoes(feed)`.
- Extrair hooks: `useCurrentUser()`, `useAssinatura()`, `useProfessorAlunos()`.
- Mover helpers repetidos (`onlyDigits`, `waLink`, `formatDate`, `moneyBRLFromCents`, `daysLeft`) para `lib/utils.ts`.
- Usar React Query (ou similar) para cache, mutations, optimistic updates e revalidação automática.
- Atualizar todos os arquivos que duplicam para usar a nova camada.

### 6. Mover operações sensíveis para rotas API / Server Actions seguras + revisar RLS
**Impacto:** Crítico para segurança.  
**Explicação:** Updates de `aluno_assinaturas`, inativação de alunos, deletes de treinos etc. no client é o maior vetor de risco.

**Como implementar:**
- Criar rotas em `app/api/professor/...` ou Server Actions para: approve/cancel assinatura, update aluno status, delete treino/rotina/exercicio (com verificação server-side de `professor_id`).
- Usar `supabaseAdmin` apenas quando necessário, com logs.
- Adicionar validação de input (Zod) + ownership check em todo lugar.
- Auditar políticas RLS no Supabase (garantir que aluno não consiga ler/gravar dados de outros, professor só manipula seus alunos).
- Remover ou proteger RPCs públicas se expuserem demais.
- Para Stripe: garantir que `client_reference_id` + assinatura matching seja validado rigidamente.

### 7. Adicionar camada de UI compartilhada + melhorar acessibilidade e navegação
**Impacto:** Médio-alto (consistência + profissionalismo + a11y).  
**Explicação:** Visual bom, mas execução inconsistente e inacessível.

**Como implementar:**
- Instalar/adotar shadcn/ui (ou similar) para Button, Dialog, Table, Form, Toast, Select, etc. Refatorar componentes existentes para usar.
- Criar layouts aninhados: `app/(dashboard)/layout.tsx` para aluno e professor (com sidebar ou top nav compartilhada, user menu, logout).
- Adicionar `aria-label`, `role`, labels, focus-visible em todos os componentes interativos.
- Implementar skeletons (ex.: com `react-loading-skeleton` ou simples divs animadas) para todos os estados de loading.
- Melhorar MobileMenu com biblioteca acessível ou Radix.
- Padronizar empty states e error states.
- Adicionar atalhos de teclado onde faz sentido (ex.: busca).

### 8. Implementar caching, paginação e otimização de dados/performance
**Impacto:** Médio-alto (escala + UX percebida).  
**Explicação:** Dashboards e listas vão travar com crescimento.

**Como implementar:**
- Adotar TanStack Query + mutations com invalidation automática.
- Adicionar paginação server-side (limit + offset ou cursor) em `/professor/alunos`, feed de conclusões, histórico de treinos.
- Usar `revalidatePath` / `revalidateTag` após mutations server.
- Otimizar landing: usar `next/image` para capa desktop, lazy para video ou poster otimizado, talvez streaming de seções.
- Adicionar `loading.tsx` root + route groups.
- Medir com Lighthouse / Vercel Analytics e corrigir.

### 9. Eliminar hacks de localStorage e melhorar fluxos de autenticação/onboarding
**Impacto:** Médio (confiabilidade + segurança).  
**Explicação:** Fluxos de "entrar via link do professor", welcome, cooldown de reset dependem de localStorage – quebram fácil.

**Como implementar:**
- Mover estado de "welcome pending" e "prof slug link" para server (coluna temporária no profile ou tabela `onboarding_state`, ou query param + session).
- Usar Supabase `onAuthStateChange` de forma mais robusta + server-side redirects.
- Para cooldown de reset: usar server-side rate limit (Supabase já tem, ou implementar simples em DB).
- Melhorar callback `/auth/callback` para lidar com next + role + professor link de forma server-only quando possível.
- Adicionar página de "bem-vindo" mais rica e remover dependência frágil.

### 10. Modernizar o builder de treinos + biblioteca + adicionar testes básicos
**Impacto:** Médio (feature core + manutenção).  
**Explicação:** `professor/treinos` e `MontarTreinoExtra` são os mais complexos e cheios de state local + any. É o coração do produto.

**Como implementar:**
- Extrair o builder para componentes menores + hooks (`useTreinoBuilder`, `useRotinaEditor`).
- Unificar "biblioteca" vs "catalogo" se forem conceitos diferentes (ou documentar).
- Adicionar drag-and-drop acessível para reordenar exercícios/rotinas (dnd-kit ou similar).
- Adicionar testes (Vitest + Testing Library) para lógica pura de builder e utils primeiro.
- Depois, Playwright para fluxos críticos (criar treino → atribuir → aluno conclui).
- Considerar extrair para feature folder `features/workouts/`.

---

## Recomendações de Execução (ordem sugerida)

1. **Fase 0 (imediata, alto risco baixo esforço):** #4 (remover ignores de build + corrigir metadata.ts) + #3 (começar a trocar alerts por modal em 1-2 páginas críticas).
2. **Fase 1 (fundação, 1-2 semanas):** #1 (Server Components + Actions em 2-3 páginas chave) + #5 (camada de tipos + utils central).
3. **Fase 2 (segurança e receita):** #2 (unificar assinaturas) + #6 (mover mutations sensíveis).
4. **Fase 3 (qualidade e escala):** #7 (UI lib + layouts + a11y) + #8 (caching/paginação).
5. **Fase 4 (polimento):** #9 + #10 + observabilidade (Sentry + logs) + testes.

**Prioridade de deploy:** Qualquer mudança em pagamentos/assinaturas deve ter migration + testes manuais completos + rollback plan.

**Benefício esperado após top 5:** 
- Código 40-60% menor (menos duplicação).
- Melhor performance percebida (menos spinners, mais server render).
- Risco de segurança de dados/receita drasticamente reduzido.
- Velocidade de adicionar features 2-3x maior.
- Produto parece "pronto para produção pago".

---

## Observações Finais

O projeto Motion tem **excelente produto-market fit** e uma base visual/funcional muito boa para personal trainers brasileiros. O problema não é falta de features — é dívida técnica de arquitetura client-heavy + repetição que vai frear o crescimento e aumentar bugs.

Como estamos em **/plan**, nenhuma mudança foi aplicada. Este documento serve como base para priorização e execução futura (pode ser usado com `/execute-plan` ou skills de implementação).

Se o usuário aprovar, podemos prosseguir com implementação incremental das melhorias (começando pelas de maior impacto/risco).

**Confiança na análise:** Alta (exploração profunda de estrutura, código de páginas principais, APIs, guards, padrões de repetição e configs). \confidence{80}

---

*Plano gerado automaticamente via exploração em plan mode. Próximo passo: usuário revisar e aprovar (ou pedir ajustes) antes de qualquer edição.*