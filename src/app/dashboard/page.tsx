// src/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

interface UserProfile {
  id: string;
  role: 'aluno' | 'professor' | null;
  nome_completo: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [userRole, setUserRole] = useState<UserProfile['role'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getUserAndProfile() {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error('Erro ao buscar usuário ou usuário não logado:', authError?.message);
        setError('Você precisa estar logado para acessar esta página.');
        router.push('/login');
        return;
      }

      setUserEmail(user.email);

      const userRole = user.app_metadata?.user_role as string || null;
      setUserRole(userRole as 'aluno' | 'professor' || null);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('nome_completo')
        .eq('id', user.id)
        .single();
      
      if (profileError) {
        console.error('Erro ao buscar nome completo do perfil:', profileError.message);
      }

      if (!userRole) {
        console.warn('Role do usuário não encontrada no JWT. Pode ser um perfil antigo ou não atualizado.');
        setError('Seu perfil não tem uma função definida. Faça login novamente ou entre em contato.');
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      setLoading(false);
    }

    getUserAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login');
      } else if (event === 'SIGNED_IN' && session?.user) {
        getUserAndProfile(); 
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  const handleLogout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Erro ao fazer logout:', error);
      setError('Ocorreu um erro ao sair. Tente novamente.');
    } else {
      router.push('/login');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando dashboard...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
        <p>{error}</p>
        <Link href="/login" className="mt-4 bg-lime-400 text-gray-900 py-2 px-6 rounded-full hover:bg-lime-300 transition duration-300">
          Ir para Login
        </Link>
      </main>
    );
  }

  if (!userEmail || !userRole) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl text-center border-t-4 border-lime-400">
        {userRole === 'professor' ? (
          <>
            <h1 className="text-4xl font-bold text-lime-400 mb-4">
              Dashboard do Professor
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              Bem-vindo de volta, Professor Jeferson! <span className="block text-sm text-gray-400">({userEmail})</span>
            </p>
            <div className="space-y-4">
              <Link href="/professor/alunos" className="block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300">
                Gerenciar Alunos
              </Link>
              <Link href="/professor/treinos" className="block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300">
                Montar Treinos
              </Link>
              <Link href="/professor/biblioteca" className="block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300">
                Biblioteca de Exercícios
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-bold text-lime-400 mb-4">
              Dashboard do Aluno
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              Bem-vindo, Aluno! <span className="block text-sm text-gray-400">({userEmail})</span>
            </p>
            <div className="space-y-4">
              <Link href="/aluno/meus-treinos" className="block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300">
                Meus Treinos
              </Link>
              <Link href="/aluno/progresso" className="block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300">
                Meu Progresso
              </Link>
              <Link href="/aluno/anamnese" className="block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300">
                Minha Anamnese
              </Link>
              <Link href="/aluno/treinos-extras" className="block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300">
                Treinos Extras
              </Link>
              <Link href="/aluno/arquivos" className="block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300">
                Arquivos
              </Link>
              {/* CORRIGIDO AQUI: Botão de Assinatura movido para o final */}
              <Link href="/aluno/assinatura" className="block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300">
                Assinar Plano Exclusivo
              </Link>
            </div>
          </>
        )}
        
        <button
          onClick={handleLogout}
          className="mt-12 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-lg"
          disabled={loading}
        >
          {loading ? 'Saindo...' : 'Sair da Conta'}
        </button>
      </div>
    </main>
  );
}