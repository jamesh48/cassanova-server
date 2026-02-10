import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET, TOKEN_EXPIRY } from '../../constants'
import { prisma } from '../../prisma'

const router = Router()

router.post('/create-user', async (req, res) => {
	const { email } = req.body
	const newUser = await prisma.user.create({ data: { email } })

	const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, {
		expiresIn: TOKEN_EXPIRY,
	})

	return res.send({ message: 'User Created', token })
})
// Login endpoint - generates JWT token
router.post('/login', async (req, res) => {
	const { email } = req.body

	if (!email) {
		return res.status(400).json({ error: 'User Email is required' })
	}

	const userProfile = await prisma.user.findUnique({ where: { email: email } })
	const userId = userProfile?.id

	if (!userId) {
		return res.status(400).json({ error: 'User not found' })
	}

	const user = await prisma.user.findUnique({ where: { id: userId } })
	if (!user) return res.status(404).json({ error: 'User not found' })

	const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })

	return res.json({ token })
})

router.get('/healthcheck', async (_req, res) => {
	return res.send('Cassanova App is Healthy!')
})

export default router
