'use strict';

const express = require('express');
const router = express.Router();
const { getAlerts, markAllRead, markOneRead } = require('../controllers/alertController');
const { authenticate } = require('../middleware/auth');
const { validateQuery, paginationSchema } = require('../middleware/validate');
const { asyncHandler } = require('../utils/response');

router.get('/', authenticate, validateQuery(paginationSchema), asyncHandler(getAlerts));
router.patch('/read', authenticate, asyncHandler(markAllRead));
router.patch('/:id/read', authenticate, asyncHandler(markOneRead));

module.exports = router;
