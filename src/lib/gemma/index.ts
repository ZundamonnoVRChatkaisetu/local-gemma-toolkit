/**
 * Main export file for the Gemma LLM interface
 */

// Re-export types
export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  role: Role;
  content: string;
}

export interface ModelParams {
  temperature: number;
  top_p: number;
  top_k: number;
  max_tokens: number;
  stop_sequences?: string[];
  stream?: boolean;
}

// Re-export functions from llm.ts
export { 
  initializeLLM, 
  shutdownLLM,
  generateCompletion, 
  streamCompletion 
} from './llm';
