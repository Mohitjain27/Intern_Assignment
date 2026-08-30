import { Router } from 'express';
import * as slackController from '../controllers/slack.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// OAuth callback doesn't need auth (Slack redirects here)
router.get('/callback', slackController.slackCallback);

// Protected routes
router.use(authenticate);

router.get('/status', slackController.getSlackStatus);
router.get('/connect', slackController.connectSlack);
router.post('/disconnect', slackController.disconnectSlackHandler);

export default router;
