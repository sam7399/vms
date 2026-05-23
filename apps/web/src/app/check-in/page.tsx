'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { QrCode, CheckCircle, AlertCircle } from 'lucide-react';

interface VisitFormData {
  visitorName: string;
  visitorPhone: string;
  visitorEmail: string;
  visitorCompany: string;
  purpose: string;
  hostName: string;
  vehicleNumber: string;
}

export default function CheckInPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState<VisitFormData>({
    visitorName: '',
    visitorPhone: '',
    visitorEmail: '',
    visitorCompany: '',
    purpose: '',
    hostName: '',
    vehicleNumber: '',
  });

  const [qrToken, setQrToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Mock QR token generation
      const token = `VMS_${Date.now()}_${Math.random().toString(36).substring(7)}`.toUpperCase();
      setQrToken(token);
      
      // Reset form
      setTimeout(() => {
        setFormData({
          visitorName: '',
          visitorPhone: '',
          visitorEmail: '',
          visitorCompany: '',
          purpose: '',
          hostName: '',
          vehicleNumber: '',
        });
        setQrToken(null);
      }, 3000);
    } catch (err) {
      setError('Failed to create visit');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen">
      <DashboardHeader />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Visitor Check-In</h2>
          <p className="text-zinc-400">Register a new visitor or contractor</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Visitor Name *
                </label>
                <input
                  type="text"
                  name="visitorName"
                  value={formData.visitorName}
                  onChange={handleChange}
                  required
                  placeholder="John Doe"
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    name="visitorPhone"
                    value={formData.visitorPhone}
                    onChange={handleChange}
                    required
                    placeholder="+1 234 567 8900"
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="visitorEmail"
                    value={formData.visitorEmail}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Company
                </label>
                <input
                  type="text"
                  name="visitorCompany"
                  value={formData.visitorCompany}
                  onChange={handleChange}
                  placeholder="Acme Corp"
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Purpose of Visit *
                </label>
                <textarea
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleChange}
                  required
                  placeholder="Meeting with Mr. Smith"
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Host Name *
                  </label>
                  <input
                    type="text"
                    name="hostName"
                    value={formData.hostName}
                    onChange={handleChange}
                    required
                    placeholder="John Smith"
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    name="vehicleNumber"
                    value={formData.vehicleNumber}
                    onChange={handleChange}
                    placeholder="ABC-1234"
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating visit...' : 'Generate QR Code'}
              </button>
            </form>
          </div>

          {/* QR Code Display */}
          <div className="flex flex-col gap-4">
            {qrToken ? (
              <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-8 backdrop-blur-xl flex flex-col items-center justify-center h-full">
                <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">Visit Created!</h3>
                <p className="text-zinc-400 text-center mb-6">QR Code generated successfully</p>
                
                <div className="bg-white/10 border border-white/20 rounded-xl p-6 mb-6 w-full">
                  <div className="bg-white aspect-square rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <QrCode className="w-32 h-32 text-slate-900 mx-auto" />
                      <p className="text-xs text-slate-600 mt-2 font-mono">{qrToken}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 w-full">
                  <p className="text-sm text-blue-200">
                    <strong>Token:</strong> {qrToken}
                  </p>
                  <p className="text-xs text-blue-300 mt-2">
                    This QR code can be scanned at entry points
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl h-full flex flex-col items-center justify-center">
                <AlertCircle className="w-16 h-16 text-zinc-400 mb-4" />
                <p className="text-zinc-400 text-center">
                  Fill out the form and click "Generate QR Code" to create a visit
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
