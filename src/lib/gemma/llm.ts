/**
 * High-level interface for the Gemma LLM
 * This provides the main API for interacting with the model
 */

import { 
  startLLMServer, 
  stopLLMServer, 
  isLLMServerRunning,
  sendCompletionRequest,
  sendStreamingCompletionRequest
} from './server';
import { Message, ModelParams } from '.';

// Default model parameters
const DEFAULT_MODEL_PARAMS: ModelParams = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,
  max_tokens: 2048,
  stream: false,
};

/**
 * Initialize and start the LLM system
 */
export async function initializeLLM(): Promise<boolean> {
  // Check if already running
  if (isLLMServerRunning()) {
    console.log('LLM is already initialized');
    return true;
  }
  
  console.log('Initializing Gemma LLM...');
  
  try {
    // Start the LLM server with default config
    const started = await startLLMServer();
    if (!started) {
      throw new Error('Failed to start LLM server');
    }
    
    console.log('Gemma LLM initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing Gemma LLM:', error);
    return false;
  }
}

/**
 * Shut down the LLM system
 */
export async function shutdownLLM(): Promise<boolean> {
  console.log('Shutting down Gemma LLM...');
  
  try {
    await stopLLMServer();
    console.log('Gemma LLM shut down successfully');
    return true;
  } catch (error) {
    console.error('Error shutting down Gemma LLM:', error);
    return false;
  }
}

/**
 * Generate a completion from the model
 */
export async function generateCompletion(
  messages: Message[],
  params: Partial<ModelParams> = {}
): Promise<string> {
  // Ensure LLM is initialized
  if (!isLLMServerRunning()) {
    await initializeLLM();
  }
  
  // Merge default params with provided params
  const finalParams: ModelParams = { ...DEFAULT_MODEL_PARAMS, ...params };
  
  try {
    // Send the completion request to the server
    return await sendCompletionRequest(messages, finalParams);
  } catch (error) {
    console.error('Error generating completion:', error);
    throw error;
  }
}

/**
 * Generate a streaming completion from the model
 */
export async function* streamCompletion(
  messages: Message[],
  params: Partial<ModelParams> = {}
): AsyncGenerator<string, void, unknown> {
  // Ensure LLM is initialized
  if (!isLLMServerRunning()) {
    await initializeLLM();
  }
  
  // Merge default params with provided params
  const finalParams: ModelParams = { 
    ...DEFAULT_MODEL_PARAMS, 
    ...params,
    stream: true 
  };
  
  try {
    // Send the streaming completion request to the server
    yield* sendStreamingCompletionRequest(messages, finalParams);
  } catch (error) {
    console.error('Error streaming completion:', error);
    throw error;
  }
}
