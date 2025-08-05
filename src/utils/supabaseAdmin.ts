// src/utils/supabaseAdmin.ts
// Este cliente é APENAS para uso no lado do servidor (API Routes, Server Components)
// Ele usa a Service Role Key e ignora RLS.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERRO FATAL: Variáveis de ambiente Supabase para Admin não definidas.');
  // Em um ambiente real, você faria um tratamento de erro mais robusto aqui
  throw new Error('Supabase URL ou Service Role Key não definidos para o cliente admin.');
}

// Cria e exporta a instância do cliente Supabase Admin
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false, // Não persiste sessões para o cliente admin
    autoRefreshToken: false,
  }
});