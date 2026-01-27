"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase-browser';
import Link from 'next/link';

export default function AssinaturaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusAssinatura, setStatusAssinatura] = useState<string | null>(null);

  useEffect(() => {
    async function checkSubscriptionStatus() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }
      setAlunoId(user.id);

      // Busca a role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (profileError || profile?.role !== 'aluno') {
        setError('Acesso negado. Esta página é apenas para alunos.');
        setLoading(false);
        return;
      }

      // Busca o status da assinatura do aluno no Supabase
      const { data: assinatura, error: assinaturaError } = await supabase
        .from('assinaturas')
        .select('status')
        .eq('aluno_id', user.id)
        .order('data_fim', { ascending: false })
        .limit(1)
        .single();

      if (assinaturaError && assinaturaError.code !== 'PGRST116') {
        console.error('Erro ao buscar status da assinatura:', assinaturaError.message);
        setError('Não foi possível carregar o status da sua assinatura.');
      } else if (assinatura) {
        setStatusAssinatura(assinatura.status);
        if (assinatura.status === 'active') {
          // CORRIGIDO: Removendo alert() e mantendo o redirecionamento
          router.push('/dashboard'); 
          return;
        } else if (assinatura.status === 'pending') {
          setError('Sua assinatura está pendente. Por favor, conclua o pagamento.');
        }
      }
      setLoading(false);
    }

    checkSubscriptionStatus();
  }, [router]);

  const handleInitiateSubscription = async () => {
    setIsSubmitting(true);
    setError(null);

    if (!alunoId) {
      setError('ID do aluno não disponível. Tente recarregar a página.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alunoId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido ao iniciar assinatura.');
      }

      window.location.href = data.redirectUrl;

    } catch (err: unknown) { // CORRIGIDO: 'any' substituído por 'unknown'
      if (err instanceof Error) {
        console.error('Erro ao iniciar assinatura:', err.message);
        setError(`Erro ao iniciar assinatura: ${err.message}`);
      } else {
        console.error('Erro ao iniciar assinatura: Ocorreu um erro desconhecido.');
        setError('Erro ao iniciar assinatura: Ocorreu um erro desconhecido.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Verificando status da assinatura...
      </main>
    );
  }

  if (error && error.includes('Acesso negado')) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
        <p>{error}</p>
        <Link href="/dashboard" className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300">
          Ir para Dashboard
        </Link>
      </main>
    );
  }

  if (error && statusAssinatura !== 'pending') {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
        <p>{error}</p>
        <button
          onClick={() => setError(null)}
          className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300">
          Tentar Novamente
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
      <div className="max-w-xl mx-auto bg-gray-800 p-8 rounded-lg shadow-xl w-full text-center border-t-4 border-lime-400">
        <h1 className="text-4xl font-bold text-lime-400 mb-6">
          Assinatura do Plano Exclusivo
        </h1>
        <p className="text-lg text-gray-300 mb-8">
          Acesse treinos personalizados e todas as funcionalidades por apenas R$ 150,00/mês.
        </p>
        <div className="flex justify-center items-center mb-8">
          <Link href="/dashboard" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar ao Dashboard
          </Link>
        </div>
        {error && statusAssinatura === 'pending' ? (
          <>
            <p className="text-yellow-400 text-xl font-bold mb-4">{error}</p>
            <button
              onClick={handleInitiateSubscription}
              className="bg-orange-500 hover:bg-orange-600 text-gray-900 font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-lg"
              disabled={isSubmitting}>
              {isSubmitting ? 'Redirecionando...' : 'Concluir Pagamento'}
            </button>
          </>
        ) : (
          <button
            onClick={handleInitiateSubscription}
            className="bg-lime-400 hover:bg-lime-300 text-gray-900 font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-lg"
            disabled={isSubmitting}>
            {isSubmitting ? 'Redirecionando...' : 'Assinar agora'}
          </button>
        )}
        <p className="text-gray-500 text-sm mt-8">
          Ao clicar no botão, você será redirecionado para o ambiente seguro do Stripe para concluir o pagamento.
        </p>
      </div>
    </main>
  );
}