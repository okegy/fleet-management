import React, { useState, useEffect } from 'react';
import { Wrench, AlertCircle, Plus, Filter, Search, Truck, Calendar, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { fleetService } from '../services/api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles: any = {
    'scheduled': 'bg-blue-50 text-blue-700 border-blue-100',
    'in_progress': 'bg-amber-50 text-amber-700 border-amber-100',
    'completed': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  };

  const displayStatus = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');

  return (
    <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium border", styles[status] || 'bg-slate-50 text-slate-600 border-slate-100')}>
      {displayStatus}
    </span>
  );
};

const MaintenanceModal = ({ isOpen, onClose, onSuccess, log = null }: any) => {
  const [formData, setFormData] = useState({
    vehicleId: '',
    serviceType: 'oil_change',
    description: '',
    cost: '',
    status: 'in_progress',
    startDate: new Date().toISOString().split('T')[0],
  });
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (log) {
      setFormData({
        vehicleId: log.vehicleId?._id || log.vehicleId || '',
        serviceType: log.type || log.serviceType || 'oil_change',
        description: log.description || '',
        cost: log.cost?.toString() || '',
        status: log.status || 'in_progress',
        startDate: log.date ? new Date(log.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      });
    } else {
      setFormData({
        vehicleId: '',
        serviceType: 'oil_change',
        description: '',
        cost: '',
        status: 'in_progress',
        startDate: new Date().toISOString().split('T')[0],
      });
    }
  }, [log, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchVehicles();
    }
  }, [isOpen]);

  const fetchVehicles = async () => {
    try {
      const response = await fleetService.getVehicles();
      setVehicles(response.data.vehicles || response.data || []);
    } catch (err) {
      console.error('Error fetching vehicles:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!formData.vehicleId) newErrors.vehicleId = 'Vehicle is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.cost || isNaN(Number(formData.cost)) || Number(formData.cost) < 0) newErrors.cost = 'Valid cost is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        vehicleId: formData.vehicleId,
        serviceType: formData.serviceType,
        description: formData.description,
        cost: Number(formData.cost),
        status: formData.status,
        startDate: formData.startDate,
      };

      if (log) {
        await fleetService.updateMaintenanceLog(log._id, payload);
        toast.success('Maintenance log updated successfully!');
      } else {
        await fleetService.createMaintenanceLog(payload);
        toast.success('Service scheduled successfully!');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save record');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{log ? 'Edit Maintenance' : 'Schedule Service'}</h2>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">Service Log Details</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">Vehicle *</label>
              <select
                name="vehicleId"
                value={formData.vehicleId}
                onChange={handleChange}
                className={cn(
                  "w-full px-3 py-2 rounded-xl border text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none bg-white",
                  errors.vehicleId ? "border-rose-500 bg-rose-50/50" : "border-slate-200"
                )}
              >
                <option value="">Select Vehicle</option>
                {vehicles.map(v => (
                  <option key={v._id} value={v._id}>{v.name} ({v.licenseplate || v.licensePlate || 'N/A'})</option>
                ))}
              </select>
              {errors.vehicleId && <p className="text-[10px] text-rose-500 font-medium">{errors.vehicleId}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">Service Type</label>
              <select
                name="serviceType"
                value={formData.serviceType}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border text-sm border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none bg-white"
              >
                <option value="oil_change">Oil Change</option>
                <option value="repair">Repair</option>
                <option value="inspection">Inspection</option>
                <option value="tire_replacement">Tire Replacement</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border text-sm border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none bg-white"
              >
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">Cost ($) *</label>
              <input
                type="number"
                name="cost"
                value={formData.cost}
                onChange={handleChange}
                placeholder="250"
                className={cn(
                  "w-full px-3 py-2 rounded-xl border text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all",
                  errors.cost ? "border-rose-500 bg-rose-50/50" : "border-slate-200"
                )}
              />
              {errors.cost && <p className="text-[10px] text-rose-500 font-medium">{errors.cost}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">Start Date *</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className={cn(
                  "w-full px-3 py-2 rounded-xl border text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all",
                  errors.startDate ? "border-rose-500 bg-rose-50/50" : "border-slate-200"
                )}
              />
              {errors.startDate && <p className="text-[10px] text-rose-500 font-medium">{errors.startDate}</p>}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Details of the service..."
                rows={2}
                className={cn(
                  "w-full px-3 py-2 rounded-xl border text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all resize-none",
                  errors.description ? "border-rose-500 bg-rose-50/50" : "border-slate-200"
                )}
              />
              {errors.description && <p className="text-[10px] text-rose-500 font-medium">{errors.description}</p>}
            </div>
          </div>

          <div className="mt-6 flex gap-3 sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 sm:flex-none px-8 py-2.5 text-sm font-bold text-white bg-primary rounded-xl hover:opacity-90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : (log ? 'Update Record' : 'Schedule Service')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default function Maintenance() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null
  });
  const { user } = useAuth();
  const location = useLocation();

  const isFleetManager = user?.role === 'fleet_manager';
  const isFinancialAnalyst = user?.role === 'financial_analyst';

  const fetchMaintenance = async () => {
    setIsLoading(true);
    try {
      const response = await fleetService.getMaintenanceLogs();
      setLogs(response.data.logs || response.data || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load maintenance logs');
      console.error('Error fetching maintenance:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fleetService.deleteMaintenanceLog(id);
      toast.success('Maintenance record deleted successfully');
      fetchMaintenance();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete record');
    }
  };

  useEffect(() => {
    fetchMaintenance();
  }, []);

  useEffect(() => {
    if (location.state?.openModal) {
      setIsModalOpen(true);
      // Clean up state after opening modal
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Calculate health overview from logs
  const healthOverview = {
    healthy: logs.filter(log => log.status === 'completed').length,
    warning: logs.filter(log => log.status === 'scheduled').length,
    critical: logs.filter(log => log.status === 'in_progress').length,
  };

  const totalLogs = Object.values(healthOverview).reduce((a, b) => a + b, 0);
  const healthStats = totalLogs > 0 ? [
    { label: 'Healthy', count: healthOverview.healthy, color: 'bg-emerald-500', percent: (healthOverview.healthy / totalLogs * 100) },
    { label: 'Warning', count: healthOverview.warning, color: 'bg-amber-500', percent: (healthOverview.warning / totalLogs * 100) },
    { label: 'Critical', count: healthOverview.critical, color: 'bg-rose-500', percent: (healthOverview.critical / totalLogs * 100) },
  ] : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Maintenance</h1>
          <p className="text-slate-500 mt-1">Schedule service and track fleet health.</p>
        </div>
        {isFleetManager && (
          <button
            onClick={() => {
              setSelectedLog(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-xl hover:opacity-90 transition-opacity shadow-md">
            <Plus size={16} />
            Schedule Service
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Maintenance Logs</h3>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                    <Filter size={18} />
                  </button>
                  <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                    <Search size={18} />
                  </button>
                </div>
              </div>
              <div className="hidden md:block overflow-x-auto">
                {logs.length > 0 ? (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Vehicle</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Service Type</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Cost</th>
                        {isFinancialAnalyst && <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Budget Impact</th>}
                        {isFleetManager && <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map((log) => (
                        <tr key={log._id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Truck size={16} className="text-slate-400" />
                              <span className="text-sm font-medium text-slate-700">{log.vehicleId?.name || 'Unknown Vehicle'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-600">{log.type || log.serviceType}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Calendar size={14} className="text-slate-400" />
                              {new Date(log.startDate || log.date).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={log.status} />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-bold text-slate-900">${log.cost || 0}</span>
                          </td>
                          {isFinancialAnalyst && (
                            <td className="px-6 py-4 text-right">
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-1 rounded-lg",
                                log.cost > 500 ? "text-rose-700 bg-rose-50" : "text-emerald-700 bg-emerald-50"
                              )}>
                                {log.cost > 500 ? 'HIGH IMPACT' : 'OPTIMAL'}
                              </span>
                            </td>
                          )}
                          {isFleetManager && (
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => {
                                    setSelectedLog(log);
                                    setIsModalOpen(true);
                                  }}
                                  className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-all"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => setDeleteConfirm({ isOpen: true, id: log._id })}
                                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    <p>No maintenance logs found</p>
                  </div>
                )}
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-slate-100">
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <div key={log._id} className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                            <Truck size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{log.vehicleId?.name || 'Unknown Vehicle'}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{log.type || log.serviceType}</p>
                          </div>
                        </div>
                        <StatusBadge status={log.status} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Service Date</p>
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Calendar size={12} className="text-slate-400" />
                            {new Date(log.date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Service Cost</p>
                          <p className="text-sm font-black text-slate-900">${log.cost || 0}</p>
                        </div>
                        {isFinancialAnalyst && (
                          <div className="col-span-2 space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Budget Analysis</p>
                            <span className={cn(
                              "inline-block text-[10px] font-black px-2 py-0.5 rounded-lg",
                              log.cost > 500 ? "text-rose-700 bg-rose-50" : "text-emerald-700 bg-emerald-50"
                            )}>
                              {log.cost > 500 ? 'HIGH FISCAL IMPACT' : 'OPTIMAL MAINTENANCE COST'}
                            </span>
                          </div>
                        )}
                      </div>

                      {isFleetManager && (
                        <div className="flex gap-2 pt-2">
                          <button 
                            onClick={() => {
                              setSelectedLog(log);
                              setIsModalOpen(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
                          >
                            <Edit2 size={14} />
                            Edit
                          </button>
                          <button 
                            onClick={() => setDeleteConfirm({ isOpen: true, id: log._id })}
                            className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold text-rose-600 bg-rose-50 rounded-xl"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    <p>No maintenance logs found</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Health Overview</h3>
              <div className="space-y-4">
                {healthStats.map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-600">{item.label}</span>
                      <span className="font-bold text-slate-900">{item.count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", item.color)}
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {logs.length > 0 && logs.some(log => log.status === 'in_progress') && (
              <div className="bg-rose-50 rounded-2xl border border-rose-100 p-6">
                <div className="flex items-center gap-3 text-rose-700 mb-4">
                  <AlertCircle size={20} />
                  <h3 className="font-bold">In Progress Services</h3>
                </div>
                <div className="space-y-3">
                  {logs.filter(log => log.status === 'in_progress').slice(0, 2).map((log) => (
                    <div key={log._id} className="bg-white/60 rounded-xl p-3 border border-rose-200">
                      <p className="text-sm font-bold text-rose-900">{log.type || log.serviceType}</p>
                      <p className="text-xs text-rose-700 mt-0.5">Vehicle {log.vehicleId?.name || 'Unknown'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <MaintenanceModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedLog(null);
        }}
        onSuccess={fetchMaintenance}
        log={selectedLog}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={() => deleteConfirm.id && handleDelete(deleteConfirm.id)}
        title="Delete Record"
        message="Are you sure you want to delete this maintenance record? This action cannot be undone."
        confirmText="Delete Record"
        type="danger"
      />
    </motion.div>
  );
}
