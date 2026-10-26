import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Truck, Mail, Lock, ArrowLeft, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { fleetService } from '../services/api';
import ClerkSocialButtons from '../components/ClerkSocialButtons';
import toast from 'react-hot-toast';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fleetService.login({ email, password });
      // ✅ SECURITY FIX: Token is now in HTTPOnly cookie (sent automatically by browser)
      // Backend no longer returns token in response, only user data
      const { user } = response.data;
      login(user);
      toast.success('Access Granted. Welcome back.');
      navigate('/app');
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.error || 'Authentication declined.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-50 p-6 overflow-hidden">
      {/* Light Mesh Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-72 h-72 lg:w-[500px] lg:h-[500px] bg-emerald-100/40 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-72 h-72 lg:w-[500px] lg:h-[500px] bg-emerald-50/60 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl w-full mx-auto relative z-10">
        <Link to="/" className="fixed top-8 left-8 hidden lg:flex items-center gap-3 text-slate-400 hover:text-emerald-600 transition-all font-black uppercase tracking-widest text-xs">
          <ArrowLeft size={16} />
          Back to Portal
        </Link>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto"
        >
          {/* Header Branding */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500 rounded-[2rem] shadow-2xl shadow-emerald-500/20 mb-8 border-4 border-white">
              <Truck className="text-white" size={40} />
            </div>
            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter mb-4 italic">
              Fleet<span className="text-emerald-500 not-italic">Flow.</span>
            </h1>
            <p className="text-slate-500 font-medium tracking-tight">Enterprise Logistics Management</p>
          </div>

          {/* Login Card - Premium Light */}
          <div className="bg-white/70 backdrop-blur-xl p-8 lg:p-12 rounded-[3.5rem] border border-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] space-y-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fleet ID / Email</label>
                <div className="relative group">
                  <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                  <input 
                    type="email" 
                    required
                    placeholder="operator@system.pro"
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] px-14 py-4.5 text-slate-900 focus:border-emerald-500 focus:bg-white transition-all outline-none font-bold placeholder:text-slate-300"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Pin / Pass</label>
                  <Link to="#" className="text-[10px] font-black text-emerald-500 hover:text-emerald-600 uppercase tracking-widest transition-colors">Forgot?</Link>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                  <input 
                    type="password" 
                    required
                    placeholder="••••••••••••"
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] px-14 py-4.5 text-slate-900 focus:border-emerald-500 focus:bg-white transition-all outline-none font-bold placeholder:text-slate-300"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-500 text-white rounded-[1.5rem] py-5 font-black flex items-center justify-center gap-3 hover:bg-emerald-600 hover:shadow-2xl hover:shadow-emerald-500/30 transition-all disabled:opacity-50 uppercase tracking-widest text-sm"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Initialize Portal
                    <ShieldCheck size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                <span className="bg-white px-6">Third-Party Federation</span>
              </div>
            </div>

            <ClerkSocialButtons />
          </div>

          <p className="text-center text-sm text-slate-400 mt-12 font-bold tracking-tight">
            Need an operational ID? 
            <Link to="/register" className="text-emerald-500 font-black ml-2 hover:text-emerald-600 underline underline-offset-4 decoration-2">Request Access</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
