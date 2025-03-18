import { NextRequest, NextResponse } from 'next/server';
import { 
  isLlamaServerRunning, 
  isCorsEnabled, 
  detectGpuCapabilities,
  DEFAULT_LLAMA_CONFIG
} from '@/lib/gemma/llama-cpp';
import { 
  pingLlamaServer, 
  testServerConnection, 
  getModelInfo 
} from '@/lib/gemma/llama-client';
import { estimateMemoryUsage, getContextSize } from '@/lib/gemma/llm';

/**
 * LLMサーバーの詳細なステータス情報を提供するAPIエンドポイント
 */
export async function GET(req: NextRequest) {
  try {
    console.log('🟢 [API Route] GET /api/llm/status received');
    
    // サーバーの基本状態を確認
    const processRunning = isLlamaServerRunning();
    let serverStatus = 'stopped';
    let httpResponding = false;
    let modelInfo = null;
    let contextLength = DEFAULT_LLAMA_CONFIG.contextSize;
    let memoryUsage = 0;
    let gpuLayers = 0;
    let corsEnabled = false;
    
    // 詳細ステータス情報の初期化
    const detailedStatus = {
      process: {
        running: processRunning,
        pid: null,
        startTime: null
      },
      server: {
        responding: false,
        endpoint: 'http://127.0.0.1:8080',
        status: 'unavailable'
      },
      model: {
        name: 'Gemma 12B (Q8_0)',
        contextLength: DEFAULT_LLAMA_CONFIG.contextSize,
        memoryUsage: 0,
        parameters: '12B',
        quantization: 'Q8_0'
      },
      hardware: {
        gpu: {
          available: false,
          layers: 0,
          vramEstimate: 0
        },
        cpu: {
          threads: DEFAULT_LLAMA_CONFIG.threads
        }
      }
    };
    
    // より詳細なサーバー状態確認
    if (processRunning) {
      try {
        // 接続テスト
        const connectionTest = await testServerConnection();
        httpResponding = connectionTest.success;
        serverStatus = connectionTest.status;
        
        detailedStatus.server.responding = httpResponding;
        detailedStatus.server.status = connectionTest.status;
        
        if (httpResponding) {
          // モデル情報を取得
          try {
            modelInfo = await getModelInfo();
            
            if (modelInfo) {
              detailedStatus.model.name = modelInfo.name || 'Gemma 12B';
              
              // モデルパラメータが利用可能ならそれらを設定
              if (modelInfo.modelParams) {
                detailedStatus.model.parameters = `${(modelInfo.modelParams.n_params || 12) / 1000000000}B`;
                contextLength = modelInfo.modelParams.context_length || DEFAULT_LLAMA_CONFIG.contextSize;
                detailedStatus.model.contextLength = contextLength;
              }
            }
          } catch (modelError) {
            console.warn('Failed to get model info:', modelError);
          }

          // メモリ使用量の概算
          memoryUsage = estimateMemoryUsage();
          detailedStatus.model.memoryUsage = memoryUsage;
          
          // GPU情報を取得
          gpuLayers = await detectGpuCapabilities();
          detailedStatus.hardware.gpu.available = gpuLayers > 0;
          detailedStatus.hardware.gpu.layers = gpuLayers;
          
          // VRAMの予測（非常に大まかな見積もり）
          if (gpuLayers > 0) {
            const vramPerLayer = 300; // 平均的なVRAM使用量（MB単位）
            detailedStatus.hardware.gpu.vramEstimate = gpuLayers * vramPerLayer;
          }
          
          // CORS設定を確認
          corsEnabled = isCorsEnabled();
        }
      } catch (error) {
        console.warn('Error checking server details:', error);
      }
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: serverStatus,
      processRunning,
      httpResponding,
      memoryUsage,
      contextLength,
      gpuLayers,
      corsEnabled,
      model: 'Gemma 12B (Q8_0)',
      detailed: detailedStatus
    });
  } catch (error) {
    console.error('Error in status API:', error);
    
    return NextResponse.json(
      { error: 'サーバーステータスの取得に失敗しました' },
      { status: 500 }
    );
  }
}