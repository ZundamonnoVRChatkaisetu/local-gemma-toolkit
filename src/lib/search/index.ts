/**
 * DeepSearch module for semantic search functionality
 * This will handle document embedding and vector search
 */

import prisma from '@/lib/prisma/client';
import { generateCompletion, Message } from '@/lib/gemma';
import { 
  initVectorDb,
  saveEmbedding,
  searchSimilarVectors,
  closeVectorDb
} from './vector-db';
import { performance } from 'perf_hooks';

// Interface for search results
export interface SearchResult {
  documentId: string;
  documentTitle: string;
  chunkText: string;
  similarity: number; // 0-1 where 1 is perfect match
}

// テキスト埋め込みモデルの選択肢
export type EmbeddingModel = 'gemma' | 'mini';

/**
 * テキスト埋め込みを生成
 * 注: 実際の実装では、専用の埋め込みモデルを使用します
 */
export async function generateEmbedding(
  text: string, 
  model: EmbeddingModel = 'mini'
): Promise<number[]> {
  if (model === 'gemma') {
    // Gemma LLMを使用して埋め込みを生成
    try {
      const messages: Message[] = [
        {
          role: 'system',
          content: 'Generate a 384-dimensional embedding vector for the following text. Return only the vector as a JSON array of numbers.'
        },
        {
          role: 'user',
          content: text
        }
      ];
      
      const completion = await generateCompletion(messages, {
        temperature: 0.1,
        max_tokens: 1024,
      });
      
      // JSON配列を抽出
      const match = completion.match(/\[[\d,.\s-]+\]/);
      if (match) {
        try {
          const vector = JSON.parse(match[0]) as number[];
          return vector;
        } catch (e) {
          console.error('Failed to parse embedding JSON:', e);
        }
      }
    } catch (error) {
      console.error('Error generating embedding with Gemma:', error);
    }
  }
  
  // フォールバック: シンプルな確定的ハッシュベースの埋め込み
  // 注: これは実際の意味検索には適していませんが、テスト目的には有効です
  console.log('Using fallback embedding model');
  const hashVector = new Array(384).fill(0);
  
  // テキストを単語に分割
  const words = text.toLowerCase().split(/\s+/);
  
  // 各単語がベクトルの一部を埋める
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    
    // 単語のハッシュ値を計算
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(j);
      hash |= 0; // 32ビット整数に変換
    }
    
    // ハッシュ値をベクトルの複数の位置に分散
    for (let k = 0; k < 4; k++) {
      const pos = Math.abs((hash + k * 123456789) % 384);
      hashVector[pos] += 1;
    }
  }
  
  // ベクトルを正規化
  const magnitude = Math.sqrt(hashVector.reduce((sum, val) => sum + val * val, 0));
  return magnitude === 0 
    ? hashVector 
    : hashVector.map(val => val / magnitude);
}

/**
 * 文書を固定サイズのチャンクに分割
 */
export function chunkDocument(
  text: string, 
  chunkSize: number = 1000, 
  overlap: number = 200
): string[] {
  // トラッキング用の変数
  const chunks: string[] = [];
  let currentPos = 0;

  // テキストが空の場合は空の配列を返す
  if (!text || text.trim() === '') {
    return [];
  }
  
  while (currentPos < text.length) {
    // チャンクの開始位置
    let chunkStart = currentPos;
    
    // チャンクの終了位置（仮）
    let chunkEnd = Math.min(chunkStart + chunkSize, text.length);
    
    // 文章の途中で切れないように調整
    if (chunkEnd < text.length) {
      // 段落の区切りを探す
      const paragraphBreak = text.lastIndexOf('\n\n', chunkEnd);
      if (paragraphBreak > chunkStart && paragraphBreak > chunkEnd - chunkSize / 2) {
        chunkEnd = paragraphBreak + 2;
      } else {
        // 文の終わりを探す
        const sentenceBreak = text.lastIndexOf('. ', chunkEnd);
        if (sentenceBreak > chunkStart && sentenceBreak > chunkEnd - chunkSize / 3) {
          chunkEnd = sentenceBreak + 2;
        } else {
          // 単語の区切りを探す
          const wordBreak = text.lastIndexOf(' ', chunkEnd);
          if (wordBreak > chunkStart && wordBreak > chunkEnd - 100) {
            chunkEnd = wordBreak + 1;
          }
        }
      }
    }
    
    // チャンクを配列に追加
    chunks.push(text.substring(chunkStart, chunkEnd).trim());
    
    // オーバーラップを考慮した次の開始位置
    currentPos = Math.min(chunkEnd, chunkStart + chunkSize - overlap);
    
    // 進捗がない場合は次の文字から開始
    if (currentPos <= chunkStart) {
      currentPos = chunkStart + 1;
    }
  }
  
  return chunks;
}

/**
 * 文書を処理し、埋め込みを生成してDBに保存
 */
export async function processDocument(
  documentId: string, 
  content: string, 
  model: EmbeddingModel = 'mini'
): Promise<boolean> {
  console.log(`Processing document ${documentId} (${content.length} chars)`);
  const startTime = performance.now();
  
  try {
    // ベクトルデータベースを初期化
    await initVectorDb();
    
    // 文書を取得
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });
    
    if (!document) {
      throw new Error(`Document with ID ${documentId} not found`);
    }
    
    // 文書をチャンクに分割
    const chunks = chunkDocument(content);
    console.log(`Document split into ${chunks.length} chunks`);
    
    // 各チャンクの埋め込みを生成して保存
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk, model);
      
      // 進捗ログ
      if (i % 10 === 0) {
        console.log(`Processing chunk ${i+1}/${chunks.length}`);
      }
      
      // 埋め込みを保存
      await saveEmbedding(documentId, i, chunk, embedding);
    }
    
    const endTime = performance.now();
    console.log(`Document processing completed in ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
    
    return true;
  } catch (error) {
    console.error('Error processing document:', error);
    return false;
  }
}

/**
 * テキストに類似した文書を検索
 */
export async function searchSimilarText(
  query: string, 
  limit: number = 5,
  model: EmbeddingModel = 'mini'
): Promise<SearchResult[]> {
  try {
    // ベクトルデータベースを初期化
    await initVectorDb();
    
    // クエリの埋め込みを生成
    const queryEmbedding = await generateEmbedding(query, model);
    
    // 類似ベクトルを検索
    const searchResults = await searchSimilarVectors(queryEmbedding, limit);
    
    // 検索結果をドキュメントタイトルと結合
    const results: SearchResult[] = [];
    
    for (const result of searchResults) {
      try {
        const document = await prisma.document.findUnique({
          where: { id: result.documentId },
          select: { title: true },
        });
        
        if (document) {
          results.push({
            documentId: result.documentId,
            documentTitle: document.title,
            chunkText: result.chunkText,
            similarity: result.similarity,
          });
        }
      } catch (e) {
        console.warn(`Couldn't find document ${result.documentId}:`, e);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error searching for similar text:', error);
    return [];
  }
}

/**
 * 検索結果から質問に対する回答を生成
 */
export async function generateAnswerFromSearchResults(
  query: string,
  searchResults: SearchResult[],
): Promise<string> {
  if (searchResults.length === 0) {
    return 'No relevant documents found to answer your question.';
  }
  
  try {
    // 検索結果のコンテキストを準備
    const context = searchResults.map((result, index) => 
      `Document ${index + 1}: ${result.documentTitle}\n${result.chunkText}`
    ).join('\n\n');
    
    // LLMに質問と回答を依頼
    const messages: Message[] = [
      {
        role: 'system',
        content: `You are an assistant that answers questions based on the provided document context. 
        Use only the information from the context to answer the question. 
        If the answer cannot be determined from the context, say so clearly.`
      },
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${query}`
      }
    ];
    
    const completion = await generateCompletion(messages, {
      temperature: 0.3,
      max_tokens: 1024,
    });
    
    return completion;
  } catch (error) {
    console.error('Error generating answer from search results:', error);
    return 'An error occurred while generating the answer. Please try again.';
  }
}
