import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from './constants'

export const asyncHandler = (
	fn: (
		req: Request,
		res: Response,
		next: NextFunction,
	) => Promise<Response<unknown, Record<string, unknown>>>,
) => {
	return (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next)
	}
}

// Middleware to verify JWT token
export const authenticateToken = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const authHeader = req.headers.authorization
	// Bearer TOKEN
	const token = authHeader?.split(' ')[1]

	if (!token) {
		return res.status(401).json({ error: 'Access token required' })
	}

	return jwt.verify(token, JWT_SECRET, (err, decoded) => {
		if (err) {
			return res.status(403).json({ error: 'Invalid or expired token' })
		}
		req.userId = (decoded as { userId: number }).userId
		return next()
	})
}

// Email validation helper
export const validateEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	return emailRegex.test(email)
}

// Password validation helper
export const validatePassword = (
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
