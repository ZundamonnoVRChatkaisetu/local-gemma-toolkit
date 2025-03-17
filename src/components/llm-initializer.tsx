'use client';

import { useEffect, useState } from 'react';

/**
 * LLMサーバーを自動起動するコンポーネント
 * このコンポーネントはUIを表示せず、アプリケーション起動時にLLMを初期化します
 */
export function LLMInitializer() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // LLMサーバーの自動初期化
    const initLLM = async () => {
      try {
        console.log('🟢 [LLMInitializer] Automatically initializing LLM server...');
        
        // APIルートを呼び出してサーバーを初期化
        const response = await fetch('/api/llm/initialize', { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ autoStart: true }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
          console.log('🟢 [LLMInitializer] LLM server initialization triggered:', data);
          setInitialized(true);
        } else {
          console.error('🔴 [LLMInitializer] Failed to initialize LLM server:', data);
          setError(data.error || 'Unknown error');
        }
      } catch (err) {
        console.error('🔴 [LLMInitializer] Error during LLM initialization:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    // コンポーネントのマウント時に一度だけ実行
    if (!initialized && !error) {
      initLLM();
    }
    
    // クリーンアップ関数は不要
    // LLMサーバーはアプリケーション終了時にAPIルートのメソッドで停止するべき
  }, [initialized, error]);

  // UIをレンダリングしない
  return null;
}
