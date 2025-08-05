// src/app/planos/page.tsx

import Link from 'next/link';
export default function Planos() {
  return (
    <main className="min-h-screen bg-gray-900 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl sm:text-6xl font-extrabold text-lime-400 text-center mb-16">
          Escolha o Plano Ideal para a Sua Transformação
        </h1>

        <p className="text-lg text-gray-300 text-center leading-relaxed max-w-4xl mx-auto mb-16">
          No Jeferson Parowski Personal, sua jornada fitness é levada a sério e adaptada à sua realidade. Com uma metodologia que une paixão, ciência e resultados, ofereço diferentes modalidades para que você alcance seus objetivos, seja online, com consultoria estratégica ou com a intensidade do acompanhamento presencial.
        </p>

        {/* Grid de Planos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">

          {/* Card 1: Treino Online Personalizado */}
          <div className="bg-gray-800 rounded-lg shadow-xl p-8 transform hover:scale-105 transition duration-300 ease-in-out border-t-4 border-lime-400 flex flex-col">
            <h2 className="text-3xl font-bold text-lime-400 mb-4 text-center">Treino Online Personalizado</h2>
            <p className="text-4xl font-extrabold text-white mb-6 text-center">R$ 150<span className="text-xl font-normal text-gray-400">/mês</span></p>

            <p className="text-gray-300 mb-6 flex-grow">
              Ideal para quem busca flexibilidade sem abrir mão da excelência e do acompanhamento profissional. Com o Treino Online Personalizado, você tem acesso a um programa de treinamento elaborado exclusivamente para você, com base em seus objetivos, nível de condicionamento e disponibilidade.
            </p>

            <ul className="text-gray-200 text-left mb-8 space-y-3">
              <li className="flex items-start"><svg className="w-6 h-6 text-lime-400 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Ficha de Treino Personalizada</li>
              <li className="flex items-start"><svg className="w-6 h-6 text-lime-400 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Ajustes de Treino a Cada 30 Dias (evolução de peso, série, exercícios)</li>
              <li className="flex items-start"><svg className="w-6 h-6 text-lime-400 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Acesso à Plataforma Exclusiva com Vídeos Demonstrativos</li>
              <li className="flex items-start"><svg className="w-6 h-6 text-lime-400 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Suporte Direto para Dúvidas e Orientações</li>
            </ul>
            <Link href="https://wa.me/5542988311053" target="_blank" rel="noopener noreferrer" className="mt-auto block bg-lime-400 text-gray-900 font-bold py-3 px-6 rounded-full hover:bg-lime-300 transition duration-300 text-lg text-center">
              Quero Treino Online
            </Link>
          </div>

          {/* Card 2: Consultoria Fitness */}
          <div className="bg-gray-800 rounded-lg shadow-xl p-8 transform hover:scale-105 transition duration-300 ease-in-out border-t-4 border-lime-400 flex flex-col">
            <h2 className="text-3xl font-bold text-lime-400 mb-4 text-center">Consultoria Fitness</h2>
            <p className="text-4xl font-extrabold text-white mb-6 text-center">R$ 220<span className="text-xl font-normal text-gray-400">/mês</span></p>

            <p className="text-gray-300 mb-6 flex-grow">
              A Consultoria Fitness é o seu guia estratégico para otimizar resultados e superar desafios. Através de sessões focadas, vamos alinhar suas metas, avaliar seu progresso e ajustar cada detalhe da sua estratégia de treino e hábitos, garantindo que você esteja sempre no caminho certo.
            </p>

            <ul className="text-gray-200 text-left mb-8 space-y-3">
              <li className="flex items-start"><svg className="w-6 h-6 text-lime-400 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Sessões de Acompanhamento e Alinhamento de Metas</li>
              <li className="flex items-start"><svg className="w-6 h-6 text-lime-400 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Feedback Detalhado e Plano de Ação Personalizado</li>
              <li className="flex items-start"><svg className="w-6 h-6 text-lime-400 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Otimização de Rotina e Hábitos Saudáveis</li>
              <li className="flex items-start"><svg className="w-6 h-6 text-lime-400 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Suporte Estratégico Contínuo</li>
            </ul>
            <Link href="https://wa.me/5542988311053" target="_blank" rel="noopener noreferrer" className="mt-auto block bg-lime-400 text-gray-900 font-bold py-3 px-6 rounded-full hover:bg-lime-300 transition duration-300 text-lg text-center">
              Quero Consultoria
            </Link>
          </div>

          {/* Card 3: Aula Presencial */}
          <div className="bg-gray-800 rounded-lg shadow-xl p-8 transform hover:scale-105 transition duration-300 ease-in-out border-t-4 border-lime-400 flex flex-col">
            <h2 className="text-3xl font-bold text-lime-400 mb-4 text-center">Aula Presencial</h2>
            <p className="text-4xl font-extrabold text-white mb-6 text-center">R$ 80<span className="text-xl font-normal text-gray-400">/hora-aula</span></p>

            <p className="text-gray-300 mb-6 flex-grow">
              Para quem busca a máxima performance, segurança e motivação, a aula presencial com Jeferson Parowski é a escolha ideal. Em Ponta Grossa, PR, você terá um acompanhamento individualizado e a energia que só o treino lado a lado pode oferecer.
            </p>

            <ul className="text-gray-200 text-left mb-8 space-y-3">
              <li className="flex items-start"><svg className="w-6 h-6 text-lime-400 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Correção Imediata e Precisa da Execução</li>
              <li className="flex items-start"><svg className="w-6 h-6 text-lime-400 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Motivação e Energia Contagiante em Tempo Real</li>
              <li className="flex items-start"><svg className="w-6 h-6 text-lime-400 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Personalização Extrema e Ajustes em Tempo Real</li>
              <li className="flex items-start"><svg className="w-6 h-6 text-lime-400 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Segurança Otimizada e Prevenção de Lesões</li>
            </ul>
            <Link href="https://wa.me/5542988311053" target="_blank" rel="noopener noreferrer" className="mt-auto block bg-lime-400 text-gray-900 font-bold py-3 px-6 rounded-full hover:bg-lime-300 transition duration-300 text-lg text-center">
              Agendar Aula Presencial
            </Link>
          </div>

        </div> {/* Fim do Grid de Planos */}

        {/* Seção de Chamada para Ação Geral */}
        <section className="text-center py-16 border-t border-gray-800 mt-16">
          <h2 className="text-4xl font-bold text-lime-400 mb-6">
            Qual é o seu próximo passo?
          </h2>
          <p className="text-lg text-gray-300 mb-8 max-w-3xl mx-auto">
            Seja qual for o seu objetivo, Jeferson Parowski está pronto para te guiar. Clique no plano que mais se encaixa com você e vamos iniciar sua transformação!
          </p>
          <Link href="https://wa.me/5542988311053" target="_blank" rel="noopener noreferrer" className="inline-block bg-lime-400 text-gray-900 hover:bg-lime-300 font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-xl inline-flex items-center">
            <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd"></path></svg>
            Fale com Jeferson no WhatsApp
          </Link>
        </section>

      </div>
    </main>
  );
}