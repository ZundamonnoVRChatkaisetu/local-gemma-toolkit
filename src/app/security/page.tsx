import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security | Local Gemma Toolkit',
  description: 'AI-driven security monitoring and analysis',
};

export default function SecurityPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="p-4 border-b">
        <h1 className="text-2xl font-bold">Security Management</h1>
        <p className="text-sm text-gray-500">
          AI-driven security monitoring and analysis with Gemma
        </p>
      </header>
      
      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-6xl mx-auto">
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
          
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-2/3">
              <div className="border rounded-lg p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Security Alerts</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 px-4 text-left">Severity</th>
                        <th className="py-2 px-4 text-left">Source</th>
                        <th className="py-2 px-4 text-left">Description</th>
                        <th className="py-2 px-4 text-left">Time</th>
                        <th className="py-2 px-4 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2 px-4">
                          <span className="inline-block bg-yellow-100 text-yellow-800 rounded px-2 py-1 text-xs">Medium</span>
                        </td>
                        <td className="py-2 px-4">Behavior</td>
                        <td className="py-2 px-4">Unusual network connection pattern detected</td>
                        <td className="py-2 px-4">2 hours ago</td>
                        <td className="py-2 px-4">
                          <span className="inline-block bg-red-100 text-red-800 rounded px-2 py-1 text-xs">Active</span>
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4">
                          <span className="inline-block bg-yellow-100 text-yellow-800 rounded px-2 py-1 text-xs">Medium</span>
                        </td>
                        <td className="py-2 px-4">Code</td>
                        <td className="py-2 px-4">Potential SQL injection vulnerability in code</td>
                        <td className="py-2 px-4">3 hours ago</td>
                        <td className="py-2 px-4">
                          <span className="inline-block bg-red-100 text-red-800 rounded px-2 py-1 text-xs">Active</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4">
                          <span className="inline-block bg-blue-100 text-blue-800 rounded px-2 py-1 text-xs">Low</span>
                        </td>
                        <td className="py-2 px-4">System</td>
                        <td className="py-2 px-4">High CPU usage detected</td>
                        <td className="py-2 px-4">1 day ago</td>
                        <td className="py-2 px-4">
                          <span className="inline-block bg-green-100 text-green-800 rounded px-2 py-1 text-xs">Resolved</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Code Analysis</h2>
                <div className="mb-4">
                  <select className="w-full p-2 border rounded mb-2">
                    <option>JavaScript</option>
                    <option>Python</option>
                    <option>Java</option>
                    <option>C/C++</option>
                    <option>Other</option>
                  </select>
                  <textarea 
                    className="w-full h-32 p-2 border rounded font-mono"
                    placeholder="Paste code here for security analysis..."
                  ></textarea>
                </div>
                <button className="px-4 py-2 bg-blue-500 text-white rounded">
                  Analyze Code
                </button>
              </div>
            </div>
            
            <div className="lg:w-1/3">
              <div className="border rounded-lg p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">System Status</h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">CPU Usage</span>
                      <span className="text-sm font-medium">45%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Memory Usage</span>
                      <span className="text-sm font-medium">62%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '62%' }}></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Disk Usage</span>
                      <span className="text-sm font-medium">28%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '28%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Monitoring Options</h2>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input type="checkbox" className="mr-2" checked disabled />
                    <label>Behavior Analysis</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" className="mr-2" checked disabled />
                    <label>Code Scanning</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" className="mr-2" checked disabled />
                    <label>Network Monitoring</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" className="mr-2" disabled />
                    <label>Real-time Protection</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
