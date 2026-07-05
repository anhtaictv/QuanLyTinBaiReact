const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { upload } = require('../config/chatUpload');

router.get('/conversations', chatController.getConversations);
router.post('/conversations', chatController.createConversation);
router.get('/conversations/:id/messages', chatController.getMessages);
router.get('/conversations/:id/members', chatController.getMembers);
router.post('/conversations/:id/members', chatController.addMember);
router.delete('/conversations/:id/members/:userId', chatController.removeMember);
router.post('/upload', upload.single('file'), chatController.uploadAttachment);
router.get('/download', chatController.downloadAttachment);

module.exports = router;
