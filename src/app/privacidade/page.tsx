// src/app/privacidade/page.tsx
import Link from "next/link";

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-black text-white px-4 py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">
          Política de Privacidade
        </h1>

        <p className="mt-4 text-white/70">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <section className="mt-8 space-y-6 text-white/80 leading-relaxed">
          <p>
            O <strong>Motion</strong> respeita a sua privacidade e está
            comprometido com a proteção dos dados pessoais de seus usuários.
          </p>

          <h2 className="text-xl font-semibold text-white mt-6">
            1. Dados coletados
          </h2>
          <p>
            Coletamos apenas os dados necessários para o funcionamento da
            plataforma, como nome, e-mail, informações de perfil e dados
            relacionados a treinos.
          </p>

          <h2 className="text-xl font-semibold text-white mt-6">
            2. Uso dos dados
          </h2>
          <p>
            Os dados são utilizados exclusivamente para permitir o uso das
            funcionalidades do Motion, melhorar a experiência do usuário e
            garantir a segurança da plataforma.
          </p>

          <h2 className="text-xl font-semibold text-white mt-6">
            3. Compartilhamento
          </h2>
          <p>
            O Motion não vende nem compartilha dados pessoais com terceiros,
            exceto quando exigido por lei.
          </p>

          <h2 className="text-xl font-semibold text-white mt-6">
            4. Armazenamento e segurança
          </h2>
          <p>
            Os dados são armazenados em infraestrutura segura e protegidos por
            medidas técnicas adequadas.
          </p>

          <h2 className="text-xl font-semibold text-white mt-6">
            5. Direitos do usuário
          </h2>
          <p>
            O usuário pode solicitar a atualização ou exclusão de seus dados a
            qualquer momento, conforme a legislação vigente.
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
