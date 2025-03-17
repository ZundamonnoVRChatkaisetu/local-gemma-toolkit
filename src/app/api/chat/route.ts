import { NextRequest, NextResponse } from 'next/server';
import { generateCompletion, streamCompletion, Message, initializeLLM, isLlamaServerRunning } from '@/lib/gemma';
import prisma from '@/lib/prisma/client';

// Handle POST requests to /api/chat
export async function POST(req: NextRequest) {
  try {
    // LLMが初期化されていることを確認
    if (!isLlamaServerRunning()) {
      console.log('LLM is not running, attempting to initialize...');
      const initialized = await initializeLLM();
      if (!initialized) {
        return NextResponse.json(
          { error: 'LLMサーバーの初期化に失敗しました。サーバーログを確認してください。' },
          { status: 500 }
        );
      }
    }
    
    const { messages, conversationId, stream = true } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'メッセージ配列が必要です' },
        { status: 400 }
      );
    }
    
    // If stream is true, set up a streaming response
    if (stream) {
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          try {
            // 「生成中...」と表示
            controller.enqueue(encoder.encode(''));
            
            // Use the streaming version of the LLM completion
            const streamGen = streamCompletion(messages);
            
            // 応答を受信したかどうかを追跡
            let receivedResponse = false;
            
            // Send message as chunks come in
            for await (const chunk of streamGen) {
              receivedResponse = true;
              controller.enqueue(encoder.encode(chunk));
            }
            
            // 応答が空だった場合
            if (!receivedResponse) {
              controller.enqueue(encoder.encode(
                '応答を生成できませんでした。サーバーの状態を確認してください。'
              ));
            }
            
            // Save the message to database (in a real implementation, we'd collect the full response first)
            if (conversationId) {
              // Placeholder for saving completion to database
              // In a real implementation, we'd collect the full response and save it
            }
            
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
      const completion = await generateCompletion(messages);
      
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
    const status = isLlamaServerRunning() 
      ? 'running' 
      : 'stopped';
    
    return NextResponse.json({ 
      status,
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
