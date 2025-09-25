// src/app/aluno/dashboard/page.tsx
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

export default function AlunoDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getUserProfile() {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, nome_completo')
        .eq('id', user.id)
        .single();
        
      if (profileError || profileData?.role !== 'aluno') {
        router.push('/dashboard');
        return;
      }

      setProfile({ id: user.id, ...profileData as Omit<UserProfile, 'id'> });
      setLoading(false);
    }
    getUserProfile();
  }, [router]);

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-lime-400 text-2xl">
        Carregando dashboard do aluno...
      </main>
    );
  }
  
  if (error) {
    return <p>{error}</p>;
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl text-center border-t-4 border-lime-400">
        <h1 className="text-4xl font-bold text-lime-400 mb-4">
          Dashboard do Aluno
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Bem-vindo, {profile?.nome_completo || 'Aluno'}!
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
          <Link href="/aluno/assinatura" className="block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300">
            Assinar Plano Exclusivo
          </Link>
        </div>
        <button
          onClick={handleLogout}
          className="mt-12 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 text-lg"
          disabled={loading}
        >
          Sair da Conta
        </button>
      </div>
    </main>
  );
}