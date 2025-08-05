// src/app/aluno/assinatura/status/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

export default function AssinaturaStatusPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session_id = searchParams.get('session_id'); // Captura o session_id da URL

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusAssinatura, setStatusAssinatura] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Para controlar o estado do botão

  useEffect(() => {
    async function checkPaymentStatus() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Verificar role do usuário (deve ser 'aluno' do JWT)
      const userRole = user.app_metadata?.user_role as string || null;
      if (userRole !== 'aluno') {
        setError('Acesso negado. Esta página é apenas para alunos.');
        setLoading(false);
        return;
      }

      if (!session_id) {
        setError('Não foi possível encontrar o ID da sessão de pagamento. Pagamento não confirmado.');
        setLoading(false);
        return;
      }

      try {
        // Chamada à API Route para verificar o status do pagamento no Stripe
        const response = await fetch('/api/stripe/check-payment-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ session_id, userId: user.id }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erro desconhecido ao verificar status do pagamento.');
        }

        // O backend (API Route) já deveria ter atualizado o Supabase
        // Apenas para fins de exibição na tela, podemos buscar o status novamente ou confiar na resposta.
        const { data: assinatura, error: assinaturaError } = await supabase
          .from('assinaturas')
          .select('status')
          .eq('aluno_id', user.id)
          .single();

        if (assinaturaError) {
          throw new Error(assinaturaError.message);
        }

        setStatusAssinatura(assinatura.status);

        // Redireciona para o dashboard ou exibe mensagem final após um pequeno delay
        setTimeout(() => {
          router.push('/dashboard');
        }, 3000); // Redireciona após 3 segundos

      } catch (err: any) {
        console.error('Erro ao verificar pagamento:', err.message);
        setError(`Erro ao verificar pagamento: ${err.message}`);
        setStatusAssinatura('failed'); // Ou um status de erro apropriado
      } finally {
        setLoading(false);
      }
    }

    checkPaymentStatus();
  }, [session_id, router]);


  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-lime-400 text-2xl text-center">
        <p>Verificando status do pagamento...</p>
        <p className="text-lg mt-2">Por favor, aguarde, não feche esta página.</p>
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

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
        <p>{error}</p>
        <button
          onClick={() => setError(null)}
          className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300"
        >
          Tentar Novamente
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
      <div className="max-w-md mx-auto bg-gray-800 p-8 rounded-lg shadow-xl text-center border-t-4 border-lime-400">
        <h1 className="text-4xl font-bold text-lime-400 mb-6">Status do Pagamento</h1>
        {error && <p className="text-red-500 text-md mb-4">{error}</p>}

        {/* Novo botão Voltar ao Dashboard */}
        <div className="flex justify-center items-center mb-8">
          <Link href="/dashboard" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            &larr; Voltar ao Dashboard
          </Link>
        </div>
        
        {statusAssinatura === 'active' ? (
          <>
            <svg className="mx-auto text-green-500 w-16 h-16 mb-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
            <p className="text-green-400 text-2xl font-bold mb-4">Pagamento Confirmado!</p>
            <p className="text-gray-300 text-lg mb-6">Sua assinatura está ativa. Redirecionando para o Dashboard...</p>
          </>
        ) : statusAssinatura === 'pending' ? (
          <>
            <svg className="mx-auto text-yellow-500 w-16 h-16 mb-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.487 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
            <p className="text-yellow-400 text-2xl font-bold mb-4">Pagamento Pendente</p>
            <p className="text-gray-300 text-lg mb-6">Estamos aguardando a confirmação do seu pagamento. Isso pode levar alguns minutos.</p>
          </>
        ) : (
          <>
            <svg className="mx-auto text-red-500 w-16 h-16 mb-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path></svg>
            <p className="text-red-400 text-2xl font-bold mb-4">Pagamento Falhou</p>
            <p className="text-gray-300 text-lg mb-6">Ocorreu um problema com o seu pagamento. Por favor, tente novamente.</p>
            <button
              onClick={() => router.push('/aluno/assinatura')}
              className="bg-lime-600 hover:bg-lime-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-lg"
              disabled={isSubmitting}
            >
              Tentar Novamente
            </button>
          </>
        )}
      </div>
    </main>
  );
}