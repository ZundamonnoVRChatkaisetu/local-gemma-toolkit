import { NextRequest, NextResponse } from 'next/server';
import { initializeLLM, isLlamaServerRunning, shutdownLLM } from '@/lib/gemma';
import { pingLlamaServer, testServerConnection } from '@/lib/gemma/llama-client';

// サーバー起動状態の追跡
let isServerStarting = false;
let lastInitTime = 0;

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
    const forceRestart = body.forceRestart === true;
    
    console.log(`🟢 [API Route] autoStart=${autoStart}, forceRestart=${forceRestart}`);
    
    // サーバーが既に動作しているかチェック
    let serverRunning = false;
    let serverStatusDetail = 'unknown';
    
    // まずプロセスベースのチェック
    if (isLlamaServerRunning()) {
      console.log('🟢 [API Route] LLM server process is already running');
      serverRunning = true;
      serverStatusDetail = 'process_running';
    } else {
      console.log('🟢 [API Route] LLM server process is not running');
      serverStatusDetail = 'process_stopped';
    }
    
    // 次にHTTPベースのチェック（別プロセスで起動している場合も検出）
    try {
      const connectionTest = await testServerConnection();
      if (connectionTest.success) {
        console.log(`🟢 [API Route] LLM server is responding to HTTP requests (${connectionTest.status})`);
        serverRunning = true;
        serverStatusDetail = connectionTest.status === 'initializing' ? 'initializing' : 'ready';
      } else {
        console.log(`🟢 [API Route] LLM server is not responding to HTTP requests (${connectionTest.status})`);
        serverStatusDetail = 'not_responding';
      }
    } catch (pingError) {
      console.warn('🟡 [API Route] Error testing LLM server connection:', pingError);
    }
    
    // 強制再起動が指定された場合、既存サーバーを停止
    if (forceRestart && serverRunning) {
      console.log('🟢 [API Route] Force restart requested, shutting down existing server');
      try {
        await shutdownLLM();
        serverRunning = false;
        serverStatusDetail = 'shutdown_for_restart';
        
        // 少し待機して完全に終了するのを待つ
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (shutdownError) {
        console.error('🔴 [API Route] Error shutting down LLM server:', shutdownError);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to shutdown existing server',
          detail: shutdownError instanceof Error ? shutdownError.message : String(shutdownError)
        }, { status: 500 });
      }
    }
    
    // サーバーが実行中であれば、初期化は不要
    if (serverRunning && !forceRestart) {
      console.log(`🟢 [API Route] LLM server is already running (${serverStatusDetail}), no initialization needed`);
      return NextResponse.json({ 
        success: true, 
        initialized: false,
        status: 'already_running',
        detail: serverStatusDetail,
        message: 'LLM server is already running' 
      });
    }
    
    // サーバーが起動中かどうかをチェック
    if (isServerStarting) {
      // 長時間起動中の場合はフラグをリセット（10分以上経過）
      const now = Date.now();
      if (now - lastInitTime > 10 * 60 * 1000) {
        console.log('🟡 [API Route] Previous initialization seems stuck, resetting flag');
        isServerStarting = false;
      } else {
        console.log('🟡 [API Route] LLM server initialization is already in progress');
        return NextResponse.json({ 
          success: true, 
          initialized: false,
          status: 'initializing',
          message: 'LLM server initialization is already in progress',
          startTime: lastInitTime
        });
      }
    }
    
    // autoStart=trueの場合のみサーバーを起動
    if (autoStart) {
      console.log('🟢 [API Route] Initializing LLM server...');
      
      try {
        // 起動中フラグを設定
        isServerStarting = true;
        lastInitTime = Date.now();
        
        const initialized = await initializeLLM();
        
        // 起動中フラグをリセット
        isServerStarting = false;
        
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
      } catch (initError) {
        // エラー時も起動中フラグをリセット
        isServerStarting = false;
        
        console.error('🔴 [API Route] Error initializing LLM server:', initError);
        
        const errorMessage = initError instanceof Error 
          ? initError.message 
          : 'Unknown error';
          
        return NextResponse.json({ 
          success: false, 
          error: errorMessage 
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
    // サーバーの状態を詳細に確認
    let processRunning = isLlamaServerRunning();
    let httpResponding = false;
    let serverStarting = isServerStarting;
    let connectionDetails = { status: 'unknown', message: '' };
    
    try {
      const connectionTest = await testServerConnection();
      httpResponding = connectionTest.success;
      connectionDetails = connectionTest;
    } catch (pingError) {
      console.warn('🟡 [API Route] Error testing LLM server connection:', pingError);
    }
    
    // 総合的なステータス
    const isRunning = processRunning || httpResponding;
    
    // 状態メッセージ
    let statusMessage = 'unknown';
    if (isRunning) {
      if (httpResponding) {
        statusMessage = connectionDetails.status;
      } else {
        statusMessage = 'process_running_not_responding';
      }
    } else if (serverStarting) {
      statusMessage = 'starting';
    } else {
      statusMessage = 'stopped';
    }
    
    return NextResponse.json({
      success: true,
      status: {
        processRunning,
        httpResponding,
        isRunning,
        serverStarting,
        initTime: lastInitTime,
        status: statusMessage,
        details: connectionDetails
      },
      timestamp: new Date().toISOString()
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