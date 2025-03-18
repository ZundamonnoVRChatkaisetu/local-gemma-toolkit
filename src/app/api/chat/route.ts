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
    
    // より詳細なサーバーの状態確認（testServerConnectionを使用）
    let serverRunning = false;
    let serverStatus = 'unknown';
    let serverMessage = '';
    
    try {
      // testServerConnectionを使用してより信頼性の高い状態確認
      const connectionTest = await testServerConnection();
      console.log(`🟢 [API Route] Server connection test:`, connectionTest);
      
      if (connectionTest.success) {
        serverRunning = true;
        serverStatus = connectionTest.status;
        serverMessage = connectionTest.message;
        console.log(`🟢 [API Route] LLM server status: ${serverStatus}`);
      } else {
        serverRunning = false;
        serverStatus = 'stopped';
        serverMessage = connectionTest.message;
        console.log(`🟡 [API Route] LLM server is not available: ${serverMessage}`);
      }
    } catch (connectionError) {
      console.warn('🟡 [API Route] Error testing server connection:', connectionError);
      
      // バックアッププラン: プロセスチェック
      if (isLlamaServerRunning()) {
        console.log('🟢 [API Route] LLM server process is running but HTTP connection failed');
        // プロセスは実行中だが応答していない場合
        serverRunning = false;
        serverStatus = 'starting';
        serverMessage = 'サーバープロセスは起動していますが、まだHTTPリクエストに応答していません。初期化が完了するまでお待ちください。';
      } else {
        console.log('🟡 [API Route] LLM server process is not running');
        serverRunning = false;
        serverStatus = 'stopped';
        serverMessage = 'LLMサーバーが実行されていません。';
      }
    }
    
    // サーバーが応答しない場合、あるいは起動中の場合
    if (!serverRunning || serverStatus === 'initializing' || serverStatus === 'starting') {
      console.log(`🟡 [API Route] LLM status: ${serverStatus} - cannot process request`);
      
      let statusCode = 503; // Service Unavailable
      let errorMessage = serverMessage || 'LLMサーバーが応答していません。';
      
      if (serverStatus === 'stopped') {
        errorMessage = 'LLMサーバーが実行されていません。アプリケーションを再起動してください。';
      } else if (serverStatus === 'initializing' || serverStatus === 'starting') {
        errorMessage = 'LLMサーバーは起動中です。しばらくお待ちください。ページを更新するか、再度お試しください。';
      }
      
      // 非ストリーミングレスポンスとして返す
      return NextResponse.json(
        { 
          error: errorMessage,
          serverStatus: serverStatus
        },
        { status: statusCode }
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
    // サーバーの詳細な状態確認
    let serverRunning = false;
    let serverStatus = 'unknown';
    let serverMessage = '';
    let corsEnabled = false;
    
    try {
      // testServerConnectionを使用した詳細な状態確認
      const connectionTest = await testServerConnection();
      
      if (connectionTest.success) {
        serverRunning = true;
        serverStatus = connectionTest.status;
        serverMessage = connectionTest.message;
      } else {
        // プロセスチェック（バックアップ）
        if (isLlamaServerRunning()) {
          serverStatus = 'starting';
          serverMessage = 'サーバープロセスは実行中ですが、まだHTTPリクエストに応答していません';
          serverRunning = true;
        } else {
          serverStatus = 'stopped';
          serverMessage = 'LLMサーバーが実行されていません';
          serverRunning = false;
        }
      }
      
      // CORSステータスを確認
      corsEnabled = isCorsEnabled();
      
    } catch (error) {
      console.warn('Error checking llama-server health:', error);
      
      // プロセスが起動しているかチェック
      if (isLlamaServerRunning()) {
        serverStatus = 'running'; // プロセスが動いているなら'running'に設定
        serverMessage = 'サーバープロセスは起動しています';
        // プロセスが実行中であれば、応答可能と見なす
        serverRunning = true;
      } else {
        serverStatus = 'stopped';
        serverMessage = 'LLMサーバーが実行されていません';
        serverRunning = false;
      }
    }
    
    return NextResponse.json({ 
      running: serverRunning,
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