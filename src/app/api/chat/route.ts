import { NextRequest, NextResponse } from 'next/server';
import { generateCompletion, streamCompletion, Message, initializeLLM } from '@/lib/gemma';
import { isLlamaServerRunning, isCorsEnabled } from '@/lib/gemma/llama-cpp';
import { pingLlamaServer } from '@/lib/gemma/llama-client';
import prisma from '@/lib/prisma/client';
import fetch from 'node-fetch';

// Handle POST requests to /api/chat
export async function POST(req: NextRequest) {
  try {
    // サーバーが応答しているかを直接チェック
    let serverResponding = false;
    try {
      // 503ステータスも考慮して改善したpingLlamaServer関数を使用
      serverResponding = await pingLlamaServer(2, 1000);
    } catch (pingError) {
      console.warn('Error pinging llama-server:', pingError);
    }
    
    // LLMが初期化されていることを確認
    if (!serverResponding) {
      console.log('LLM is not running, attempting to initialize...');
      try {
        const initialized = await initializeLLM();
        if (!initialized) {
          return NextResponse.json(
            { error: 'LLMサーバーの初期化に失敗しました。サーバーログを確認してください。' },
            { status: 500 }
          );
        }
        
        // 初期化後に再度ping（より長い待機時間を設定）
        console.log('LLM initialized, waiting for server to become responsive...');
        // 初期化直後は応答が遅いことがあるため、待機時間を延長
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        serverResponding = await pingLlamaServer(2, 2000);
        if (!serverResponding) {
          console.warn('Server initialized but not responding to ping. Continuing anyway since process might still be loading...');
          // プロセスが起動中でも続行する
        }
      } catch (initError) {
        console.error('Error initializing LLM:', initError);
        return NextResponse.json(
          { error: 'LLMサーバーの初期化中にエラーが発生しました: ' + (initError.message || '不明なエラー') },
          { status: 500 }
        );
      }
    }
    
    // リクエストボディの解析
    let messages, conversationId, stream;
    try {
      const body = await req.json();
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
            
            // サーバー直接通信を試みる
            let directServerResponse = false;
            
            // 直接 llama-server と通信を試みる
            try {
              console.log('Attempting direct communication with llama-server...');
              
              // リクエストを構築
              const prompt = messages.map(message => {
                switch (message.role) {
                  case 'system':
                    return `<start_of_turn>system\n${message.content.trim()}<end_of_turn>\n\n`;
                  case 'user':
                    return `<start_of_turn>user\n${message.content.trim()}<end_of_turn>\n\n`;
                  case 'assistant':
                    return `<start_of_turn>model\n${message.content.trim()}<end_of_turn>\n\n`;
                  default:
                    return `${message.content.trim()}\n\n`;
                }
              }).join('') + '<start_of_turn>model\n';
              
              const llamaRequest = {
                prompt,
                temperature: 0.7,
                top_p: 0.9,
                top_k: 40,
                max_tokens: 2048,
                stop: ['<end_of_turn>'],
                stream: true
              };
              
              // サーバーに直接リクエストを送信
              const response = await fetch('http://127.0.0.1:8080/completion', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(llamaRequest),
                timeout: 10000
              });
              
              // 503エラーの場合は初期化中と判断し待機
              if (response.status === 503) {
                console.log('Server returned 503, waiting for initialization...');
                controller.enqueue(encoder.encode('サーバーが初期化中です、少々お待ちください...\n'));
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // 再試行
                const retryResponse = await fetch('http://127.0.0.1:8080/completion', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(llamaRequest),
                  timeout: 15000
                });
                
                if (retryResponse.ok && retryResponse.body) {
                  response.body = retryResponse.body;
                }
              }
              
              if (response.ok && response.body) {
                directServerResponse = true;
                console.log('Direct server communication successful');
                
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  
                  const chunk = decoder.decode(value, { stream: true });
                  buffer += chunk;
                  
                  // JSONライン形式でデータが送られてくるため、行ごとに処理
                  const lines = buffer.split('\n');
                  buffer = lines.pop() || ''; // 最後の不完全な行をバッファに残す
                  
                  for (const line of lines) {
                    if (!line.trim()) continue;
                    
                    try {
                      const data = JSON.parse(line);
                      if (data.content) {
                        controller.enqueue(encoder.encode(data.content));
                      }
                      
                      if (data.stop) {
                        break;
                      }
                    } catch (e) {
                      // JSONパース失敗時
                      if (line.includes('<end_of_turn>')) {
                        break;
                      }
                      
                      if (line.trim() && !line.startsWith('{') && !line.startsWith('[')) {
                        controller.enqueue(encoder.encode(line.trim()));
                      }
                    }
                  }
                }
                
                reader.releaseLock();
              } else {
                console.warn(`Direct server communication failed (status: ${response.status}), falling back to library`);
              }
            } catch (directError) {
              console.error('Error in direct server communication:', directError);
              console.log('Falling back to library implementation');
            }
            
            // 直接通信が失敗した場合はライブラリを使用
            if (!directServerResponse) {
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
      // 直接 llama-server と通信を試みる
      let directResponse = null;
      
      try {
        console.log('Attempting direct non-streaming communication with llama-server...');
        
        // リクエストを構築
        const prompt = messages.map(message => {
          switch (message.role) {
            case 'system':
              return `<start_of_turn>system\n${message.content.trim()}<end_of_turn>\n\n`;
            case 'user':
              return `<start_of_turn>user\n${message.content.trim()}<end_of_turn>\n\n`;
            case 'assistant':
              return `<start_of_turn>model\n${message.content.trim()}<end_of_turn>\n\n`;
            default:
              return `${message.content.trim()}\n\n`;
          }
        }).join('') + '<start_of_turn>model\n';
        
        const llamaRequest = {
          prompt,
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          max_tokens: 2048,
          stop: ['<end_of_turn>'],
          stream: false
        };
        
        // サーバーに直接リクエストを送信
        const response = await fetch('http://127.0.0.1:8080/completion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(llamaRequest),
          timeout: 30000
        });
        
        // 503エラーの場合は初期化中と判断し待機
        if (response.status === 503) {
          console.log('Server returned 503, waiting for initialization...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // 再試行
          const retryResponse = await fetch('http://127.0.0.1:8080/completion', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(llamaRequest),
            timeout: 30000
          });
          
          if (retryResponse.ok) {
            const data = await retryResponse.json();
            directResponse = data.content;
          }
        } else if (response.ok) {
          const data = await response.json();
          directResponse = data.content;
        } else {
          console.warn(`Direct server communication failed (status: ${response.status}), falling back to library`);
        }
      } catch (directError) {
        console.error('Error in direct server communication:', directError);
        console.log('Falling back to library implementation');
      }
      
      if (directResponse) {
        return NextResponse.json({ completion: directResponse });
      }
      
      // ライブラリ実装にフォールバック
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