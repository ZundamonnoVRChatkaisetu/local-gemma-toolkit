import { NextRequest, NextResponse } from 'next/server';
import { generateCompletion, streamCompletion, Message, initializeLLM } from '@/lib/gemma';
import { isLlamaServerRunning, isCorsEnabled } from '@/lib/gemma/llama-cpp';
import { pingLlamaServer, testServerConnection } from '@/lib/gemma/llama-client';
import prisma from '@/lib/prisma/client';
import fetch from 'node-fetch';

// Handle POST requests to /api/chat
export async function POST(req: NextRequest) {
  console.log('🟢 [API Route] POST /api/chat received');
  
  try {
    // リクエストボディの解析を先に行う
    let messages, conversationId, stream;
    try {
      const body = await req.json();
      console.log('🟢 [API Route] Request body:', body);
      
      messages = body.messages;
      conversationId = body.conversationId;
      stream = body.stream !== undefined ? body.stream : true;
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'リクエストボディの解析に失敗しました' },
        { status: 400 }
      );
    }
    
    if (!messages || !Array.isArray(messages)) {
      console.log('🔴 [API Route] Invalid messages in request body');
      return NextResponse.json(
        { error: 'メッセージ配列が必要です' },
        { status: 400 }
      );
    }
    
    // サーバーの状態を詳細に確認（複数のチェック方法）
    let serverConnected = false;
    let serverMessage = '';
    
    // 1. まずプロセスチェック
    const processRunning = isLlamaServerRunning();
    if (processRunning) {
      console.log('🟢 [API Route] LLM server process is running');
    } else {
      console.warn('🟡 [API Route] LLM server process is not running');
    }
    
    // 2. サーバーヘルスチェック
    try {
      const response = await fetch('http://127.0.0.1:8080/health', {
        method: 'GET',
        timeout: 1000
      });
      
      if (response.ok || response.status === 503) {
        console.log(`🟢 [API Route] Server health check succeeded with status: ${response.status}`);
        serverConnected = true;
      } else {
        console.warn(`🟡 [API Route] Server returned unexpected status: ${response.status}`);
      }
    } catch (healthError) {
      console.warn(`🟡 [API Route] Health check failed: ${healthError.message}`);
    }

    // 3. プロセスが動いていればサーバーが接続可能と判断
    if (processRunning) {
      serverConnected = true;
    }
    
    // サーバーが応答していない場合
    if (!serverConnected) {
      console.log('🔴 [API Route] LLM server is not available');
      
      // 非ストリーミングレスポンスとして返す
      return NextResponse.json(
        { 
          error: 'LLMサーバーが応答していません。サーバーを起動してください。',
          serverStatus: 'stopped'
        },
        { status: 503 }
      );
    }
    
    // If stream is true, set up a non-streaming response as JSON only
    if (stream) {
      console.log('🟢 [API Route] Setting up non-streaming JSON response instead of stream');
      
      try {
        // Use the non-streaming version instead
        console.log('🟢 [API Route] Using library implementation for completion');
        
        // ライブラリ実装で補完を生成
        const completion = await generateCompletion(messages);
        console.log('🟢 [API Route] Generated completion:', completion.slice(0, 50) + (completion.length > 50 ? '...' : ''));
        
        return NextResponse.json({ completion });
      } catch (error) {
        console.error('🔴 [API Route] Error in completion:', error);
        
        const errorMessage = error instanceof Error 
          ? error.message 
          : '不明なエラーが発生しました';
        
        return NextResponse.json({ 
          error: '補完生成に失敗しました',
          details: errorMessage 
        }, { status: 500 });
      }
    }
    
    // 基本的な非ストリーミングレスポンス
    try {
      // 常にライブラリ実装を使用（直接通信はスキップ）
      console.log('🟢 [API Route] Using library implementation for non-streaming response');
      
      // ライブラリ実装で補完を生成
      const completion = await generateCompletion(messages);
      console.log('🟢 [API Route] Generated completion:', completion.slice(0, 50) + (completion.length > 50 ? '...' : ''));
      
      // In a real implementation, save to database
      if (conversationId) {
        // Placeholder for saving to database
      }
      
      return NextResponse.json({ completion });
    } catch (error) {
      console.error('Error in non-streaming completion:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : '不明なエラーが発生しました';
      
      return NextResponse.json(
        { 
          error: '補完生成に失敗しました', 
          details: errorMessage,
          completion: '申し訳ありません。リクエストの処理中にエラーが発生しました。もう一度お試しください。'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in chat API:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : '不明なエラーが発生しました';
    
    return NextResponse.json(
      { 
        error: '補完生成に失敗しました', 
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

// サーバーヘルスチェックAPIを追加
export async function GET(req: NextRequest) {
  try {
    // サーバーが応答しているかを直接チェック
    let serverResponding = false;
    let serverStatus = 'stopped';
    let serverMessage = '';
    let corsEnabled = false;
    
    try {
      // CORSステータスを確認
      corsEnabled = isCorsEnabled();
      
      // 直接エンドポイントにリクエストを送信
      const response = await fetch('http://127.0.0.1:8080/health', {
        method: 'GET',
        timeout: 2000
      });
      
      if (response.ok) {
        serverResponding = true;
        serverStatus = 'running';
      } else if (response.status === 503) {
        // 503はサーバーが初期化中であることを示す
        serverResponding = true;
        serverStatus = 'initializing';
        serverMessage = 'サーバーは起動中ですが、まだ完全に初期化されていません';
      } else {
        // その他のステータスコード
        serverMessage = `ヘルスチェックエンドポイントが異常なステータスコードを返しました: ${response.status}`;
      }
      
      if (!serverResponding) {
        // モデルエンドポイントも試す
        try {
          const modelResponse = await fetch('http://127.0.0.1:8080/model', {
            method: 'GET',
            timeout: 2000
          });
          
          if (modelResponse.ok) {
            serverResponding = true;
            serverStatus = 'running';
          } else if (modelResponse.status === 503) {
            serverResponding = true;
            serverStatus = 'initializing';
            serverMessage = 'サーバーは起動中ですが、まだ完全に初期化されていません';
          }
        } catch (modelError) {
          console.warn('Error checking model endpoint:', modelError);
        }
      }
    } catch (fetchError) {
      console.warn('Error checking llama-server health:', fetchError);
      
      // プロセスが起動しているかチェック
      if (isLlamaServerRunning()) {
        serverStatus = 'running'; // プロセスが動いているなら'running'に設定
        serverMessage = 'サーバープロセスは起動しています';
        // プロセスが実行中であれば、応答可能と見なす
        serverResponding = true;
      }
    }
    
    return NextResponse.json({ 
      status: serverStatus,
      message: serverMessage,
      corsEnabled: corsEnabled,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Error in health check API:', error);
    
    return NextResponse.json(
      { error: 'サーバーステータス取得に失敗しました' },
      { status: 500 }
    );
  }
}