// src/app/sobre/page.tsx

import Link from 'next/link';
import Image from 'next/image';

export default function Sobre() {
  return (
    <main className="min-h-screen bg-gray-900 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Seção Principal - Sobre Jeferson */}
        <section className="text-center mb-16">
          <h1 className="text-5xl sm:text-6xl font-extrabold text-lime-400 mb-8">
            A Jornada de Transformação de Jeferson Parowski
          </h1>
          
          {/* Imagem de perfil do Jeferson */}
          <div className="w-48 h-48 mx-auto rounded-full overflow-hidden mb-10 border-4 border-lime-400 shadow-xl">
            <Image
              src="/images/jeferson-profile.png" // Confirmado .png
              alt="Foto de perfil de Jeferson Parowski"
              width={192}
              height={192}
              objectFit="cover"
              priority
            />
          </div>

          <div className="text-lg text-gray-300 leading-relaxed max-w-4xl mx-auto space-y-6">
            <p>Minha história com o universo fitness começou cedo, aos 17 anos. Naquela época, cada panfleto entregue nas ruas de Ponta Grossa significava um passo mais perto da academia, um investimento na paixão que começava a florescer. Mas foi aos 24 anos que a musculação deixou de ser um hobby e se tornou um compromisso de vida. Entre os 26 e 31 anos, alcancei o que considerei meu auge físico, uma conquista que representou muito mais do que músculos: foi a superação de uma infância marcada pelo excesso de peso e pela baixa autoestima. Meu sonho de ser bodybuilder, alimentado desde cedo, ganhava contornos de realidade.</p>
            
            <p>A virada definitiva veio em 2020. Em meio à incerteza da pandemia e ao isolamento, tomei a decisão que mudaria meu futuro: ingressei no curso de Bacharelado em Educação Física pela Universidade Cruzeiro do Sul. Foi o momento de mergulhar de cabeça no que amo, combinando a paixão com o conhecimento técnico.</p>
            
            <p>Durante minha graduação, tive a oportunidade de atuar em diversas academias de Ponta Grossa, onde não apenas conquistei amigos e parceiros, mas também transformei a vida de muitos alunos. Essa experiência prática foi fundamental para mesclar o conhecimento que já tinha como praticante de musculação há anos, com as técnicas e a ciência aprendidas na faculdade.</p>
            
            <p>Além da força e estética, minha paixão se estende à qualidade de vida em todas as fases. Tenho uma atuação forte e gratificante com o público **idoso**, auxiliando na manutenção da funcionalidade, autonomia e bem-estar. Da mesma forma, dedico-me a programas de **reabilitação pós-fisioterapia**, criando pontes seguras e eficazes para que meus alunos recuperem o movimento, a força e a confiança após lesões, garantindo um retorno seguro às atividades diárias e esportivas.</p>
            
            <p>Sou Jeferson Parowski, e minha missão é guiar você na sua própria jornada de transformação, combinando a paixão de quem vive o esporte com a expertise de quem estuda e aplica a ciência do movimento, seja você um atleta buscando o auge, alguém em processo de recuperação, ou buscando mais qualidade de vida e autonomia.</p>
          </div>
          
          <Link href="/planos" className="mt-12 inline-block bg-lime-400 text-gray-900 font-bold py-3 px-8 rounded-full hover:bg-lime-300 transition duration-300 text-xl shadow-lg">
            Conheça Meus Planos
          </Link>
        </section>

        {/* Seção de Antes e Depois de Alunos */}
        <section className="text-center py-16 border-t border-gray-800 mt-16">
          <h2 className="text-4xl font-bold text-lime-400 mb-12">
            Histórias de Sucesso: Antes e Depois
          </h2>
          <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
            Confira algumas das transformações incríveis que meus alunos alcançaram. Inspiração para a sua própria jornada!
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Exemplo de Card de Antes e Depois 1 */}
            <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden transform hover:scale-105 transition duration-300 ease-in-out border-t-4 border-lime-400">
              <div className="relative h-64 w-full">
                <Image
                  src="/images/aluno-antes-depois-1.png"
                  alt="Transformação do Aluno 1"
                  layout="fill"
                  objectFit="cover"
                  className="absolute inset-0"
                />
                <div className="absolute inset-0 flex items-end justify-between p-4 bg-gradient-to-t from-black via-transparent to-transparent">
                  <span className="text-sm font-semibold text-gray-300 bg-lime-400 text-gray-900 px-3 py-1 rounded-full">Antes & Depois</span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-bold text-lime-400 mb-2">João S.</h3>
                <p className="text-gray-300 text-base">
                  &quot;Perdi 15kg e ganhei muita força! O acompanhamento do Jeferson foi essencial.&quot;
                </p>
              </div>
            </div>

            {/* Exemplo de Card de Antes e Depois 2 */}
            <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden transform hover:scale-105 transition duration-300 ease-in-out border-t-4 border-lime-400">
              <div className="relative h-64 w-full">
                <Image
                  src="/images/aluno-antes-depois-2.png"
                  alt="Transformação do Aluno 2"
                  layout="fill"
                  objectFit="cover"
                  className="absolute inset-0"
                />
                <div className="absolute inset-0 flex items-end justify-between p-4 bg-gradient-to-t from-black via-transparent to-transparent">
                  <span className="text-sm font-semibold text-gray-300 bg-lime-400 text-gray-900 px-3 py-1 rounded-full">Antes & Depois</span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-bold text-lime-400 mb-2">Maria F.</h3>
                <p className="text-gray-300 text-base">
                  &quot;Melhorei minha postura e mobilidade após a reabilitação com o Jeferson.&quot;
                </p>
              </div>
            </div>

            {/* Exemplo de Card de Antes e Depois 3 - Texto Atualizado */}
            <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden transform hover:scale-105 transition duration-300 ease-in-out border-t-4 border-lime-400">
              <div className="relative h-64 w-full">
                <Image
                  src="/images/aluno-antes-depois-3.png"
                  alt="Transformação do Aluno 3"
                  layout="fill"
                  objectFit="cover"
                  className="absolute inset-0"
                />
                <div className="absolute inset-0 flex items-end justify-between p-4 bg-gradient-to-t from-black via-transparent to-transparent">
                  <span className="text-sm font-semibold text-gray-300 bg-lime-400 text-gray-900 px-3 py-1 rounded-full">Antes & Depois</span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-bold text-lime-400 mb-2">Carlos P.</h3>
                <p className="text-gray-300 text-base">
                  &quot;Atingi meus objetivos e me sinto mais ativo para aproveitar melhor a vida.&quot;
                </p>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}