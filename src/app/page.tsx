// src/app/page.tsx

import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-900 text-white">

      {/* Seção Hero - Primeira Dobra */}
      <section className="relative bg-gradient-to-r from-gray-950 to-gray-800 text-white py-24 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center min-h-screen text-center overflow-hidden">
        {/* Efeito de grade/pontos futurista */}
        <div className="absolute inset-0 z-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(#222 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundPosition: 'center center'
        }}></div>
        {/* Overlay para escurecer a imagem de fundo */}
        <div className="absolute inset-0 bg-black opacity-40 z-10"></div>
        
        {/* IMAGEM DE FUNDO DO HERO */}
        <Image
          src="/images/hero-background.png" // CONFIRME o NOME e EXTENSÃO EXATOS do seu arquivo de imagem do hero
          alt="Jeferson Parowski Personal Trainer"
          layout="fill"
          objectFit="cover"
          quality={90}
          className="z-0"
          priority
        />

        {/* Conteúdo do Hero - Adicionei padding-top para não ser coberto pelo cabeçalho */}
        <div className="relative z-20 max-w-4xl pt-[70px] {/* Adicionei padding-top aqui */}"> 
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight mb-6 text-lime-400 drop-shadow-lg">
            Transforme seu Corpo e Mente
          </h1>
          <p className="text-lg sm:text-xl lg:text-2xl mb-8 text-gray-200">
            Treinos personalizados, acompanhamento exclusivo e resultados reais com Jeferson Parowski. Sua jornada fitness futurista começa aqui.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="#servicos" className="bg-lime-400 text-gray-900 hover:bg-lime-300 font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-lg">
              Ver Planos
            </Link>
            <Link href="https://wa.me/5542988311053" target="_blank" rel="noopener noreferrer" className="bg-transparent border-2 border-lime-400 text-lime-400 hover:bg-lime-400 hover:text-gray-900 font-bold py-3 px-8 rounded-full transition duration-300 text-lg inline-flex items-center justify-center">
              <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd"></path></svg>
              Fale no WhatsApp
            </Link>
          </div>
        </div>
      </section>

      {/* Seção Sobre o Personal Trainer - Breve introdução */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-950 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-lime-400 mb-6">
            Quem é Jeferson Parowski?
          </h2>
          {/* Imagem de perfil do Jeferson */}
          <div className="w-32 h-32 mx-auto rounded-full overflow-hidden mb-8 border-4 border-lime-400 shadow-lg">
            <Image
              src="/images/jeferson-profile.png" // Use .png aqui, conforme você me informou
              alt="Foto de perfil de Jeferson Parowski"
              width={128}
              height={128}
              objectFit="cover"
            />
          </div>
          <p className="text-lg text-gray-300 leading-relaxed mb-8">
            Com anos de experiência e paixão por transformar vidas, Jeferson Parowski é dedicado a ajudar você a atingir seus objetivos de saúde e fitness. Minha metodologia é baseada em ciência, individualidade, tecnologia e motivação constante para resultados que transcendem.
          </p>
          <Link href="/sobre" className="mt-8 inline-block text-lime-400 hover:text-lime-300 font-semibold transition duration-300 text-lg">
            Saiba mais sobre mim →
          </Link>
        </div>
      </section>

      {/* Seção de Serviços/Planos - Cards */}
      <section id="servicos" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-lime-400 mb-12">
            Meus Serviços de Treinamento
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: Treino Online Personalizado */}
            <div className="bg-gray-800 rounded-lg shadow-xl p-8 transform hover:scale-105 transition duration-300 ease-in-out border-t-4 border-lime-400">
              <h3 className="text-3xl font-bold text-lime-400 mb-4">Treino Online</h3>
              <p className="text-gray-300 mb-6 text-lg">
                Fichas de treino personalizadas para você fazer onde e quando quiser, com acompanhamento via plataforma exclusiva.
              </p>
              <ul className="text-gray-200 text-left mb-6 space-y-3">
                <li className="flex items-center"><svg className="w-6 h-6 text-lime-400 mr-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Acesso à plataforma de membros</li>
                <li className="flex items-center"><svg className="w-6 h-6 text-lime-400 mr-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Vídeos demonstrativos de exercícios</li>
                <li className="flex items-center"><svg className="w-6 h-6 text-lime-400 mr-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Suporte direto via chat</li>
              </ul>
              <Link href="/planos" className="block bg-lime-400 text-gray-900 font-bold py-3 px-6 rounded-full hover:bg-lime-300 transition duration-300 text-lg">
                Ver Detalhes
              </Link>
            </div>

            {/* Card 2: Consultoria Fitness */}
            <div className="bg-gray-800 rounded-lg shadow-xl p-8 transform hover:scale-105 transition duration-300 ease-in-out border-t-4 border-lime-400">
              <h3 className="text-3xl font-bold text-lime-400 mb-4">Consultoria Fitness</h3>
              <p className="text-gray-300 mb-6 text-lg">
                Sessões de consultoria para alinhamento de metas, avaliação de progresso e ajuste de estratégias personalizadas.
              </p>
              <ul className="text-gray-200 text-left mb-6 space-y-3">
                <li className="flex items-center"><svg className="w-6 h-6 text-lime-400 mr-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Chamadas de vídeo exclusivas</li>
                <li className="flex items-center"><svg className="w-6 h-6 text-lime-400 mr-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Feedback detalhado e plano de ação</li>
                <li className="flex items-center"><svg className="w-6 h-6 text-lime-400 mr-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Ajustes de metas e rotina</li>
              </ul>
              <Link href="/consultoria" className="block bg-lime-400 text-gray-900 font-bold py-3 px-6 rounded-full hover:bg-lime-300 transition duration-300 text-lg">
                Saiba Mais
              </Link>
            </div>

            {/* Card 3: Treino Presencial */}
            <div className="bg-gray-800 rounded-lg shadow-xl p-8 transform hover:scale-105 transition duration-300 ease-in-out border-t-4 border-lime-400">
              <h3 className="text-3xl font-bold text-lime-400 mb-4">Treino Presencial</h3>
              <p className="text-gray-300 mb-6 text-lg">
                Sessões de treinamento individualizadas ou em pequenos grupos em Ponta Grossa, PR.
              </p>
              <ul className="text-gray-200 text-left mb-6 space-y-3">
                <li className="flex items-center"><svg className="w-6 h-6 text-lime-400 mr-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Treino em academia ou local a combinar</li>
                <li className="flex items-center"><svg className="w-6 h-6 text-lime-400 mr-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Acompanhamento direto e ajuste em tempo real</li>
                <li className="flex items-center"><svg className="w-6 h-6 text-lime-400 mr-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Foco total na sua execução e segurança</li>
              </ul>
              <Link href="https://wa.me/5542988311053" target="_blank" rel="noopener noreferrer" className="block bg-lime-400 text-gray-900 font-bold py-3 px-6 rounded-full hover:bg-lime-300 transition duration-300 text-lg">
                Agendar Aula
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Seção de Chamada para Ação Final */}
      <section id="contato" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-gray-950 to-gray-800 text-white text-center border-t border-gray-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-lime-400 mb-6">
            Pronto para Transformar sua Vida?
          </h2>
          <p className="text-lg text-gray-200 mb-8">
            Entre em contato hoje mesmo para agendar sua primeira consulta e começar sua jornada rumo a uma vida mais saudável e ativa. Sua melhor versão está esperando!
          </p>
          <Link href="https://wa.me/5542988311053" target="_blank" rel="noopener noreferrer" className="bg-lime-400 text-gray-900 hover:bg-lime-300 font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 inline-flex items-center text-lg">
            <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd"></path></svg>
            Fale com Jeferson no WhatsApp
          </Link>
          <p className="text-sm text-gray-400 mt-6">Ou ligue para: (42) 98831-1053</p>
        </div>
      </section>
    </main>
  );
}