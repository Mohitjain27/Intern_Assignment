import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// Initiate Google OAuth
router.get('/google', authController.googleLogin);

// Google OAuth callback
router.get('/google/callback', authController.googleCallback);

// Get current user
router.get('/me', authenticate, authController.getMe);

// Logout
router.post('/logout', authController.logout);

// Dev login
router.post('/dev-login', authController.devLogin);

export default router;
