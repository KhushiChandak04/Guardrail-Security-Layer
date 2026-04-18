import React from 'react';
import StatCard from '../../components/dashboard/StatCard';
import { Clock, ShieldX, Eye, CheckCircle } from 'lucide-react';
import RiskChart from '../../components/dashboard/RiskChart';
import LogTable from '../../components/dashboard/LogTable';

const Dashboard = () => {
  const stats = [
    { title: 'Prompts Today', value: '1,234', icon: <Clock className="w-8 h-8 text-blue-500" /> },
    { title: 'Blocked', value: '56', icon: <ShieldX className="w-8 h-8 text-red-500" /> },
    { title: 'PII Redacted', value: '12', icon: <Eye className="w-8 h-8 text-purple-500" /> },
    { title: 'Safe Passed', value: '1,166', icon: <CheckCircle className="w-8 h-8 text-green-500" /> },
  ];

  const metrics = [
    { title: 'Avg Latency', value: '150ms' },
    { title: 'Uptime', value: '99.9%' },
    { title: 'Active Sessions', value: '12' },
    { title: 'Attack Rate', value: '4.5%' },
  ];

  const piiData = [
    { name: 'Aadhaar', count: 4 },
    { name: 'PAN', count: 2 },
    { name: 'UPI', count: 8 },
    { name: 'GST', count: 1 },
    { name: 'Phone', count: 15 },
    { name: 'Voter ID', count: 0 },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <StatCard key={index} title={stat.title} value={stat.value} icon={stat.icon} />
        ))}
      </div>

      <div className="mt-8 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {metrics.map((metric, index) => (
            <div key={index}>
              <p className="text-sm text-gray-500 dark:text-gray-400">{metric.title}</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Attack Type Breakdown</h3>
          <RiskChart />
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Indian PII Detected</h3>
          <div className="space-y-4">
            {piiData.map((pii) => (
              <div key={pii.name} className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-300">{pii.name}</span>
                <span className="font-bold text-violet-500 text-lg">{pii.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <LogTable />
      </div>
    </div>
  );
};

export default Dashboard;
