// src/app/termos/page.tsx
import Link from "next/link";

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-black text-white px-4 py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">
          Termos de Uso
        </h1>

        <p className="mt-4 text-white/70">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <section className="mt-8 space-y-6 text-white/80 leading-relaxed">
          <p>
            O <strong>Motion</strong> é uma plataforma digital criada para
            auxiliar personal trainers na gestão de alunos, treinos e
            informações relacionadas à prática de atividade física.
          </p>

          <p>
            Ao acessar ou utilizar o Motion, você concorda com estes Termos de
            Uso. Caso não concorde, recomendamos que não utilize a plataforma.
          </p>

          <h2 className="text-xl font-semibold text-white mt-6">
            1. Cadastro e acesso
          </h2>
          <p>
            O acesso ao Motion é permitido a professores e alunos devidamente
            cadastrados. Cada usuário é responsável pelas informações fornecidas
            no momento do cadastro.
          </p>

          <h2 className="text-xl font-semibold text-white mt-6">
            2. Responsabilidades
          </h2>
          <p>
            O Motion não se responsabiliza por prescrições de treino, orientações
            físicas ou resultados obtidos pelos alunos. Todo conteúdo inserido
            na plataforma é de responsabilidade do professor.
          </p>

          <h2 className="text-xl font-semibold text-white mt-6">
            3. Pagamentos
          </h2>
          <p>
            O Motion não intermedia pagamentos entre professores e alunos. O
            controle de acesso do aluno é feito com base nas informações
            fornecidas pelo professor.
          </p>

          <h2 className="text-xl font-semibold text-white mt-6">
            4. Uso adequado
          </h2>
          <p>
            É proibido utilizar a plataforma para fins ilegais, abusivos ou que
            violem direitos de terceiros.
          </p>

          <h2 className="text-xl font-semibold text-white mt-6">
            5. Alterações
          </h2>
          <p>
            Estes Termos podem ser alterados a qualquer momento, sendo
            responsabilidade do usuário revisá-los periodicamente.
          </p>
        </section>

        <div className="mt-10">
          <Link
            href="/"
            className="text-lime-400 hover:text-lime-300 text-sm"
          >
            ← Voltar para a página inicial
          </Link>
        </div>
      </div>
    </main>
  );
}
