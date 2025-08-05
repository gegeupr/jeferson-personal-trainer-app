// src/app/layout.tsx
"use client"; // Mantém este layout como um Client Component para usar useState

import { useState } from 'react';
// REMOVIDO: import type { Metadata } from "next"; (pois a metadata foi para outro arquivo)
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import MobileMenu from "@/components/MobileMenu"; // Importa o componente MobileMenu

const inter = Inter({ subsets: ["latin"] });

// REMOVIDO: export const metadata: Metadata = { ... }; (pois a metadata foi para outro arquivo)

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-gray-900`}> 
        {/* Cabeçalho (Header) */}
        <header className="fixed top-0 w-full z-50
                           text-white py-2 px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center justify-between max-w-7xl mx-auto h-12">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image
                src="/images/logo.png"
                alt="Logo Jeferson Parowski Personal"
                width={120}
                height={35}
                priority
              />
            </Link>

            {/* Navegação Principal (Desktop) */}
            <div className="hidden md:flex space-x-6">
              <Link href="/" className="text-gray-200 hover:text-lime-400 font-semibold transition duration-300 text-lg">
                Home
              </Link>
              <Link href="/sobre" className="text-gray-200 hover:text-lime-400 font-semibold transition duration-300 text-lg">
                Sobre
              </Link>
              <Link href="/planos" className="text-gray-200 hover:text-lime-400 font-semibold transition duration-300 text-lg">
                Planos
              </Link>
              <Link href="/login" className="text-gray-200 hover:text-lime-400 font-semibold transition duration-300 text-lg">
                Área do Aluno
              </Link>
              <Link href="#contato" className="bg-lime-400 text-gray-900 py-2 px-5 rounded-full font-bold hover:bg-lime-300 transition duration-300 text-lg">
                Contato
              </Link>
            </div>

            {/* Botão para Mobile */}
            <div className="md:hidden">
              <button onClick={toggleMenu} className="text-white hover:text-lime-400 focus:outline-none">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
              </button>
            </div>
          </nav>
        </header>

        {/* Componente MobileMenu */}
        <MobileMenu isOpen={isMenuOpen} onClose={closeMenu} />

        {children}

        <footer className="bg-gray-950 text-gray-400 py-8 px-4 sm:px-6 lg:px-8 text-center border-t border-gray-800">
          <div className="max-w-7xl mx-auto">
            <p className="text-lg font-bold text-lime-400 mb-4">Jeferson Parowski Personal</p>
            <p className="text-sm">Rua Aviador Frare Baptista, 448, Ponta Grossa - PR</p>
            <p className="text-sm mt-1">WhatsApp: <Link href="https://wa.me/5542988311053" target="_blank" rel="noopener noreferrer" className="hover:text-lime-400 transition duration-300">42 98831-1053</Link></p>
            <p className="text-sm mt-1">Instagram: <Link href="https://www.instagram.com/jeparowski" target="_blank" rel="noopener noreferrer" className="hover:text-lime-400 transition duration-300">@jeparowski</Link></p>

            <div className="mt-6 flex justify-center space-x-4">
              <Link href="#" className="text-gray-400 hover:text-lime-400 transition duration-300 text-sm">Política de Privacidade</Link>
              <span className="text-gray-600">|</span>
              <Link href="#" className="text-gray-400 hover:text-lime-400 transition duration-300 text-sm">Termos de Uso</Link>
            </div>
            <p className="text-xs mt-6">&copy; {new Date().getFullYear()} Jeferson Parowski. Todos os direitos reservados.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}