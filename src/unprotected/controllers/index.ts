import bcrypt from 'bcrypt'
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET, TOKEN_EXPIRY } from '../../constants'
import { prisma } from '../../prisma'

const router = Router()

// Password validation helper
const validatePassword = (
	password: string,
): { valid: boolean; errors: string[] } => {
	const errors: string[] = []

	if (password.length < 8) {
		errors.push('Password must be at least 8 characters long')
	}
	if (!/[a-z]/.test(password)) {
		errors.push('Password must contain at least one lowercase letter')
	}
	if (!/[A-Z]/.test(password)) {
		errors.push('Password must contain at least one uppercase letter')
	}
	if (!/[0-9]/.test(password)) {
		errors.push('Password must contain at least one number')
	}
	if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
		errors.push('Password must contain at least one special character')
	}

	return {
		valid: errors.length === 0,
		errors,
	}
}

// Email validation helper
const validateEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	return emailRegex.test(email)
}

// Register endpoint - creates new user with hashed password
router.post('/user', async (req, res) => {
	const { email, password } = req.body

	if (!email || !password) {
		return res.status(400).json({ error: 'Email and password are required' })
	}

	if (!validateEmail(email)) {
		return res.status(400).json({ error: 'Invalid email format' })
	}

	const passwordValidation = validatePassword(password)
	if (!passwordValidation.valid) {
		return res.status(400).json({
			error: 'Password does not meet requirements',
			details: passwordValidation.errors,
		})
	}

	// Check if user already exists
	const existingUser = await prisma.user.findUnique({ where: { email } })
	if (existingUser) {
		return res
			.status(409)
			.json({ error: 'User with this email already exists' })
	}

	// Hash password with bcrypt (salt rounds: 12)
	const passwordHash = await bcrypt.hash(password, 12)

	try {
		const newUser = await prisma.user.create({
			data: {
				email,
				passwordHash,
			},
		})

		const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, {
			expiresIn: TOKEN_EXPIRY,
		})

		return res.status(201).json({
			message: 'User created successfully',
			token,
			user: {
				id: newUser.id,
				email: newUser.email,
			},
		})
	} catch (error) {
		console.error('Error creating user:', error)
		return res.status(500).json({ error: 'Failed to create user' })
	}
})

// Login endpoint - validates password and generates JWT token
router.post('/login', async (req, res) => {
	const { email, password } = req.body

	if (!email || !password) {
		return res.status(400).json({ error: 'Email and password are required' })
	}

	try {
		const user = await prisma.user.findUnique({ where: { email } })

		if (!user) {
			// Use generic error message to prevent user enumeration
			return res.status(401).json({ error: 'Invalid email or password' })
		}

		// Compare provided password with stored hash
		const isValidPassword = await bcrypt.compare(password, user.passwordHash)

		if (!isValidPassword) {
			return res.status(401).json({ error: 'Invalid email or password' })
		}

		// Generate JWT token
		const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
			expiresIn: TOKEN_EXPIRY,
		})

		return res.json({
			token,
			user: {
				id: user.id,
				email: user.email,
				alias_name: user.alias_name,
			},
		})
	} catch (error) {
		console.error('Login error:', error)
		return res.status(500).json({ error: 'Login failed' })
	}
})

router.get('/test-db', async (_req, res) => {
	try {
		const count = await prisma.user.count()
		return res.json({ success: true, userCount: count })
	} catch (error) {
		const typedError = error as { message: string }
		return res.status(500).json({ error: typedError.message })
	}
})

router.get('/healthcheck', async (_req, res) => {
	return res.send('Cassanova App is Healthy!')
})

export default router
