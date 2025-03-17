import { NextRequest, NextResponse } from 'next/server';
import {
  createLearningSession,
  getLearningSessionList,
  getLearningSession,
  generateQuestion,
  saveLearningRecord,
  analyzeLearningProgress,
} from '@/lib/learning';

// Handle GET requests to /api/learn
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');
    
    // Return list of all sessions if no ID is provided
    if (!sessionId) {
      const sessions = await getLearningSessionList();
      return NextResponse.json({ sessions });
    }
    
    // Return specific session if ID is provided
    const session = await getLearningSession(sessionId);
    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error in learn API (GET):', error);
    return NextResponse.json(
      { error: 'Failed to fetch learning data' },
      { status: 500 }
    );
  }
}

// Handle POST requests to /api/learn
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    
    switch (action) {
      case 'create_session':
        // Create a new learning session
        const { title, subject } = body;
        if (!title || !subject) {
          return NextResponse.json(
            { error: 'Title and subject are required' },
            { status: 400 }
          );
        }
        
        const session = await createLearningSession(title, subject);
        return NextResponse.json({ session });
      
      case 'generate_question':
        // Generate a question for a session
        const { sessionId, difficulty } = body;
        if (!sessionId) {
          return NextResponse.json(
            { error: 'Session ID is required' },
            { status: 400 }
          );
        }
        
        const questionData = await generateQuestion(sessionId, difficulty || 5);
        return NextResponse.json(questionData);
      
      case 'save_answer':
        // Save a user's answer
        const { 
          sessionId: sId, 
          question, 
          answer, 
          userAnswer, 
          difficulty: diff = 5 
        } = body;
        
        if (!sId || !question || !answer || !userAnswer) {
          return NextResponse.json(
            { error: 'Session ID, question, answer, and userAnswer are required' },
            { status: 400 }
          );
        }
        
        const record = await saveLearningRecord(sId, question, answer, userAnswer, diff);
        return NextResponse.json({ record });
      
      case 'analyze_progress':
        // Analyze learning progress
        const { sessionId: sessId } = body;
        if (!sessId) {
          return NextResponse.json(
            { error: 'Session ID is required' },
            { status: 400 }
          );
        }
        
        const analysis = await analyzeLearningProgress(sessId);
        return NextResponse.json({ analysis });
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in learn API (POST):', error);
    return NextResponse.json(
      { error: 'Failed to process learning request' },
      { status: 500 }
    );
  }
}
