import { NextRequest, NextResponse } from 'next/server';
import { generateCompletion, streamCompletion, Message } from '@/lib/gemma';
import prisma from '@/lib/prisma/client';

// Handle POST requests to /api/chat
export async function POST(req: NextRequest) {
  try {
    const { messages, conversationId, stream = true } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400 }
      );
    }
    
    // If stream is true, set up a streaming response
    if (stream) {
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          try {
            // Use the streaming version of the LLM completion
            const streamGen = streamCompletion(messages);
            
            // Send message as chunks come in
            for await (const chunk of streamGen) {
              controller.enqueue(encoder.encode(chunk));
            }
            
            // Save the message to database (in a real implementation, we'd collect the full response first)
            if (conversationId) {
              // Placeholder for saving completion to database
              // In a real implementation, we'd collect the full response and save it
            }
            
            controller.close();
          } catch (error) {
            console.error('Error in streaming response:', error);
            controller.error(error);
          }
        },
      });
      
      return new NextResponse(customReadable, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
        },
      });
    }
    
    // Non-streaming response
    const completion = await generateCompletion(messages);
    
    // In a real implementation, save to database
    if (conversationId) {
      // Placeholder for saving to database
    }
    
    return NextResponse.json({ completion });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Failed to generate completion' },
      { status: 500 }
    );
  }
}
