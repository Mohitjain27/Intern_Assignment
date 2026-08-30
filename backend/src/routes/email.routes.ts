import { Router } from 'express';
import multer from 'multer';
import * as emailController from '../controllers/email.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// All routes require authentication
router.use(authenticate);

// CSV upload (5MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'text/plain' ||
      file.originalname.endsWith('.csv') ||
      file.originalname.endsWith('.txt')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and TXT files are allowed'));
    }
  },
});

// Upload recipients
router.post('/upload/recipients', upload.single('file'), emailController.uploadRecipients);

// Schedule email campaign
router.post('/schedule', emailController.scheduleEmail);

// Campaigns
router.get('/campaigns', emailController.getCampaigns);
router.get('/campaigns/:id', emailController.getCampaignById);

// Email lists
router.get('/scheduled', emailController.getScheduledEmails);
router.get('/sent', emailController.getSentEmails);
router.get('/search', emailController.searchEmailsHandler);

// Single email
router.get('/:id', emailController.getEmailById);
router.delete('/:id', emailController.cancelEmail);

export default router;
