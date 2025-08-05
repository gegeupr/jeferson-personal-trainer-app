// src/app/login/page.tsx
"use client"; // Este componente precisa ser um Client Component para usar hooks de estado e Supabase no cliente

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Hook para navegação
import { supabase } from '@/utils/supabase'; // Importa a instância do cliente Supabase
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false); // Estado para alternar entre login e cadastro
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isSignUp) {
        // Lógica de Cadastro
        const { error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`, // URL de redirecionamento após confirmação de email
          },
        });

        if (error) throw error;
        setMessage('Verifique seu e-mail para confirmar o cadastro!');
      } else {
        // Lógica de Login
        const { error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) throw error;
        // Redireciona para uma área logada (ex: dashboard do aluno/professor)
        router.push('/dashboard'); 
      }
    } catch (error) { // Removido o ': any' aqui
      setMessage(`Erro: ${(error as Error).message}`); // Usando 'as Error' para acessar '.message' com segurança
      console.error('Erro de autenticação:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md border-t-4 border-lime-400">
        <h1 className="text-3xl font-bold text-center text-lime-400 mb-6">
          {isSignUp ? 'Cadastre-se' : 'Faça Login'}
        </h1>
        <p className="text-gray-300 text-center mb-8">
          {isSignUp ? 'Crie sua conta para acessar os treinos exclusivos.' : 'Acesse sua área de membro e transforme-se.'}
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-gray-400 text-sm font-bold mb-2">
              E-mail
            </label>
            <input
              type="email"
              id="email"
              className="shadow appearance-none border border-gray-700 rounded w-full py-3 px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:shadow-outline focus:border-lime-400"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-gray-400 text-sm font-bold mb-2">
              Senha
            </label>
            <input
              type="password"
              id="password"
              className="shadow appearance-none border border-gray-700 rounded w-full py-3 px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:shadow-outline focus:border-lime-400"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="bg-lime-400 hover:bg-lime-300 text-gray-900 font-bold py-3 px-4 rounded-full w-full focus:outline-none focus:shadow-outline transition duration-300"
            disabled={loading}
          >
            {loading ? 'Processando...' : (isSignUp ? 'Cadastrar' : 'Entrar')}
          </button>
        </form>

        {message && (
          <p className={`mt-4 text-center ${message.includes('Erro') ? 'text-red-400' : 'text-green-400'}`}>
            {message}
          </p>
        )}

        <p className="mt-6 text-center text-gray-400">
          {isSignUp ? (
            <>Já tem uma conta?{' '}
              <button onClick={() => setIsSignUp(false)} className="text-lime-400 hover:text-lime-300 font-bold focus:outline-none">
                Faça Login
              </button>
            </>
          ) : (
            <>Não tem uma conta?{' '}
              <button onClick={() => setIsSignUp(true)} className="text-lime-400 hover:text-lime-300 font-bold focus:outline-none">
                Cadastre-se
              </button>
            </>
          )}
        </p>
        <p className="mt-4 text-center text-gray-500 text-sm">
            <Link href="#" className="hover:text-lime-400 transition duration-300">Esqueceu a senha?</Link> {/* Implementar futuramente */}
        </p>
      </div>
    </main>
  );
}