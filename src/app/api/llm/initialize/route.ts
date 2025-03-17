import { NextRequest, NextResponse } from 'next/server';
import { initializeLLM, isLlamaServerRunning } from '@/lib/gemma';
import { pingLlamaServer } from '@/lib/gemma/llama-client';

/**
 * LLMサーバーを初期化するAPIエンドポイント
 * POSTリクエストでサーバーの起動をトリガーします
 */
export async function POST(req: NextRequest) {
  console.log('🟢 [API Route] POST /api/llm/initialize received');
  
  try {
    // リクエストボディを解析
    const body = await req.json();
    const autoStart = body.autoStart === true;
    
    console.log(`🟢 [API Route] autoStart=${autoStart}`);
    
    // サーバーが既に動作しているかチェック
    let serverRunning = false;
    
    // まずプロセスベースのチェック
    if (isLlamaServerRunning()) {
      console.log('🟢 [API Route] LLM server process is already running');
      serverRunning = true;
    } else {
      console.log('🟢 [API Route] LLM server process is not running');
    }
    
    // 次にHTTPベースのチェック（別プロセスで起動している場合も検出）
    try {
      const isResponding = await pingLlamaServer(2, 1000);
      if (isResponding) {
        console.log('🟢 [API Route] LLM server is responding to HTTP requests');
        serverRunning = true;
      } else {
        console.log('🟢 [API Route] LLM server is not responding to HTTP requests');
      }
    } catch (pingError) {
      console.warn('🟡 [API Route] Error pinging LLM server:', pingError);
    }
    
    // サーバーが実行中であれば、初期化は不要
    if (serverRunning) {
      console.log('🟢 [API Route] LLM server is already running, no initialization needed');
      return NextResponse.json({ 
        success: true, 
        initialized: false,
        status: 'already_running',
        message: 'LLM server is already running' 
      });
    }
    
    // autoStart=trueの場合のみサーバーを起動
    if (autoStart) {
      console.log('🟢 [API Route] Initializing LLM server...');
      const initialized = await initializeLLM();
      
      if (initialized) {
        console.log('🟢 [API Route] LLM server initialized successfully');
        return NextResponse.json({ 
          success: true, 
          initialized: true,
          status: 'initialized',
          message: 'LLM server initialized successfully' 
        });
      } else {
        console.error('🔴 [API Route] LLM server initialization failed');
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to initialize LLM server' 
        }, { status: 500 });
      }
    } else {
      console.log('🟢 [API Route] Auto-start is disabled');
      return NextResponse.json({ 
        success: false, 
        initialized: false,
        status: 'not_started',
        message: 'Auto-start is disabled and LLM server is not running' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('🔴 [API Route] Error initializing LLM server:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error';
    
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}

/**
 * LLMサーバーの状態を確認するエンドポイント
 */
export async function GET(req: NextRequest) {
  console.log('🟢 [API Route] GET /api/llm/initialize received');
  
  try {
    // サーバーの状態を確認
    let processRunning = isLlamaServerRunning();
    let httpResponding = false;
    
    try {
      httpResponding = await pingLlamaServer(1, 1000);
    } catch (pingError) {
      console.warn('🟡 [API Route] Error pinging LLM server:', pingError);
    }
    
    return NextResponse.json({
      success: true,
      status: {
        processRunning,
        httpResponding,
        isRunning: processRunning || httpResponding
      }
    });
  } catch (error) {
    console.error('🔴 [API Route] Error checking LLM server status:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error';
    
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}
