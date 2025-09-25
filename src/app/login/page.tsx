"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isLoginView) {
      // Lógica de Login
      try {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) {
          throw loginError;
        }
        router.push('/dashboard');
      } catch (err: any) {
        console.error('Erro de login:', err.message);
        if (err.message === 'Invalid login credentials') {
          setError('Email ou senha incorretos.');
        } else if (err.message === 'Email not confirmed') {
          setError('Email não confirmado. Verifique sua caixa de entrada.');
        } else {
          setError('Ocorreu um erro. Por favor, tente novamente.');
        }
      } finally {
        setLoading(false);
      }
    } else {
      // Lógica de Registro
      try {
        const { data, error: registerError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nome_completo: nomeCompleto,
              telefone: telefone,
            }
          }
        });

        if (registerError) {
          throw registerError;
        }
        
        // CORRIGIDO AQUI: Inserção manual na tabela 'profiles' após o 'signUp'
        if (data.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              email: data.user.email,
              nome_completo: nomeCompleto,
              telefone: telefone,
              role: 'aluno', // Role padrão para novos usuários
            });
          if (profileError) throw profileError;
        }
        
        setMessage('Cadastro realizado com sucesso! Verifique seu email para confirmar sua conta.');
        setIsLoginView(true);
      } catch (err: any) {
        console.error('Erro de registro:', err.message);
        setError('Ocorreu um erro ao registrar. Por favor, tente novamente.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-sm text-center border-t-4 border-lime-400">
        <h1 className="text-3xl font-bold text-lime-400 mb-6">
          {isLoginView ? 'Login' : 'Cadastre-se'}
        </h1>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        {message && <p className="text-lime-400 text-sm mb-4">{message}</p>}
        
        <form onSubmit={handleAuth} className="space-y-4">
          {!isLoginView && (
            <>
              <input
                type="text"
                placeholder="Nome Completo"
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                className="w-full px-4 py-2 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-400"
                required
              />
              <input
                type="tel"
                placeholder="Telefone (opcional)"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full px-4 py-2 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-400"
              />
            </>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-400"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-400"
            required
          />
          <button
            type="submit"
            className="w-full bg-lime-600 hover:bg-lime-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
            disabled={loading}
          >
            {loading ? 'Carregando...' : isLoginView ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>
        <p className="text-gray-400 text-sm mt-4">
          {isLoginView ? 'Não tem uma conta?' : 'Já tem uma conta?'}
          <button
            onClick={() => {
              setIsLoginView(!isLoginView);
              setError(null);
              setMessage(null);
            }}
            className="text-lime-400 hover:underline ml-1"
            disabled={loading}
          >
            {isLoginView ? 'Cadastre-se' : 'Fazer login'}
          </button>
        </p>
      </div>
    </main>
  );
}