// src/components/MobileMenu.tsx
"use client"; // Marca este componente como um Client Component

import React, { useState } from 'react'; // Importa React e o hook useState
import Link from 'next/link'; // Componente de link do Next.js

interface MobileMenuProps {
  isOpen: boolean; // Propriedade para controlar se o menu está aberto ou fechado
  onClose: () => void; // Função para fechar o menu (passada do componente pai)
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  // Classes Tailwind para transição e posicionamento
  const menuClasses = `fixed inset-y-0 right-0 w-64 bg-gray-950 shadow-lg z-50 transform 
                       ${isOpen ? 'translate-x-0' : 'translate-x-full'} 
                       transition-transform duration-300 ease-in-out`;

  // Overlay escuro que aparece atrás do menu quando ele está aberto
  const overlayClasses = `fixed inset-0 bg-black transition-opacity duration-300 ease-in-out 
                          ${isOpen ? 'opacity-70 z-40' : 'opacity-0 pointer-events-none'}`;

  return (
    <>
      {/* Overlay escuro clicável para fechar o menu */}
      <div className={overlayClasses} onClick={onClose}></div>

      {/* Menu Lateral */}
      <div className={menuClasses}>
        <div className="flex justify-end p-4">
          {/* Botão de Fechar (Ícone 'X') */}
          <button onClick={onClose} className="text-white hover:text-lime-400 focus:outline-none">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Links de Navegação */}
        <nav className="flex flex-col p-4 space-y-4 text-xl">
          <Link href="/" onClick={onClose} className="text-gray-200 hover:text-lime-400 font-semibold transition duration-300 block py-2">
            Home
          </Link>
          <Link href="/sobre" onClick={onClose} className="text-gray-200 hover:text-lime-400 font-semibold transition duration-300 block py-2">
            Sobre
          </Link>
          <Link href="/planos" onClick={onClose} className="text-gray-200 hover:text-lime-400 font-semibold transition duration-300 block py-2">
            Planos
          </Link>
          <Link href="/login" onClick={onClose} className="text-gray-200 hover:text-lime-400 font-semibold transition duration-300 block py-2">
            Área do Aluno
          </Link>
          <Link href="#contato" onClick={onClose} className="bg-lime-400 text-gray-900 py-2 px-4 rounded-full font-bold hover:bg-lime-300 transition duration-300 block text-center mt-4">
            Contato
          </Link>
        </nav>
      </div>
    </>
  );
}