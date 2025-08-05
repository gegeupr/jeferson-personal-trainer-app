// src/utils/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Certifique-se de que as variáveis de ambiente estão definidas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Verifique se as variáveis de ambiente estão carregadas
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('As variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY devem ser definidas.');
}

// Cria e exporta a instância do cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Opcional: Você pode adicionar um log para verificar se a conexão foi criada (apenas para depuração)
// console.log('Supabase client initialized');