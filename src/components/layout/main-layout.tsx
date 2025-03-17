'use client';

import React from 'react';
import { MainNav } from './main-nav';
import { LLMInitializer } from '../llm-initializer';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* LLMサーバー自動初期化コンポーネント */}
      <LLMInitializer />
      
      <header className="border-b">
        <div className="container mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold mr-10">Local Gemma Toolkit</h1>
              <MainNav />
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1">
        {children}
      </main>
      
      <footer className="border-t py-4 text-center text-sm text-gray-500">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p>Powered by Gemma 12B (Q8_0量子化) - Running 100% locally on your device</p>
          <p className="mt-1">© {new Date().getFullYear()} - Privacy-first AI applications</p>
        </div>
      </footer>
    </div>
  );
}