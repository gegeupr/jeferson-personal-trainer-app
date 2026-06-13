import { NextResponse } from 'next/server';

// Endpoint LEGADO. No modelo novo o aluno não paga via Stripe (passou a ser Pix manual);
// o checkout do Stripe agora é do PROFESSOR (será criado em /api/stripe/professor-checkout
// na Prioridade 3/5, já com auth via sessão). Desativado para fechar o IDOR antigo
// (alunoId vinha do body, sem autenticação).
export async function POST() {
  return NextResponse.json(
    { error: 'Endpoint descontinuado. A cobrança de alunos passou a ser via Pix.' },
    { status: 410 }
  );
}
