const express = require('express');
const router = express.Router();
const { getCheckins } = require('../controllers/checkinController');
const requireAuth = require('../middleware/requireAuth');

router.get('/', requireAuth, getCheckins);

module.exports = router;