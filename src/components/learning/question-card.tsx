"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface QuestionCardProps {
  question: string;
  onAnswer: (answer: string) => void;
  isLoading?: boolean;
}

export function QuestionCard({ question, onAnswer, isLoading = false }: QuestionCardProps) {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (answer.trim() && !submitted) {
      onAnswer(answer.trim());
      setSubmitted(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !submitted) {
      handleSubmit();
    }
  };

  return (
    <Card className={isLoading ? 'opacity-70' : ''}>
      <CardHeader>
        <CardTitle>Question</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-lg font-medium">{question}</p>
          
          <div className="pt-4">
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer here..."
              disabled={submitted || isLoading}
              className="mb-2"
            />
            
            <Button 
              onClick={handleSubmit} 
              disabled={submitted || isLoading || !answer.trim()}
              className="w-full"
            >
              Submit Answer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
