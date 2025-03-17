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
    // サーバーの状態を詳細に確認
    let serverStatus = 'stopped';
    let serverStatusMessage = '';
    
    // プロセスが実行中かチェック
    const isProcessRunning = isLlamaServerRunning();
    
    if (isProcessRunning) {
      serverStatus = 'running_process';
      
      // HTTPサーバーが応答しているかチェック
      try {
        const isResponding = await pingLlamaServer(2, 1000);
        if (isResponding) {
          serverStatus = 'ready';
        } else {
          serverStatus = 'initializing';
          serverStatusMessage = 'サーバープロセスは実行中ですが、HTTPリクエストにはまだ応答していません';
          
          // より詳細な接続テスト
          const connectionTest = await testServerConnection();
          if (connectionTest.status === 'initializing') {
            serverStatusMessage = 'サーバーは初期化中です。しばらくお待ちください。';
          } else if (connectionTest.status === 'unavailable') {
            serverStatus = 'error';
            serverStatusMessage = 'サーバーは実行中ですが、応答していません。アプリケーションの再起動が必要かもしれません。';
          }
        }
      } catch (pingError) {
        console.warn('Error pinging llama-server:', pingError);
        serverStatus = 'error';
        serverStatusMessage = 'サーバー状態の確認中にエラーが発生しました';
      }
    }
    
    // LLMが実行中でない場合
    if (serverStatus === 'stopped' || serverStatus === 'error') {
      console.log(`🟡 [API Route] LLM status: ${serverStatus} - ${serverStatusMessage}`);
      
      // エラーレスポンスを返す
      return NextResponse.json(
        { 
          error: 'LLMサーバーが正常に実行されていません。アプリケーションを再起動してください。',
          serverStatus: serverStatus,
          message: serverStatusMessage
        },
        { status: 503 }
      );
    }
    
    // リクエストボディの解析
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
    
    // サーバーがまだ初期化中の場合
    if (serverStatus === 'initializing') {
      // ストリーミングの場合は初期化中のメッセージをストリーミング
      if (stream) {
        console.log('🟡 [API Route] Server is initializing, sending initializing message as stream');
        const encoder = new TextEncoder();
        const customReadable = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('サーバーは初期化中です。しばらくお待ちください。後ほど再度お試しください。'));
            controller.close();
          }
        });
        
        return new NextResponse(customReadable, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache, no-transform',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      } else {
        // 非ストリーミングの場合は初期化中のメッセージを返す
        return NextResponse.json({
          completion: 'サーバーは初期化中です。しばらくお待ちください。後ほど再度お試しください。',
          serverStatus: 'initializing'
        });
      }
    }
    
    // If stream is true, set up a streaming response
    if (stream) {
      console.log('🟢 [API Route] Setting up streaming response');
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(''));
            
            console.log('🟢 [API Route] Using library implementation for streaming');
            
            try {
              // Use the streaming version of the LLM completion
              const streamGen = streamCompletion(messages);
              
              // 応答を受信したかどうかを追跡
              let receivedResponse = false;
              
              // Send message as chunks come in
              for await (const chunk of streamGen) {
                receivedResponse = true;
                console.log('🟢 [API Route] Streaming chunk:', chunk.slice(0, 50) + (chunk.length > 50 ? '...' : ''));
                controller.enqueue(encoder.encode(chunk));
              }
              
              // 応答が空だった場合
              if (!receivedResponse) {
                console.log('🔴 [API Route] No response received from streamCompletion');
                controller.enqueue(encoder.encode(
                  '応答を生成できませんでした。サーバーの状態を確認してください。'
                ));
              }
            } catch (streamError) {
              console.error('🔴 [API Route] Error in streamCompletion:', streamError);
              controller.enqueue(encoder.encode(
                `\n\nストリームエラー: ${streamError.message || '不明なエラー'}`
              ));
            }
            
            // Save the message to database (in a real implementation, we'd collect the full response first)
            if (conversationId) {
              // Placeholder for saving completion to database
              // In a real implementation, we'd collect the full response and save it
            }
            
            console.log('🟢 [API Route] Streaming completed, closing controller');
            controller.close();
          } catch (error) {
            console.error('Error in streaming response:', error);
            
            // エラーメッセージをクライアントに送信
            const errorMessage = error instanceof Error 
              ? error.message 
              : '不明なエラーが発生しました';
              
            controller.enqueue(encoder.encode(
              `\n\n申し訳ありません。エラーが発生しました: ${errorMessage}`
            ));
            controller.close();
          }
        },
      });
      
      console.log('🟢 [API Route] Returning streaming response');
      return new NextResponse(customReadable, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache, no-transform',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    
    // Non-streaming response
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
      
      // 詳細な接続テスト
      const connectionTest = await testServerConnection();
      serverStatus = connectionTest.status;
      serverMessage = connectionTest.message;
      serverResponding = connectionTest.success;
      
      if (!serverResponding) {
        // プロセスが起動しているかチェック
        if (isLlamaServerRunning()) {
          serverStatus = 'starting';
          serverMessage = 'サーバープロセスは起動していますが、HTTPリクエストにはまだ応答していません';
        }
      }
    } catch (error) {
      console.warn('Error checking llama-server health:', error);
      
      // プロセスが起動しているかチェック
      if (isLlamaServerRunning()) {
        serverStatus = 'starting';
        serverMessage = 'サーバープロセスは起動していますが、HTTPリクエストにはまだ応答していません';
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