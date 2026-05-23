'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { Plus, Edit, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

interface Contractor {
  id: string;
  companyName: string;
  gstNumber: string;
  complianceScore: number;
  workersCount: number;
}

const MOCK_CONTRACTORS: Contractor[] = [
  {
    id: '1',
    companyName: 'BuildCorp India',
    gstNumber: '27AACCT1234A1Z0',
    complianceScore: 95,
    workersCount: 45,
  },
  {
    id: '2',
    companyName: 'TechServices Ltd',
    gstNumber: '09AACCT5678A1Z5',
    complianceScore: 78,
    workersCount: 32,
  },
  {
    id: '3',
    companyName: 'CleanPro Solutions',
    gstNumber: '18AACCT9012A1Z3',
    complianceScore: 65,
    workersCount: 28,
  },
];

export default function ContractorsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [contractors, setContractors] = useState<Contractor[]>(MOCK_CONTRACTORS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContractor, setNewContractor] = useState({
    companyName: '',
    gstNumber: '',
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push('/auth/login');
    return null;
  }

  const handleAddContractor = (e: React.FormEvent) => {
    e.preventDefault();
    const contractor: Contractor = {
      id: `${Date.now()}`,
      ...newContractor,
      complianceScore: 100,
      workersCount: 0,
    };
    setContractors([...contractors, contractor]);
    setNewContractor({ companyName: '', gstNumber: '' });
    setShowAddForm(false);
  };

  const handleDeleteContractor = (id: string) => {
    setContractors(contractors.filter(c => c.id !== id));
  };

  const getComplianceColor = (score: number) => {
    if (score >= 85) return 'text-green-400 bg-green-500/10';
    if (score >= 70) return 'text-yellow-400 bg-yellow-500/10';
    return 'text-red-400 bg-red-500/10';
  };

  const getComplianceIcon = (score: number) => {
    return score >= 85 ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />;
  };

  return (
    <main className="min-h-screen">
      <DashboardHeader />

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Contractors</h2>
            <p className="text-zinc-400">Manage and monitor contractor compliance</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Contractor
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6 mb-8">
            <form onSubmit={handleAddContractor} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Company Name"
                  value={newContractor.companyName}
                  onChange={(e) => setNewContractor({ ...newContractor, companyName: e.target.value })}
                  required
                  className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="GST Number"
                  value={newContractor.gstNumber}
                  onChange={(e) => setNewContractor({ ...newContractor, gstNumber: e.target.value })}
                  required
                  className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Contractors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contractors.map((contractor) => (
            <div
              key={contractor.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{contractor.companyName}</h3>
                  <p className="text-xs text-zinc-400 mt-1">{contractor.gstNumber}</p>
                </div>
                <button
                  onClick={() => handleDeleteContractor(contractor.id)}
                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Workers</p>
                  <p className="text-xl font-bold text-white">{contractor.workersCount}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-zinc-400">Compliance Score</p>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded ${getComplianceColor(contractor.complianceScore)}`}>
                      {getComplianceIcon(contractor.complianceScore)}
                      <span className="text-sm font-semibold">{contractor.complianceScore}%</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        contractor.complianceScore >= 85
                          ? 'bg-green-500'
                          : contractor.complianceScore >= 70
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${contractor.complianceScore}%` }}
                    />
                  </div>
                </div>
              </div>

              <button className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center justify-center gap-2">
                <Edit className="w-4 h-4" />
                View Workers
              </button>
            </div>
          ))}
        </div>

        {contractors.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-400">No contractors yet. Click "Add Contractor" to get started.</p>
          </div>
        )}
      </div>
    </main>
  );
}
