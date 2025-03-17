import { Metadata } from 'next';
import { AlertList } from '@/components/security/alert-list';
import { CodeAnalyzer } from '@/components/security/code-analyzer';

export const metadata: Metadata = {
  title: 'Security | Local Gemma Toolkit',
  description: 'AI-driven security monitoring and analysis',
};

export default function SecurityPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Security Management</h1>
        <p className="text-gray-500">
          AI-driven security monitoring and analysis with Gemma
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center">
          <div className="h-12 w-12 bg-red-500 text-white rounded-full flex items-center justify-center text-xl mr-4">
            !
          </div>
          <div>
            <h2 className="text-xl font-semibold">Critical Alerts</h2>
            <p className="text-red-800">0 active</p>
          </div>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 flex items-center">
          <div className="h-12 w-12 bg-yellow-500 text-white rounded-full flex items-center justify-center text-xl mr-4">
            ⚠️
          </div>
          <div>
            <h2 className="text-xl font-semibold">Warnings</h2>
            <p className="text-yellow-800">2 active</p>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 flex items-center">
          <div className="h-12 w-12 bg-blue-500 text-white rounded-full flex items-center justify-center text-xl mr-4">
            🔍
          </div>
          <div>
            <h2 className="text-xl font-semibold">Monitoring Status</h2>
            <p className="text-blue-800">Active</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <AlertList 
            alerts={[
              {
                id: '1',
                severity: 'medium',
                sourceType: 'behavior',
                description: 'Unusual network connection pattern detected',
                resolved: false,
                createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
              },
              {
                id: '2',
                severity: 'medium',
                sourceType: 'code',
                description: 'Potential SQL injection vulnerability in code',
                resolved: false,
                createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
              },
              {
                id: '3',
                severity: 'low',
                sourceType: 'system',
                description: 'High CPU usage detected',
                resolved: true,
                createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
                resolvedAt: new Date(Date.now() - 23 * 60 * 60 * 1000), // 23 hours ago
              },
            ]}
          />
        </div>
        
        <div className="lg:col-span-2">
          <CodeAnalyzer />
        </div>
      </div>
    </div>
  );
}
