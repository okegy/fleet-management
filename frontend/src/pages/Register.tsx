import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Truck, Mail, Lock, User, Phone, Briefcase, ArrowLeft, KeyRound } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { fleetService } from '../services/api';
import ClerkSocialButtons from '../components/ClerkSocialButtons';
import toast from 'react-hot-toast';

const ROLES = [
  { value: 'fleet_manager', label: 'Fleet Manager' },
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'safety_officer', label: 'Safety Officer' },
  { value: 'financial_analyst', label: 'Financial Analyst' },
];

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'dispatcher',
    phone: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fleetService.register(formData);
      // ✅ SECURITY FIX: Token is now in HTTPOnly cookie (sent automatically by browser)
      // Backend no longer returns token in response, only user data
      const { user } = response.data;
      login(user);
      toast.success('Identity Created. Onboarding complete.');
      navigate('/app');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.error || 'Identity creation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-50 p-6 overflow-hidden py-16 lg:py-24">
      {/* Light Mesh Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-72 h-72 lg:w-[600px] lg:h-[600px] bg-emerald-100/30 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 lg:w-[600px] lg:h-[600px] bg-emerald-50/50 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl w-full mx-auto relative z-10">
        <Link to="/" className="fixed top-8 left-8 hidden lg:flex items-center gap-3 text-slate-400 hover:text-emerald-600 transition-all font-black uppercase tracking-widest text-xs">
          <ArrowLeft size={16} />
          Back to Portal
        </Link>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          {/* Header Branding */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500 rounded-[2rem] shadow-2xl shadow-emerald-500/20 mb-8 border-4 border-white">
              <Truck className="text-white" size={40} />
            </div>
            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter mb-4 italic">
              Join <span className="text-emerald-500 not-italic">FleetFlow.</span>
            </h1>
            <p className="text-slate-500 font-medium tracking-tight">Request access to the intelligence network</p>
          </div>

          {/* Register Card - Premium Light */}
          <div className="bg-white/70 backdrop-blur-xl p-8 lg:p-12 rounded-[3.5rem] border border-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] space-y-10">
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Identifier</label>
                  <div className="relative group">
                    <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                    <input 
                      type="text" 
                      name="name"
                      required
                      placeholder="Your Full Name"
                      className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] px-14 py-4 text-slate-900 focus:border-emerald-500 focus:bg-white transition-all outline-none font-bold placeholder:text-slate-300"
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Operational Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                    <input 
                      type="email" 
                      name="email"
                      required
                      placeholder="operator@system.pro"
                      className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] px-14 py-4 text-slate-900 focus:border-emerald-500 focus:bg-white transition-all outline-none font-bold placeholder:text-slate-300"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Security Key</label>
                  <div className="relative group">
                    <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                    <input 
                      type="password" 
                      name="password"
                      required
                      minLength={6}
                      placeholder="Choose a password"
                      className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] px-14 py-4 text-slate-900 focus:border-emerald-500 focus:bg-white transition-all outline-none font-bold placeholder:text-slate-300"
                      value={formData.password}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Line</label>
                  <div className="relative group">
                    <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                    <input 
                      type="tel" 
                      name="phone"
                      placeholder="+1 Operations"
                      className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] px-14 py-4 text-slate-900 focus:border-emerald-500 focus:bg-white transition-all outline-none font-bold placeholder:text-slate-300"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Designated Role</label>
                <div className="relative group">
                  <Briefcase className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                  <select 
                    name="role"
                    required
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] px-14 py-4 text-slate-900 focus:border-emerald-500 focus:bg-white transition-all outline-none font-bold appearance-none cursor-pointer placeholder:text-slate-300"
                    value={formData.role}
                    onChange={handleChange}
                  >
                    {ROLES.map(role => (
                      <option key={role.value} value={role.value} className="bg-white text-slate-900 font-bold">{role.label}</option>
                    ))}
                  </select>
                </div>
              </div>


              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-500 text-white rounded-[1.5rem] py-5 font-black flex items-center justify-center gap-3 hover:bg-emerald-600 hover:shadow-2xl hover:shadow-emerald-500/30 transition-all disabled:opacity-50 uppercase tracking-widest text-sm translate-y-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Initialize Identity
                    <KeyRound size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                <span className="bg-white px-6">System Synchronization</span>
              </div>
            </div>

            <ClerkSocialButtons />
          </div>

          <p className="text-center text-sm text-slate-400 mt-12 font-bold tracking-tight">
            Identifier exists? 
            <Link to="/login" className="text-emerald-500 font-black ml-2 hover:text-emerald-600 underline underline-offset-4 decoration-2">Identity Login</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
