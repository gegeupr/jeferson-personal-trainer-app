# Tarefa: Atualizar textos do modelo ANTIGO → modelo NOVO

Varredura feita em 13/06/2026. **Nada foi alterado ainda** — esta é a lista de trabalho.

## Modelo NOVO (referência)
- Professor paga **R$ 59,90/mês** via cartão (Stripe).
- **7 dias de trial grátis** para novos professores.
- Professor cobra os alunos **via Pix** (fora da plataforma; cadastra a chave Pix no perfil).
- Aluno tem **30 dias de acesso** após o professor liberar manualmente.

---

## 🔴 CRÍTICO — "Professor gratuito" (contradiz o modelo pago)
- `src/app/page.tsx:168` — badge "Plataforma **gratuita** para professores" → "Teste grátis por 7 dias".
- `src/app/page.tsx:187` — CTA "Criar conta **grátis**" → "Começar teste grátis" (deixar claro: 7 dias, depois R$ 59,90/mês).
- `src/app/page.tsx:254` — Step desc "Professor entra **grátis**." → "7 dias grátis, depois R$ 59,90/mês."

## 🔴 Página `/planos` inteira = modelo antigo (single-trainer)
- `src/app/planos/page.tsx` (todo) — página de vendas do "Jeferson Parowski" (R$150/220/80, CTAs WhatsApp pessoal). Não tem relação com o SaaS Motion.
- **DECISÃO NECESSÁRIA:** deletar a rota **ou** transformar em landing de pricing do Motion (R$59,90 + trial).

## 🟠 Trial/preço não comunicados (onboarding + cadastro)
- Landing (`src/app/page.tsx`) nunca menciona R$ 59,90 nem o trial de 7 dias de forma honesta — só diz "grátis". Falta um bloco de pricing.
- `src/app/login/page.tsx` (~L418-427) — ao escolher "Sou professor", não há aviso de que é pago (7 dias grátis → R$ 59,90).
- `src/app/login/page.tsx:285` — msg pós-cadastro genérica; para professor poderia dizer "Seu teste de 7 dias começou".

## 🟠 SEO / Metadata do trainer antigo
- `src/app/metadata.ts` (todo) — title/description/keywords/OG/URL todos "Jeferson Parowski… Ponta Grossa / jefersonparowski.vercel.app". Trocar para **Motion** (SaaS para personal trainers).

## 🟡 Métodos de pagamento desalinhados
- `src/app/page.tsx:267` — "Pix, **Mercado Pago**, PicPay…" → modelo foca em **Pix**. Alinhar/limpar.

## 🟡 CTA/fluxo faltando
- Sem link visível para `/professor/pricing` no app logado (professor em trial não vê como assinar; só é levado lá quando o trial expira via middleware).
- Sugestão: **banner no dashboard do professor** ("Seu teste acaba em X dias — assinar agora") + item no menu. (Melhoria de fluxo, não só texto.)

---

## ✅ Já corretas — NÃO mexer
- `src/app/professor/pricing/page.tsx` (R$59,90 + "7 dias grátis").
- `src/app/aluno/planos/page.tsx` (lê `professor_planos` + `aluno_assinaturas`; "Pagar agora" via Pix + comprovante WhatsApp).
- `src/app/aluno/assinatura/page.tsx` (status + chave Pix do professor).
- `src/app/professor/planos/page.tsx` (professor define planos 30/90/180 p/ alunos — coerente; valores são defaults).

## Ordem sugerida de execução
1. Landing `page.tsx` + `metadata.ts`.
2. Decisão sobre `/planos` (deletar vs pricing do Motion).
3. Cadastro/onboarding (`login/page.tsx`).
4. Banner/CTA de assinatura no dashboard do professor.

Trabalhar **uma de cada vez, mostrando antes de alterar** (preferência do dono). Sem `@ts-nocheck`. Marca/visual: logo nova **M branca / fundo preto** (lime deixou de ser obrigatório — ver [[motion-design-direction]]).

---

## ⚠️ Estado operacional pendente desta sessão
- `.env.local`: `NEXT_PUBLIC_SITE_URL` foi trocado para `http://localhost:3000` para teste local. **REVERTER para `https://www.motionpersonal.com.br`** quando terminar de testar.
- Stripe: configurado em **modo TESTE** (price R$59,90 `price_1ThuGn...`, webhook via `stripe listen`). Teste real pela UI ainda **não concluído** (ir direto em `/professor/pricing`).
- **Pendente LIVE/produção:** na Vercel pôr `sk_live`, o price **live de R$59,90** (há 2 prices live no produto `prod_UhHplVpjwnzylj` — confirmar qual é 59,90), e `whsec` live de um endpoint criado no dashboard (`/api/stripe/webhook`).
- Pode haver `npm run dev` + `stripe listen` rodando em background desta sessão.
