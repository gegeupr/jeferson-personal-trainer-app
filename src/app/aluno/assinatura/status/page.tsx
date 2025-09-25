// src/app/aluno/assinatura/status/page.tsx
"use client";

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Importa o componente que contém toda a lógica de uso de useSearchParams()
// O ssr: false garante que ele nunca tentará renderizar isso no build time.
const StatusLogicComponent = dynamic(() => import('./StatusLogic'), {
  ssr: false, 
  loading: () => <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-2xl">Carregando status...</div>,
});

export default function AssinaturaStatusPage() {
    return (
        <Suspense>
            <StatusLogicComponent />
        </Suspense>
    );
}