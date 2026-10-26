import express from 'express';
import {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  updateSettings,
  exportData,
  deleteAccount,
  getAllUsers,
  deactivateUser,
} from '../controllers/userController.js';
import { clerkLogin } from '../controllers/clerkController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { 
  validateRegister, 
  validateLogin, 
  validateChangePassword,
  validateMongoId 
} from '../middleware/validation.js';

const router = express.Router();

// Public routes (no authentication needed)
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/clerk', clerkLogin);

// Protected routes (authentication required)
router.post('/logout', authenticate, logout);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.post('/change-password', authenticate, validateChangePassword, changePassword);
router.put('/settings', authenticate, updateSettings);
router.get('/export-data', authenticate, exportData);
router.delete('/account', authenticate, deleteAccount);

// Admin routes (authorization required)
router.get('/users', authenticate, authorize('fleet_manager'), getAllUsers);
router.put('/users/:userId/deactivate', authenticate, authorize('fleet_manager'), validateMongoId('userId'), deactivateUser);

export default router;
