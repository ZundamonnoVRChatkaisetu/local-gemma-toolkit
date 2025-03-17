import { Metadata } from 'next';
import { QuestionCard } from '@/components/learning/question-card';
import { ProgressChart } from '@/components/learning/progress-chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Learning Platform | Local Gemma Toolkit',
  description: 'Privacy-focused learning platform powered by Gemma LLM',
};

export default function LearnPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Learning Platform</h1>
        <p className="text-gray-500">
          Personalized learning with complete privacy protection
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Create Learning Session</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium">Session Title</label>
                    <input 
                      type="text" 
                      className="w-full p-2 border rounded" 
                      placeholder="E.g., English Vocabulary"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium">Subject</label>
                    <input 
                      type="text" 
                      className="w-full p-2 border rounded" 
                      placeholder="E.g., English language"
                    />
                  </div>
                  <button className="px-4 py-2 bg-blue-500 text-white rounded">
                    Create Session
                  </button>
                </div>
              </CardContent>
            </Card>
            
            <QuestionCard 
              question="What is the capital of France?" 
              onAnswer={(answer) => console.log('Answer submitted:', answer)} 
            />
          </div>
        </div>
        
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="p-3 border rounded hover:bg-gray-50 cursor-pointer">
                  <h3 className="font-medium">English Vocabulary</h3>
                  <p className="text-sm text-gray-500">Last studied: 2 days ago</p>
                </div>
                <div className="p-3 border rounded hover:bg-gray-50 cursor-pointer">
                  <h3 className="font-medium">JavaScript Basics</h3>
                  <p className="text-sm text-gray-500">Last studied: 5 days ago</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <ProgressChart 
            data={{
              totalQuestions: 24,
              correctAnswers: 19,
              incorrectAnswers: 5,
              averageDifficulty: 5.7,
              recommendedDifficulty: 6,
            }}
          />
        </div>
      </div>
    </div>
  );
}
