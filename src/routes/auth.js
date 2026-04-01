'use strict';

const express = require('express');
const router = express.Router();
const { register, login, getMe, updateSettings } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateBody, registerSchema, loginSchema } = require('../middleware/validate');
const { asyncHandler } = require('../utils/response');

router.post('/register', validateBody(registerSchema), asyncHandler(register));
router.post('/login', validateBody(loginSchema), asyncHandler(login));
router.get('/me', authenticate, asyncHandler(getMe));
router.patch('/me/settings', authenticate, asyncHandler(updateSettings));

module.exports = router;
