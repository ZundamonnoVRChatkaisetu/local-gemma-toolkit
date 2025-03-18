"use client";

import React, { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, Server, Cpu, Memory } from 'lucide-react';

interface ServerStatus {
  status: 'running' | 'initializing' | 'stopped' | 'unknown';
  message: string;
  timestamp: string;
  details?: {
    model?: string;
    memoryUsage?: number;
    contextLength?: number;
    corsEnabled?: boolean;
    gpuLayers?: number;
  };
}

interface ServerStatusMonitorProps {
  showDetailed?: boolean;
  onInitialize?: () => void;
  className?: string;
}

export function ServerStatusMonitor({ 
  showDetailed = false, 
  onInitialize, 
  className = '' 
}: ServerStatusMonitorProps) {
  const [status, setStatus] = useState<ServerStatus>({
    status: 'unknown',
    message: 'サーバーステータスを確認中...',
    timestamp: new Date().toISOString(),
    details: {}
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchServerStatus = async () => {
    try {
      setIsRefreshing(true);
      // 正しいAPIエンドポイントを使用
      const response = await fetch('/api/llm/status');
      
      if (!response.ok) {
        setStatus({
          status: 'stopped',
          message: 'LLMサーバーとの接続に失敗しました',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      const data = await response.json();
      
      // ステータス情報を解析
      let serverStatus: 'running' | 'initializing' | 'stopped' | 'unknown' = 'unknown';
      let statusMessage = '';
      
      // 新しいAPI応答形式に合わせて解析
      if (data.status) {
        serverStatus = data.status as 'running' | 'initializing' | 'stopped' | 'unknown';
        
        switch (serverStatus) {
          case 'running':
            statusMessage = 'LLMサーバーが正常に動作しています';
            break;
          case 'initializing':
            statusMessage = 'LLMサーバーが初期化中です';
            break;
          case 'stopped':
            statusMessage = 'LLMサーバーが停止しています';
            break;
          default:
            statusMessage = 'サーバーの状態が不明です';
        }
      }
      
      // 詳細情報を解析
      const details = {
        model: data.model || 'Gemma 12B (Q8_0)',
        memoryUsage: data.memoryUsage || 0,
        contextLength: data.contextLength || 4096,
        corsEnabled: data.corsEnabled || false,
        gpuLayers: data.gpuLayers || 0
      };
      
      // さらに詳細な情報が利用可能な場合は使用
      if (data.detailed) {
        if (data.detailed.model) {
          details.model = data.detailed.model.name || details.model;
        }
        
        if (data.detailed.hardware && data.detailed.hardware.gpu) {
          details.gpuLayers = data.detailed.hardware.gpu.layers || details.gpuLayers;
        }
      }
      
      setStatus({
        status: serverStatus,
        message: statusMessage,
        timestamp: data.timestamp || new Date().toISOString(),
        details
      });
    } catch (error) {
      console.error('Error fetching server status:', error);
      setStatus({
        status: 'unknown',
        message: '接続エラー: サーバーの状態を確認できません',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // 初期ロード
    fetchServerStatus();
    
    // 10秒ごとに更新
    const intervalId = setInterval(fetchServerStatus, 10000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const handleManualRefresh = () => {
    fetchServerStatus();
  };

  const handleInitialize = () => {
    if (onInitialize) {
      onInitialize();
    }
  };

  return (
    <div className={`p-3 border rounded-md ${className} ${
      status.status === 'running' ? 'bg-green-50 border-green-500 text-green-700' :
      status.status === 'initializing' ? 'bg-yellow-50 border-yellow-500 text-yellow-700' :
      status.status === 'stopped' ? 'bg-red-50 border-red-500 text-red-700' :
      'bg-yellow-50 border-yellow-500 text-yellow-700'
    }`}>
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full mr-2 ${
          status.status === 'running' ? 'bg-green-500' :
          status.status === 'initializing' ? 'bg-yellow-500' :
          status.status === 'stopped' ? 'bg-red-500' :
          'bg-yellow-500'
        }`}></div>
        <div className="flex-1">
          <div className="font-medium">
            {status.status === 'running' ? '稼働中' :
             status.status === 'initializing' ? '初期化中' :
             status.status === 'stopped' ? '停止中' :
             '不明'}
          </div>
          <div className="text-sm">
            {status.message}
          </div>
        </div>
        <div className="flex space-x-2">
          {status.status === 'stopped' && (
            <button 
              onClick={handleInitialize}
              className="text-xs bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded"
              title="サーバーを起動"
            >
              起動
            </button>
          )}
          <button 
            onClick={handleManualRefresh}
            className={`p-1 hover:bg-gray-100 rounded-full ${isRefreshing ? 'animate-spin' : ''}`}
            title="ステータスを更新"
            disabled={isRefreshing}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* 詳細情報（showDetailedがtrueの場合のみ表示） */}
      {showDetailed && status.details && (
        <div className="mt-2 pt-2 border-t border-gray-200 text-xs grid grid-cols-2 gap-2">
          <div className="flex items-center">
            <Server className="h-3 w-3 mr-1" />
            <span>モデル: {status.details.model || '不明'}</span>
          </div>
          <div className="flex items-center">
            <Memory className="h-3 w-3 mr-1" />
            <span>メモリ使用量: {status.details.memoryUsage || 0} MB</span>
          </div>
          <div className="flex items-center">
            <Cpu className="h-3 w-3 mr-1" />
            <span>GPU層: {status.details.gpuLayers || 0}</span>
          </div>
          <div className="flex items-center">
            <span>コンテキスト長: {status.details.contextLength || 4096}</span>
          </div>
          <div className="col-span-2 text-xs text-gray-500">
            最終更新: {new Date(status.timestamp).toLocaleString('ja-JP')}
          </div>
        </div>
      )}
    </div>
  );
}