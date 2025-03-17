"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SecurityAlertData } from '@/lib/security';

interface AlertListProps {
  alerts: SecurityAlertData[];
  onResolve?: (alertId: string) => void;
  isLoading?: boolean;
}

export function AlertList({ alerts, onResolve, isLoading = false }: AlertListProps) {
  // Helper function to format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    return 'Just now';
  };
  
  // Helper function to get severity badge styles
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="animate-pulse border-b last:border-b-0 pb-4 last:pb-0">
                <div className="h-5 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : alerts.length > 0 ? (
          <div className="divide-y">
            {alerts.map((alert) => (
              <div key={alert.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className={`inline-block rounded px-2 py-1 text-xs ${getSeverityBadge(alert.severity)}`}>
                      {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">{formatRelativeTime(alert.createdAt)}</span>
                  </div>
                  
                  {!alert.resolved && onResolve && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onResolve(alert.id)}
                      className="text-xs h-7"
                    >
                      Resolve
                    </Button>
                  )}
                </div>
                
                <p className="font-medium mb-1">{alert.description}</p>
                <p className="text-sm text-gray-500">Source: {alert.sourceType}</p>
                
                {alert.resolved && alert.resolvedAt && (
                  <p className="text-xs text-green-600 mt-2">
                    Resolved {formatRelativeTime(alert.resolvedAt)}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-6">
            No security alerts found. Your system appears to be secure.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
