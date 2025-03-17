import { NextRequest, NextResponse } from 'next/server';
import {
  getSecurityAlerts,
  createSecurityAlert,
  resolveSecurityAlert,
  analyzeCode,
  analyzeBehavior,
} from '@/lib/security';

// Handle GET requests to /api/security
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const resolved = searchParams.get('resolved');
    const severity = searchParams.get('severity') as 'low' | 'medium' | 'high' | 'critical' | undefined;
    
    // Build filter
    const filter: { resolved?: boolean; severity?: 'low' | 'medium' | 'high' | 'critical' } = {};
    
    if (resolved !== null) {
      filter.resolved = resolved === 'true';
    }
    
    if (severity) {
      filter.severity = severity;
    }
    
    // Get security alerts
    const alerts = await getSecurityAlerts(filter);
    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Error in security API (GET):', error);
    return NextResponse.json(
      { error: 'Failed to fetch security alerts' },
      { status: 500 }
    );
  }
}

// Handle POST requests to /api/security
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    
    switch (action) {
      case 'create_alert':
        // Create a new security alert
        const { severity, sourceType, description, rawData } = body;
        if (!severity || !sourceType || !description) {
          return NextResponse.json(
            { error: 'Severity, sourceType, and description are required' },
            { status: 400 }
          );
        }
        
        const alert = await createSecurityAlert(severity, sourceType, description, rawData);
        return NextResponse.json({ alert });
      
      case 'resolve_alert':
        // Resolve a security alert
        const { alertId } = body;
        if (!alertId) {
          return NextResponse.json(
            { error: 'Alert ID is required' },
            { status: 400 }
          );
        }
        
        const resolvedAlert = await resolveSecurityAlert(alertId);
        return NextResponse.json({ alert: resolvedAlert });
      
      case 'analyze_code':
        // Analyze code for security vulnerabilities
        const { code, language } = body;
        if (!code || !language) {
          return NextResponse.json(
            { error: 'Code and language are required' },
            { status: 400 }
          );
        }
        
        const analysis = await analyzeCode(code, language);
        return NextResponse.json({ analysis });
      
      case 'analyze_behavior':
        // Analyze behavior data for security anomalies
        const { behaviorData } = body;
        if (!behaviorData) {
          return NextResponse.json(
            { error: 'Behavior data is required' },
            { status: 400 }
          );
        }
        
        const behaviorAnalysis = await analyzeBehavior(behaviorData);
        return NextResponse.json({ analysis: behaviorAnalysis });
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in security API (POST):', error);
    return NextResponse.json(
      { error: 'Failed to process security request' },
      { status: 500 }
    );
  }
}
