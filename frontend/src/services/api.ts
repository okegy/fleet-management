import axios from 'axios';

// Base API configuration
const env = (import.meta as any).env;
const API_URL = env.VITE_API_URL || 'http://localhost:5000/api';
// An explicitly empty VITE_SOCKET_URL means "same origin": in production the
// backend serves the app and the socket, so no cross-origin host is needed.
const socketEnv = env.VITE_SOCKET_URL;
export const SOCKET_URL =
  socketEnv === undefined ? 'http://localhost:5000' : socketEnv || window.location.origin;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // ✅ SECURITY FIX: Enable credentials to automatically send/receive HTTPOnly cookies
  withCredentials: true,
});

// Add a response interceptor to handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Avoid a reload loop: the auth check on mount is expected to 401 when
    // signed out, and we are already on /login.
    const isAuthCheck = (error.config?.url || '').includes('/auth/profile');
    if (error.response?.status === 401 && !isAuthCheck && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const fleetService = {
  // ===== AUTH =====
  login: (credentials: any) => api.post('/auth/login', credentials),
  clerkLogin: (token: string) => api.post('/auth/clerk', { token }),
  register: (data: any) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
  changePassword: (data: any) => api.post('/auth/change-password', data),
  updateSettings: (data: any) => api.put('/auth/settings', data),
  exportData: () => api.get('/auth/export-data'),
  deleteAccount: () => api.delete('/auth/account'),
  getAllUsers: () => api.get('/auth/users'),
  deactivateUser: (userId: string) => api.put(`/auth/users/${userId}/deactivate`),

  // ===== VEHICLES =====
  getVehicles: (params?: any) => api.get('/vehicles', { params }),
  getVehicle: (id: string) => api.get(`/vehicles/${id}`),
  createVehicle: (data: any) => api.post('/vehicles', data),
  updateVehicle: (id: string, data: any) => api.put(`/vehicles/${id}`, data),
  deleteVehicle: (id: string) => api.delete(`/vehicles/${id}`),
  retireVehicle: (id: string) => api.put(`/vehicles/${id}/retire`),
  getVehicleStats: () => api.get('/vehicles/stats'),

  // ===== DRIVERS =====
  getDrivers: (params?: any) => api.get('/drivers', { params }),
  getDriver: (id: string) => api.get(`/drivers/${id}`),
  createDriver: (data: any) => api.post('/drivers', data),
  updateDriver: (id: string, data: any) => api.put(`/drivers/${id}`, data),
  updateDriverTrips: (id: string, data: any) => api.put(`/drivers/${id}/trips`, data),
  checkLicenseValidity: (id: string) => api.get(`/drivers/${id}/license-validity`),
  getExpiringLicenses: (days?: number) => api.get('/drivers/expiring/list', { params: { days } }),
  deleteDriver: (id: string) => api.delete(`/drivers/${id}`),
  getDriverStats: () => api.get('/drivers/stats'),

  // ===== TRIPS =====
  getTrips: (params?: any) => api.get('/trips', { params }),
  getTrip: (id: string) => api.get(`/trips/${id}`),
  createTrip: (data: any) => api.post('/trips', data),
  dispatchTrip: (id: string) => api.put(`/trips/${id}/dispatch`),
  completeTrip: (id: string, data: any) => api.put(`/trips/${id}/complete`, data),
  cancelTrip: (id: string) => api.put(`/trips/${id}/cancel`),
  getTripHistory: (params?: any) => api.get('/trips/history', { params }),
  getTripStats: () => api.get('/trips/stats'),
  updateTrip: (id: string, data: any) => api.put(`/trips/${id}`, data),
  updateTripLocation: (id: string, location: { lat: number, lng: number, address?: string }) => 
    api.post(`/trips/${id}/location`, location),
  deleteTrip: (id: string) => api.delete(`/trips/${id}`),

  // ===== MAINTENANCE =====
  getMaintenanceLogs: (params?: any) => api.get('/maintenance', { params }),
  getMaintenanceLog: (id: string) => api.get(`/maintenance/${id}`),
  createMaintenanceLog: (data: any) => api.post('/maintenance', data),
  updateMaintenanceLog: (id: string, data: any) => api.put(`/maintenance/${id}`, data),
  completeMaintenanceLog: (id: string, data?: any) => api.put(`/maintenance/${id}/complete`, data),
  deleteMaintenanceLog: (id: string) => api.delete(`/maintenance/${id}`),
  getMaintenanceAlerts: () => api.get('/maintenance/alerts'),
  getMaintenanceHistory: (params?: any) => api.get('/maintenance/history', { params }),

  // ===== EXPENSES =====
  getFuelExpenses: (params?: any) => api.get('/expenses', { params }),
  getFuelExpense: (id: string) => api.get(`/expenses/${id}`),
  createFuelExpense: (data: any) => api.post('/expenses', data),
  updateFuelExpense: (id: string, data: any) => api.put(`/expenses/${id}`, data),
  deleteFuelExpense: (id: string) => api.delete(`/expenses/${id}`),
  getVehicleExpenseSummary: (params?: any) => api.get('/expenses/summary/vehicle', { params }),
  getFleetExpenseSummary: (params?: any) => api.get('/expenses/summary/fleet', { params }),

  // ===== ANALYTICS =====
  getDashboardMetrics: (params?: any) => api.get('/analytics/dashboard', { params }),
  getVehicleAnalytics: (vehicleId: string, month?: string) =>
    api.get(`/analytics/vehicles/${vehicleId}`, { params: { month } }),
  getFleetAnalytics: (params?: any) => api.get('/analytics/fleet', { params }),
  getDriverPerformance: () => api.get('/analytics/drivers/performance'),
  getExpenseTrends: (months?: number) => api.get('/analytics/trends/expenses', { params: { months } }),
  getPersonalStats: () => api.get('/analytics/personal'),
};

export default api;
