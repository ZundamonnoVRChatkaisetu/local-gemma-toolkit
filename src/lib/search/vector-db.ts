/**
 * ベクトルデータベースの実装
 * 効率的なベクトル検索を提供します
 */

import prisma from '@/lib/prisma/client';
import { Database, Statement } from 'better-sqlite3';
import sqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// デフォルト設定
const DEFAULT_VECTOR_DIMENSION = 384;
const DEFAULT_INDEX_THRESHOLD = 1000; // このサイズを超えるとインデックスを作成

// SQLiteのベクトル拡張機能パス
const SQLITE_VECTOR_EXTENSION_PATH = path.join(process.cwd(), 'bin/sqlite-vss.so');

let db: Database | null = null;
let initialized = false;

/**
 * SQLiteベクトル拡張が存在するかチェック
 */
export async function checkVectorExtension(): Promise<boolean> {
  try {
    const extensionExists = fs.existsSync(SQLITE_VECTOR_EXTENSION_PATH);
    if (!extensionExists) {
      console.warn(`SQLite vector extension not found at ${SQLITE_VECTOR_EXTENSION_PATH}`);
    }
    return extensionExists;
  } catch (error) {
    console.error('Error checking vector extension:', error);
    return false;
  }
}

/**
 * ベクトルデータベースを初期化
 */
export async function initVectorDb(): Promise<boolean> {
  if (initialized && db) {
    return true;
  }
  
  try {
    // ベクトル拡張が存在するか確認
    const extensionExists = await checkVectorExtension();
    
    // DBパスを取得
    const dbPath = path.join(process.cwd(), 'prisma/local-gemma.db');
    
    // SQLiteデータベースに接続
    db = sqlite3(dbPath);
    
    if (extensionExists) {
      // ベクトル拡張を読み込み
      db.loadExtension(SQLITE_VECTOR_EXTENSION_PATH);
      
      // ベクトルテーブルとインデックスを作成
      db.exec(`
        -- テーブルが存在しない場合は作成
        CREATE TABLE IF NOT EXISTS vector_embeddings (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          chunk_text TEXT NOT NULL,
          embedding BLOB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (document_id) REFERENCES Document(id) ON DELETE CASCADE
        );
        
        -- vssモジュールが読み込まれている場合のみインデックスを作成
        CREATE VIRTUAL TABLE IF NOT EXISTS vss_embeddings USING vss0(
          embedding(${DEFAULT_VECTOR_DIMENSION}),
          id,
          document_id,
          chunk_index
        );
      `);
    } else {
      // 拡張なしでもベーシックなテーブルを作成
      db.exec(`
        CREATE TABLE IF NOT EXISTS vector_embeddings (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          chunk_text TEXT NOT NULL,
          embedding TEXT NOT NULL, -- JSONとして格納
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (document_id) REFERENCES Document(id) ON DELETE CASCADE
        );
      `);
    }
    
    initialized = true;
    console.log('Vector database initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing vector database:', error);
    return false;
  }
}

/**
 * ベクトルをバイナリ形式に変換
 */
function vectorToBlob(vector: number[]): Buffer {
  const buffer = Buffer.alloc(vector.length * 4);
  for (let i = 0; i < vector.length; i++) {
    buffer.writeFloatLE(vector[i], i * 4);
  }
  return buffer;
}

/**
 * バイナリからベクトルに変換
 */
function blobToVector(blob: Buffer): number[] {
  const vector = [];
  for (let i = 0; i < blob.length / 4; i++) {
    vector.push(blob.readFloatLE(i * 4));
  }
  return vector;
}

/**
 * 埋め込みベクトルを保存
 */
export async function saveEmbedding(
  documentId: string,
  chunkIndex: number,
  chunkText: string,
  vector: number[]
): Promise<{ id: string }> {
  await initVectorDb();
  
  if (!db) {
    throw new Error('Vector database not initialized');
  }
  
  const id = `${documentId}_${chunkIndex}`;
  const hasExtension = await checkVectorExtension();
  
  try {
    if (hasExtension) {
      // 拡張あり: バイナリとしてベクトルを保存
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO vector_embeddings (id, document_id, chunk_index, chunk_text, embedding)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(id, documentId, chunkIndex, chunkText, vectorToBlob(vector));
      
      // インデックスにも追加
      const indexStmt = db.prepare(`
        INSERT OR REPLACE INTO vss_embeddings (rowid, id, document_id, chunk_index, embedding)
        VALUES ((SELECT rowid FROM vector_embeddings WHERE id = ?), ?, ?, ?, ?)
      `);
      
      indexStmt.run(id, id, documentId, chunkIndex, vectorToBlob(vector));
    } else {
      // 拡張なし: JSONとしてベクトルを保存
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO vector_embeddings (id, document_id, chunk_index, chunk_text, embedding)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(id, documentId, chunkIndex, chunkText, JSON.stringify(vector));
    }
    
    // Prisma側のEmbeddingテーブルにも同期（互換性のため）
    await prisma.embedding.upsert({
      where: { id },
      update: {
        chunkText,
        vector: JSON.stringify(vector),
      },
      create: {
        id,
        documentId,
        chunkIndex,
        chunkText,
        vector: JSON.stringify(vector),
      },
    });
    
    return { id };
  } catch (error) {
    console.error('Error saving embedding:', error);
    throw error;
  }
}

/**
 * ドキュメントからすべての埋め込みを取得
 */
export async function getEmbeddingsByDocumentId(documentId: string): Promise<{
  id: string;
  chunkIndex: number;
  chunkText: string;
  vector: number[];
}[]> {
  await initVectorDb();
  
  if (!db) {
    throw new Error('Vector database not initialized');
  }
  
  const hasExtension = await checkVectorExtension();
  let stmt: Statement;
  
  try {
    if (hasExtension) {
      stmt = db.prepare(`
        SELECT id, document_id, chunk_index, chunk_text, embedding
        FROM vector_embeddings
        WHERE document_id = ?
        ORDER BY chunk_index
      `);
      
      const rows = stmt.all(documentId) as any[];
      
      return rows.map(row => ({
        id: row.id,
        chunkIndex: row.chunk_index,
        chunkText: row.chunk_text,
        vector: blobToVector(row.embedding),
      }));
    } else {
      stmt = db.prepare(`
        SELECT id, document_id, chunk_index, chunk_text, embedding
        FROM vector_embeddings
        WHERE document_id = ?
        ORDER BY chunk_index
      `);
      
      const rows = stmt.all(documentId) as any[];
      
      return rows.map(row => ({
        id: row.id,
        chunkIndex: row.chunk_index,
        chunkText: row.chunk_text,
        vector: JSON.parse(row.embedding),
      }));
    }
  } catch (error) {
    console.error('Error getting embeddings by document ID:', error);
    throw error;
  }
}

/**
 * ベクトル類似度検索
 */
export async function searchSimilarVectors(
  queryVector: number[],
  limit: number = 5,
  threshold: number = 0.6
): Promise<{
  id: string;
  documentId: string;
  chunkIndex: number;
  chunkText: string;
  similarity: number;
}[]> {
  await initVectorDb();
  
  if (!db) {
    throw new Error('Vector database not initialized');
  }
  
  const hasExtension = await checkVectorExtension();
  
  try {
    if (hasExtension) {
      // 拡張あり: 効率的なベクトル検索
      const stmt = db.prepare(`
        SELECT 
          e.id,
          e.document_id as documentId,
          e.chunk_index as chunkIndex,
          e.chunk_text as chunkText,
          vss_cosine_similarity(e.embedding, ?) as similarity
        FROM 
          vector_embeddings e
        ORDER BY 
          similarity DESC
        LIMIT ?
      `);
      
      const rows = stmt.all(vectorToBlob(queryVector), limit) as any[];
      
      // しきい値でフィルタリング
      return rows
        .filter(row => row.similarity >= threshold)
        .map(row => ({
          id: row.id,
          documentId: row.documentId,
          chunkIndex: row.chunkIndex,
          chunkText: row.chunkText,
          similarity: row.similarity,
        }));
    } else {
      // 拡張なし: 単純なイン・メモリ検索
      // 注意: これは大規模データセットには非効率です
      const stmt = db.prepare(`
        SELECT id, document_id as documentId, chunk_index as chunkIndex, chunk_text as chunkText, embedding
        FROM vector_embeddings
      `);
      
      const rows = stmt.all() as any[];
      
      // メモリ内でコサイン類似度を計算
      const results = rows.map(row => {
        const vector = JSON.parse(row.embedding);
        const similarity = calculateCosineSimilarity(queryVector, vector);
        return {
          id: row.id,
          documentId: row.documentId,
          chunkIndex: row.chunkIndex,
          chunkText: row.chunkText,
          similarity,
        };
      });
      
      // しきい値でフィルタリングし、類似度の降順でソート
      return results
        .filter(item => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    }
  } catch (error) {
    console.error('Error searching similar vectors:', error);
    throw error;
  }
}

/**
 * コサイン類似度を計算（拡張なしの場合のフォールバック）
 */
function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }
  
  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  return dotProduct / (mag1 * mag2);
}

/**
 * ベクトルデータベースを閉じる
 */
export function closeVectorDb(): void {
  if (db) {
    db.close();
    db = null;
    initialized = false;
  }
}
