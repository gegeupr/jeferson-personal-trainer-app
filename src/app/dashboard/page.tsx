// src/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getUserAndProfile() {
      setLoading(true);
      setError(null);

      // 1. Tenta obter o usuário da sessão.
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error('Usuário não autenticado:', authError?.message);
        router.push('/login');
        return;
      }

      // 2. Busca a role diretamente da tabela 'profiles' para obter a role mais atualizada.
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData?.role) {
        console.error('Erro ao buscar perfil ou role não definida:', profileError?.message);
        setError('Erro ao carregar seu perfil. Tente fazer login novamente.');
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      const userRole = profileData.role;

      // 3. Redireciona o usuário para a página de dashboard correta com base na role.
      if (userRole === 'professor') {
        router.push('/professor/dashboard');
      } else if (userRole === 'aluno') {
        router.push('/aluno/dashboard');
      } else {
        console.warn('Role do usuário desconhecida:', userRole);
        setError('Sua permissão de acesso não foi reconhecida.');
        await supabase.auth.signOut();
        router.push('/login');
      }
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

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Redirecionando para o dashboard...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500 text-lg p-4">
        <p>{error}</p>
      </main>
    );
  }
  
  return null;
}