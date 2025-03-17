'use client';

import { useEffect, useState } from 'react';

/**
 * LLMサーバーを自動起動するコンポーネント
 * このコンポーネントはUIを表示せず、アプリケーション起動時にLLMを初期化します
 */
export function LLMInitializer() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    // LLMサーバーの自動初期化
    const initLLM = async () => {
      // 初期化中フラグをチェック（重複呼び出し防止）
      if (isInitializing) {
        console.log('🟡 [LLMInitializer] Initialization already in progress, skipping');
        return;
      }
      
      try {
        console.log('🟢 [LLMInitializer] Automatically initializing LLM server...');
        setIsInitializing(true);
        
        // まずサーバーの状態を確認
        const statusResponse = await fetch('/api/llm/initialize', { 
          method: 'GET',
        });
        
        const statusData = await statusResponse.json();
        
        if (statusResponse.ok && statusData.status?.isRunning) {
          console.log('🟢 [LLMInitializer] LLM server is already running:', statusData);
          setInitialized(true);
          setIsInitializing(false);
          return;
        }
        
        // APIルートを呼び出してサーバーを初期化
        console.log('🟢 [LLMInitializer] Server not running, sending initialization request');
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
          
          // 初期化が成功したか失敗したかを設定
          if (data.success) {
            setInitialized(true);
          } else {
            setError(data.error || 'Unknown error during initialization');
          }
        } else {
          console.error('🔴 [LLMInitializer] Failed to initialize LLM server:', data);
          setError(data.error || `API returned status ${response.status}`);
        }
      } catch (err) {
        console.error('🔴 [LLMInitializer] Error during LLM initialization:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsInitializing(false);
      }
    };

    // コンポーネントのマウント時に一度だけ実行
    if (!initialized && !error && !isInitializing) {
      initLLM();
    }
    
    // クリーンアップ関数は不要
    // LLMサーバーはアプリケーション終了時にAPIルートのメソッドで停止するべき
  }, [initialized, error, isInitializing]);

  // UIをレンダリングしない
  return null;
}
