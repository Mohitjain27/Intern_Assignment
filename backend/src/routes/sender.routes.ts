import { Router } from 'express';
import * as senderController from '../controllers/sender.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();
router.use(authenticate);

router.get('/', senderController.getSenders);
router.post('/', senderController.createSender);

export default router;
