"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface ProgressData {
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  averageDifficulty: number;
  recommendedDifficulty: number;
}

interface ProgressChartProps {
  data: ProgressData;
}

export function ProgressChart({ data }: ProgressChartProps) {
  // Calculate percentages for the chart
  const correctPercentage = data.totalQuestions > 0 
    ? (data.correctAnswers / data.totalQuestions) * 100 
    : 0;
  
  const incorrectPercentage = data.totalQuestions > 0 
    ? (data.incorrectAnswers / data.totalQuestions) * 100 
    : 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Learning Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold">{data.totalQuestions}</p>
              <p className="text-sm text-gray-500">Total Questions</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold">{data.correctAnswers}</p>
              <p className="text-sm text-gray-500">Correct Answers</p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Accuracy: {correctPercentage.toFixed(1)}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-green-600 h-2.5 rounded-full" 
                style={{ width: `${correctPercentage}%` }}
              ></div>
            </div>
          </div>
          
          {/* Difficulty indicators */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <p className="text-sm">Average Difficulty</p>
              <p className="text-sm font-medium">{data.averageDifficulty.toFixed(1)}/10</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${(data.averageDifficulty / 10) * 100}%` }}
              ></div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <p className="text-sm">Recommended Difficulty</p>
              <p className="text-sm font-medium">{data.recommendedDifficulty}/10</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-purple-600 h-2.5 rounded-full" 
                style={{ width: `${(data.recommendedDifficulty / 10) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
