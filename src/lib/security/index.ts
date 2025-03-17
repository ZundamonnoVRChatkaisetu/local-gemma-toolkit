/**
 * Security monitoring module for the Local Gemma Toolkit
 * This handles behavior analysis, code scanning, and security alerting
 */

import prisma from '@/lib/prisma/client';
import { generateCompletion, Message } from '@/lib/gemma';

// Interface for security alerts
export interface SecurityAlertData {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  sourceType: 'behavior' | 'code' | 'system';
  description: string;
  rawData?: string;
  resolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

/**
 * Create a new security alert
 */
export async function createSecurityAlert(
  severity: 'low' | 'medium' | 'high' | 'critical',
  sourceType: 'behavior' | 'code' | 'system',
  description: string,
  rawData?: string
): Promise<SecurityAlertData> {
  try {
    const alert = await prisma.securityAlert.create({
      data: {
        severity,
        sourceType,
        description,
        rawData,
        resolved: false,
      },
    });
    
    return alert;
  } catch (error) {
    console.error('Error creating security alert:', error);
    throw new Error('Failed to create security alert');
  }
}

/**
 * Get all security alerts
 */
export async function getSecurityAlerts(
  filter?: { 
    resolved?: boolean, 
    severity?: 'low' | 'medium' | 'high' | 'critical' 
  }
): Promise<SecurityAlertData[]> {
  try {
    const where: any = {};
    
    if (filter?.resolved !== undefined) {
      where.resolved = filter.resolved;
    }
    
    if (filter?.severity) {
      where.severity = filter.severity;
    }
    
    const alerts = await prisma.securityAlert.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return alerts;
  } catch (error) {
    console.error('Error fetching security alerts:', error);
    throw new Error('Failed to fetch security alerts');
  }
}

/**
 * Resolve a security alert
 */
export async function resolveSecurityAlert(alertId: string): Promise<SecurityAlertData> {
  try {
    const alert = await prisma.securityAlert.update({
      where: { id: alertId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
      },
    });
    
    return alert;
  } catch (error) {
    console.error(`Error resolving security alert ${alertId}:`, error);
    throw new Error('Failed to resolve security alert');
  }
}

/**
 * Analyze code for security vulnerabilities
 */
export async function analyzeCode(code: string, language: string): Promise<{
  issues: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    line?: number;
    recommendation?: string;
  }[];
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
}> {
  try {
    // Create a prompt for the LLM
    const messages: Message[] = [
      {
        role: 'system',
        content: `You are a security code analysis tool. Analyze the following ${language} code for security vulnerabilities, 
        potential bugs, and bad practices. Focus on issues like SQL injection, XSS, CSRF, command injection, 
        unsafe deserialization, memory leaks, and other common security issues.
        
        For each issue found, specify:
        1. Severity (low, medium, high, critical)
        2. Description of the issue
        3. Line number (if applicable)
        4. Recommendation to fix it
        
        Also provide an overall risk assessment (low, medium, high, critical).
        
        Format your response as JSON with the following structure:
        {
          "issues": [
            {
              "severity": "severity level",
              "description": "description of the issue",
              "line": line number,
              "recommendation": "how to fix it"
            }
          ],
          "overallRisk": "overall risk level"
        }`
      },
      {
        role: 'user',
        content: `\`\`\`${language}\n${code}\n\`\`\``
      }
    ];
    
    // Get completion from the model
    const completion = await generateCompletion(messages, {
      temperature: 0.2, // Lower temperature for more consistent results
      max_tokens: 2048,
    });
    
    // Parse the completion to extract JSON
    try {
      // Try to find and parse JSON in the response
      const jsonMatch = completion.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const analysisResult = JSON.parse(jsonMatch[0]);
      
      // Validate the result structure
      if (!analysisResult.issues || !Array.isArray(analysisResult.issues) || !analysisResult.overallRisk) {
        throw new Error('Invalid analysis result structure');
      }
      
      return analysisResult;
    } catch (parseError) {
      console.error('Error parsing code analysis result:', parseError);
      
      // Return a default result if parsing fails
      return {
        issues: [
          {
            severity: 'medium',
            description: 'Failed to analyze code. Please try again with a cleaner code sample.',
            recommendation: 'Ensure the code is properly formatted and try again.',
          },
        ],
        overallRisk: 'medium',
      };
    }
  } catch (error) {
    console.error('Error analyzing code:', error);
    throw new Error('Failed to analyze code');
  }
}

/**
 * Analyze system behavior data for security anomalies
 */
export async function analyzeBehavior(behaviorData: Record<string, any>): Promise<{
  anomalies: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    metric: string;
    value: any;
    threshold?: any;
  }[];
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
}> {
  try {
    // Convert behavior data to a string for the LLM
    const behaviorDataStr = JSON.stringify(behaviorData, null, 2);
    
    // Create a prompt for the LLM
    const messages: Message[] = [
      {
        role: 'system',
        content: `You are a security behavior analysis tool. Analyze the following system behavior data for security anomalies, 
        unusual patterns, and potential indicators of compromise. Focus on issues like unusual network connections, 
        unexpected process behavior, suspicious file operations, and other security-relevant behavior.
        
        For each anomaly found, specify:
        1. Severity (low, medium, high, critical)
        2. Description of the anomaly
        3. The specific metric that triggered the alert
        4. The value that was considered anomalous
        5. The threshold or expected value, if applicable
        
        Also provide an overall risk assessment (low, medium, high, critical).
        
        Format your response as JSON with the following structure:
        {
          "anomalies": [
            {
              "severity": "severity level",
              "description": "description of the anomaly",
              "metric": "metric name",
              "value": the value,
              "threshold": the threshold value
            }
          ],
          "overallRisk": "overall risk level"
        }`
      },
      {
        role: 'user',
        content: behaviorDataStr
      }
    ];
    
    // Get completion from the model
    const completion = await generateCompletion(messages, {
      temperature: 0.2, // Lower temperature for more consistent results
      max_tokens: 2048,
    });
    
    // Parse the completion to extract JSON
    try {
      // Try to find and parse JSON in the response
      const jsonMatch = completion.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const analysisResult = JSON.parse(jsonMatch[0]);
      
      // Validate the result structure
      if (!analysisResult.anomalies || !Array.isArray(analysisResult.anomalies) || !analysisResult.overallRisk) {
        throw new Error('Invalid analysis result structure');
      }
      
      return analysisResult;
    } catch (parseError) {
      console.error('Error parsing behavior analysis result:', parseError);
      
      // Return a default result if parsing fails
      return {
        anomalies: [
          {
            severity: 'medium',
            description: 'Failed to analyze behavior data. Please try again with more detailed data.',
            metric: 'analysis_error',
            value: 'parse_failure',
          },
        ],
        overallRisk: 'medium',
      };
    }
  } catch (error) {
    console.error('Error analyzing behavior:', error);
    throw new Error('Failed to analyze behavior');
  }
}

/**
 * Start monitoring system behavior in the background
 * This is a placeholder implementation
 */
export function startBehaviorMonitoring(): void {
  console.log('Starting behavior monitoring...');
  // In a real implementation, this would set up event listeners or start a background process
  // For now, it's just a placeholder
}

/**
 * Stop monitoring system behavior
 * This is a placeholder implementation
 */
export function stopBehaviorMonitoring(): void {
  console.log('Stopping behavior monitoring...');
  // In a real implementation, this would clean up event listeners or stop a background process
  // For now, it's just a placeholder
}
