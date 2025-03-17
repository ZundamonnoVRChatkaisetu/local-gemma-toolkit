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
    
    // 1. 直接APIエンドポイントを確認
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
    
    // 2. プロセスチェック
    if (!serverConnected) {
      const processRunning = isLlamaServerRunning();
      if (processRunning) {
        console.log('🟢 [API Route] LLM server process is running');
        serverConnected = true; // プロセスが動いていれば接続可能とみなす
      } else {
        console.warn('🟡 [API Route] LLM server process is not running');
      }
    }
    
    // サーバーが応答していない場合
    if (!serverConnected) {
      // ストリーミングモードの場合は特別なレスポンス
      if (stream) {
        const encoder = new TextEncoder();
        const customReadable = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('LLMサーバーが応答していません。サーバーを起動してください。'));
            controller.close();
          }
        });
        
        return new NextResponse(customReadable, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      } else {
        return NextResponse.json(
          { 
            error: 'LLMサーバーが応答していません。サーバーを起動してください。',
            serverStatus: 'stopped'
          },
          { status: 503 }
        );
      }
    }
    
    // If stream is true, set up a streaming response
    if (stream) {
      console.log('🟢 [API Route] Setting up streaming response');
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          try {
            // 「生成中...」と表示
            controller.enqueue(encoder.encode(''));
            
            // 常にライブラリ実装を使用（直接通信はスキップ）
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
        serverStatus = 'starting';
        serverMessage = 'サーバープロセスは起動していますが、HTTPリクエストにはまだ応答していません';
        // プロセスが実行中であれば、応答可能と見なす（起動中）
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