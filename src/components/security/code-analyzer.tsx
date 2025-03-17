"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface CodeIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  line?: number;
  recommendation?: string;
}

interface CodeAnalysisResult {
  issues: CodeIssue[];
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
}

interface CodeAnalyzerProps {
  onAnalyze?: (code: string, language: string) => Promise<CodeAnalysisResult>;
}

export function CodeAnalyzer({ onAnalyze }: CodeAnalyzerProps) {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<CodeAnalysisResult | null>(null);
  
  const handleAnalyze = async () => {
    if (!code.trim() || isAnalyzing) return;
    
    setIsAnalyzing(true);
    setResult(null);
    
    try {
      if (onAnalyze) {
        const analysisResult = await onAnalyze(code, language);
        setResult(analysisResult);
      } else {
        // Fallback mock analysis if no onAnalyze function is provided
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
        setResult({
          issues: [
            {
              severity: 'medium',
              description: 'This is a placeholder analysis. Please implement the onAnalyze function.',
              line: 1,
              recommendation: 'Implement the onAnalyze function to get real analysis.',
            },
          ],
          overallRisk: 'medium',
        });
      }
    } catch (error) {
      console.error('Error analyzing code:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Helper function to get severity badge styles
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Code Security Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Programming Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full p-2 border rounded"
              disabled={isAnalyzing}
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="csharp">C#</option>
              <option value="cpp">C/C++</option>
              <option value="php">PHP</option>
              <option value="ruby">Ruby</option>
              <option value="go">Go</option>
              <option value="swift">Swift</option>
              <option value="typescript">TypeScript</option>
              <option value="sql">SQL</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Code to Analyze</label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-48 p-2 border rounded font-mono text-sm"
              placeholder="Paste your code here to analyze for security vulnerabilities..."
              disabled={isAnalyzing}
            />
          </div>
          
          <Button
            onClick={handleAnalyze}
            disabled={!code.trim() || isAnalyzing}
            className="w-full"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Code'}
          </Button>
          
          {result && (
            <div className="mt-6">
              <div className="mb-4 p-3 border rounded flex items-start">
                <div className="mr-3">
                  <span className={`text-lg font-bold ${getSeverityColor(result.overallRisk)}`}>!</span>
                </div>
                <div>
                  <h3 className="font-medium">Overall Risk: <span className={getSeverityColor(result.overallRisk)}>{result.overallRisk.toUpperCase()}</span></h3>
                  <p className="text-sm text-gray-500">Found {result.issues.length} issue{result.issues.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              
              {result.issues.length > 0 && (
                <div className="space-y-4">
                  {result.issues.map((issue, index) => (
                    <div key={index} className="p-3 border rounded">
                      <h4 className={`font-medium ${getSeverityColor(issue.severity)}`}>
                        {issue.severity.toUpperCase()}: {issue.description}
                      </h4>
                      {issue.line && (
                        <p className="text-sm mt-1">Line: {issue.line}</p>
                      )}
                      {issue.recommendation && (
                        <div className="mt-2">
                          <p className="text-sm font-medium">Recommendation:</p>
                          <p className="text-sm text-gray-700">{issue.recommendation}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
