import { Router } from 'express'

import { asyncHandler } from '../utils'
import { createUser, getUserCount, healthcheck, userLogin } from './controllers'

const router = Router()

// Register endpoint - creates new user with hashed password
router.post('/user', asyncHandler(createUser))

// Login endpoint - validates password and generates JWT token
router.post('/login', asyncHandler(userLogin))

router.get('/user-count', asyncHandler(getUserCount))

router.get('/healthcheck', asyncHandler(healthcheck))

export default router
