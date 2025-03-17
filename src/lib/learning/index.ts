/**
 * Learning platform module for the Local Gemma Toolkit
 * This handles the learning sessions, question generation, and progress tracking
 */

import prisma from '@/lib/prisma/client';
import { generateCompletion, Message } from '@/lib/gemma';

// Interface for learning session data
export interface LearningSessionData {
  id: string;
  title: string;
  subject: string;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for learning records
export interface LearningRecordData {
  id: string;
  sessionId: string;
  question: string;
  answer: string;
  userAnswer?: string;
  isCorrect?: boolean;
  difficulty: number;
  createdAt: Date;
}

/**
 * Create a new learning session
 */
export async function createLearningSession(
  title: string,
  subject: string
): Promise<LearningSessionData> {
  try {
    const session = await prisma.learningSession.create({
      data: {
        title,
        subject,
      },
    });
    
    return session;
  } catch (error) {
    console.error('Error creating learning session:', error);
    throw new Error('Failed to create learning session');
  }
}

/**
 * Get all learning sessions
 */
export async function getLearningSessionList(): Promise<LearningSessionData[]> {
  try {
    const sessions = await prisma.learningSession.findMany({
      orderBy: {
        updatedAt: 'desc',
      },
    });
    
    return sessions;
  } catch (error) {
    console.error('Error fetching learning sessions:', error);
    throw new Error('Failed to fetch learning sessions');
  }
}

/**
 * Get a specific learning session with its records
 */
export async function getLearningSession(sessionId: string): Promise<LearningSessionData & { records: LearningRecordData[] }> {
  try {
    const session = await prisma.learningSession.findUnique({
      where: { id: sessionId },
      include: {
        records: true,
      },
    });
    
    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }
    
    return session;
  } catch (error) {
    console.error(`Error fetching learning session ${sessionId}:`, error);
    throw new Error('Failed to fetch learning session');
  }
}

/**
 * Generate a question based on the learning session's subject and history
 */
export async function generateQuestion(
  sessionId: string,
  targetDifficulty: number = 5 // 1-10 scale
): Promise<{ question: string; answer: string }> {
  try {
    // Get the session to determine subject
    const session = await getLearningSession(sessionId);
    
    // Create a prompt for the LLM
    const messages: Message[] = [
      {
        role: 'system',
        content: `You are an educational assistant generating questions for a student learning ${session.subject}. 
        Generate a question at difficulty level ${targetDifficulty} on a scale of 1-10.
        The student's learning history shows they've answered questions on the following topics:
        ${session.records.map(r => `- ${r.question} (${r.isCorrect ? 'Correct' : 'Incorrect'})`).join('\n')}
        Provide a question and the correct answer. Format your response exactly as follows:
        QUESTION: [your question here]
        ANSWER: [the correct answer here]`
      }
    ];
    
    // Get completion from the model
    const completion = await generateCompletion(messages, {
      temperature: 0.7,
      max_tokens: 1024,
    });
    
    // Parse the completion to extract question and answer
    const questionMatch = completion.match(/QUESTION:\s*(.+?)(?=\n|$)/is);
    const answerMatch = completion.match(/ANSWER:\s*(.+?)(?=\n|$)/is);
    
    if (!questionMatch || !answerMatch) {
      throw new Error('Failed to generate valid question and answer');
    }
    
    const question = questionMatch[1].trim();
    const answer = answerMatch[1].trim();
    
    return { question, answer };
  } catch (error) {
    console.error(`Error generating question for session ${sessionId}:`, error);
    // Fallback to a default question if generation fails
    return {
      question: 'What is the capital of France?',
      answer: 'Paris',
    };
  }
}

/**
 * Save a learning record with the user's answer
 */
export async function saveLearningRecord(
  sessionId: string,
  question: string,
  answer: string,
  userAnswer: string,
  difficulty: number
): Promise<LearningRecordData> {
  try {
    // Calculate if the answer is correct
    // In a real implementation, this would use more sophisticated matching
    const isCorrect = userAnswer.toLowerCase().trim() === answer.toLowerCase().trim();
    
    // Save the record to the database
    const record = await prisma.learningRecord.create({
      data: {
        sessionId,
        question,
        answer,
        userAnswer,
        isCorrect,
        difficulty,
      },
    });
    
    return record;
  } catch (error) {
    console.error(`Error saving learning record for session ${sessionId}:`, error);
    throw new Error('Failed to save learning record');
  }
}

/**
 * Analyze learning progress for a session
 */
export async function analyzeLearningProgress(sessionId: string): Promise<{
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  averageDifficulty: number;
  recommendedDifficulty: number;
}> {
  try {
    // Get all records for the session
    const records = await prisma.learningRecord.findMany({
      where: { sessionId },
    });
    
    // Calculate statistics
    const totalQuestions = records.length;
    const correctAnswers = records.filter(r => r.isCorrect).length;
    const incorrectAnswers = totalQuestions - correctAnswers;
    
    // Calculate average difficulty
    const totalDifficulty = records.reduce((sum, record) => sum + record.difficulty, 0);
    const averageDifficulty = totalQuestions > 0 ? totalDifficulty / totalQuestions : 5;
    
    // Calculate recommended difficulty based on performance
    // Adjust difficulty up if >80% correct, down if <50% correct
    let recommendedDifficulty = averageDifficulty;
    if (totalQuestions >= 5) {
      const correctRate = correctAnswers / totalQuestions;
      if (correctRate > 0.8) {
        recommendedDifficulty = Math.min(10, averageDifficulty + 1);
      } else if (correctRate < 0.5) {
        recommendedDifficulty = Math.max(1, averageDifficulty - 1);
      }
    }
    
    return {
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      averageDifficulty,
      recommendedDifficulty: Math.round(recommendedDifficulty),
    };
  } catch (error) {
    console.error(`Error analyzing learning progress for session ${sessionId}:`, error);
    throw new Error('Failed to analyze learning progress');
  }
}
