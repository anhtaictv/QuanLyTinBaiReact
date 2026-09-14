const express = require('express');
const router = express.Router();
const newsDigestController = require('../controllers/newsDigestController');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

router.use(verifyToken);
router.get('/', newsDigestController.getDigest);
router.post('/refresh', requireRoles('admin', 'trưởng ban', 'thư ký'), newsDigestController.refreshNow);

module.exports = router;
