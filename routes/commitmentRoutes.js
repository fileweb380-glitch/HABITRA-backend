const express = require('express');
const router = express.Router();
const { getCommitments, createCommitment, updateCommitmentStatus } = require('../controllers/commitmentController');
const requireAuth = require('../middleware/requireAuth');

router.route('/').get(requireAuth, getCommitments).post(requireAuth, createCommitment);
router.patch('/:id/status', requireAuth, updateCommitmentStatus);

module.exports = router;