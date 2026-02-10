import { type NextFunction, type Request, type Response, Router } from 'express'

import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../../constants'
import { prisma } from '../../prisma'

const router = Router()

const asyncHandler = (
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
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
	const authHeader = req.headers.authorization
	// Bearer TOKEN
	const token = authHeader && authHeader.split(' ')[1]

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

const getUserHarems = async (req: Request, res: Response) => {
	const userId = req.userId

	const harems = await prisma.harem.findMany({
		where: { userId },
		include: {
			prospects: {
				omit: { haremId: true },
				orderBy: [
					{ hotLead: 'desc' }, // Hot leads first
					{ haremOrder: 'asc' }, // Then by order
					{ id: 'asc' }, // Finally by ID for stability
				],
			},
		},
		orderBy: { order: 'asc' },
	})

	return res.json(harems)
}

const reorderHarems = async (req: Request, res: Response) => {
	const userId = req.userId

	const harems = req.body as Array<{ id: number; order: number }>

	// Validation
	if (!Array.isArray(harems) || harems.length === 0) {
		return res.status(400).json({ error: 'Invalid harems data' })
	}

	// Verify all harems belong to the user
	const haremIds = harems.map((h) => h.id)
	const userHarems = await prisma.harem.findMany({
		where: {
			id: { in: haremIds },
			userId,
		},
		select: { id: true },
	})

	if (userHarems.length !== harems.length) {
		return res
			.status(403)
			.json({ error: 'Unauthorized: Some harems do not belong to you' })
	}

	// Update orders in a transaction
	await prisma.$transaction(
		harems.map((harem) =>
			prisma.harem.update({
				where: { id: harem.id },
				data: { order: harem.order },
			}),
		),
	)

	return res.json({ message: 'Harems reordered successfully' })
}

const createUserHarem = async (req: Request, res: Response) => {
	const userId = req.userId
	const { name } = req.body

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		return res.status(400).json({ error: 'Harem name is required' })
	}

	// Get the highest order number for this user
	const maxOrder = await prisma.harem.findFirst({
		where: { userId },
		orderBy: { order: 'desc' },
		select: { order: true },
	})

	const result = await prisma.harem.create({
		data: {
			name: name.trim(),
			userId,
			order: (maxOrder?.order ?? 0) + 1,
		},
	})

	return res.status(201).json(result)
}

const createProspect = async (req: Request, res: Response) => {
	const userId = req.userId
	const { name, haremId } = req.body

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		return res.status(400).json({ error: 'Prospect name is required' })
	}

	if (!haremId || typeof haremId !== 'number') {
		return res.status(400).json({ error: 'Valid harem ID is required' })
	}

	// Verify harem belongs to user
	const harem = await prisma.harem.findUnique({
		where: { id: haremId },
	})

	if (!harem || harem.userId !== userId) {
		return res
			.status(403)
			.json({ error: 'Unauthorized: Harem does not belong to you' })
	}

	// Get the highest haremOrder in this harem
	const maxOrderProspect = await prisma.prospect.findFirst({
		where: { haremId },
		orderBy: { haremOrder: 'desc' },
		select: { haremOrder: true },
	})

	const newOrder = (maxOrderProspect?.haremOrder ?? -1) + 1

	const result = await prisma.prospect.create({
		data: {
			name: name.trim(),
			haremId,
			haremOrder: newOrder,
			hotLead: false,
		},
	})

	return res.status(201).json(result)
}

const updateHarem = async (req: Request, res: Response) => {
	const userId = req.userId
	const { id } = req.params
	const { name } = req.body

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		return res.status(400).json({ error: 'Harem name is required' })
	}

	// Verify ownership
	const harem = await prisma.harem.findUnique({
		where: { id: Number(id) },
	})

	if (!harem || harem.userId !== userId) {
		return res.status(404).json({ error: 'Harem not found' })
	}

	const updated = await prisma.harem.update({
		where: { id: Number(id) },
		data: { name: name.trim() },
	})

	return res.json(updated)
}

const updateProspect = async (req: Request, res: Response) => {
	const userId = req.userId
	const { id } = req.params
	const { name, hotLead } = req.body

	// Validation
	if (
		name !== undefined &&
		(typeof name !== 'string' || name.trim().length === 0)
	) {
		return res
			.status(400)
			.json({ error: 'Prospect name must be a non-empty string' })
	}

	if (hotLead !== undefined && typeof hotLead !== 'boolean') {
		return res.status(400).json({ error: 'Hot lead must be a boolean value' })
	}

	// Verify prospect exists and belongs to user's harem
	const prospect = await prisma.prospect.findUnique({
		where: { id: Number(id) },
		include: { harem: true },
	})

	if (!prospect) {
		return res.status(404).json({ error: 'Prospect not found' })
	}

	if (prospect.harem?.userId !== userId) {
		return res
			.status(403)
			.json({ error: 'Unauthorized: Prospect does not belong to you' })
	}

	// Build update data object with only provided fields
	const updateData: { name?: string; hotLead?: boolean } = {}

	if (name !== undefined) {
		updateData.name = name.trim()
	}

	if (hotLead !== undefined) {
		updateData.hotLead = hotLead
	}

	// Update prospect
	const updated = await prisma.prospect.update({
		where: { id: Number(id) },
		data: updateData,
	})

	return res.json(updated)
}

const deleteProspect = async (req: Request, res: Response) => {
	const { id } = req.params

	// Verify ownership
	const prospect = await prisma.prospect.findUnique({
		where: { id: Number(id) },
	})

	if (!prospect) {
		return res.status(404).json({ error: 'Prospect not found' })
	}

	const deleted = await prisma.prospect.delete({
		where: { id: Number(id) },
	})

	return res.json(deleted)
}

const moveProspect = async (req: Request, res: Response) => {
	const userId = req.userId
	const { prospectId, newHaremId } = req.body

	if (!prospectId || !newHaremId) {
		return res
			.status(400)
			.json({ error: 'Prospect ID and new harem ID required' })
	}

	// Verify the prospect exists and belongs to user's harem
	const prospect = await prisma.prospect.findUnique({
		where: { id: prospectId },
		include: { harem: true },
	})

	if (!prospect || prospect.harem?.userId !== userId) {
		return res.status(403).json({ error: 'Unauthorized' })
	}

	// Verify the target harem belongs to the user
	const targetHarem = await prisma.harem.findUnique({
		where: { id: newHaremId },
	})

	if (!targetHarem || targetHarem.userId !== userId) {
		return res.status(403).json({ error: 'Unauthorized' })
	}

	// Get the current prospects in the target harem to determine order
	const targetHaremProspects = await prisma.prospect.findMany({
		where: { haremId: newHaremId },
		orderBy: { haremOrder: 'desc' },
	})

	// Determine new order: 0 if hot lead, otherwise last position
	const newOrder = prospect.hotLead
		? 0
		: targetHaremProspects.length > 0
			? targetHaremProspects[0].haremOrder + 1
			: 0

	// If hot lead goes to front, shift other prospects down
	if (prospect.hotLead && newOrder === 0) {
		await prisma.prospect.updateMany({
			where: { haremId: newHaremId },
			data: { haremOrder: { increment: 1 } },
		})
	}

	// Move the prospect
	const updated = await prisma.prospect.update({
		where: { id: prospectId },
		data: {
			haremId: newHaremId,
			haremOrder: newOrder,
			timeInCurrentHarem: new Date(),
		},
	})

	return res.json(updated)
}

const reorderProspects = async (req: Request, res: Response) => {
	const userId = req.userId
	const prospects = req.body as Array<{ id: number; haremOrder: number }>

	console.info(req.body)

	// Validation
	if (!Array.isArray(prospects) || prospects.length === 0) {
		return res.status(400).json({ error: 'Invalid prospects data' })
	}

	// Validate each prospect has required fields
	const invalidProspect = prospects.find(
		(p) => !p.id || typeof p.haremOrder !== 'number',
	)
	if (invalidProspect) {
		return res
			.status(400)
			.json({ error: 'Each prospect must have id and haremOrder' })
	}

	const prospectIds = prospects
		.map((p) => p.id)
		.filter((id) => id !== undefined && id !== null)

	if (prospectIds.length !== prospects.length) {
		return res.status(400).json({ error: 'All prospects must have valid IDs' })
	}

	// Verify all prospects belong to user's harems
	const userProspects = await prisma.prospect.findMany({
		where: {
			id: { in: prospectIds },
		},
		include: { harem: true },
	})

	if (userProspects.length !== prospectIds.length) {
		return res.status(404).json({ error: 'Some prospects not found' })
	}

	if (userProspects.some((p) => p.harem?.userId !== userId)) {
		return res
			.status(403)
			.json({ error: 'Unauthorized: Some prospects do not belong to you' })
	}

	// Update orders in a transaction
	await prisma.$transaction(
		prospects.map((prospect) =>
			prisma.prospect.update({
				where: { id: prospect.id },
				data: { haremOrder: prospect.haremOrder },
			}),
		),
	)

	return res.json({ message: 'Prospects reordered successfully' })
}

const deleteHarem = async (req: Request, res: Response) => {
	const userId = req.userId
	const { id } = req.params // Use params instead of query for DELETE

	// Validate ID
	const haremId = Number(id)
	if (Number.isNaN(haremId)) {
		return res.status(400).json({ error: 'Invalid harem ID' })
	}

	// Fetch harem with ownership verification
	const currentHarem = await prisma.harem.findUnique({
		where: { id: haremId },
		include: {
			prospects: true,
		},
	})

	if (!currentHarem) {
		return res.status(404).json({ error: 'Harem not found' })
	}

	// Verify ownership
	if (currentHarem.userId !== userId) {
		return res
			.status(403)
			.json({ error: 'Unauthorized: Harem does not belong to you' })
	}

	// Check if harem is empty
	if (currentHarem.prospects.length > 0) {
		return res
			.status(400)
			.json({ error: 'Harem must be empty before being deleted' })
	}

	// Delete the harem
	await prisma.harem.delete({ where: { id: haremId } })

	return res.json({ message: 'Harem deleted successfully' })
}

router.get('/user-harems', authenticateToken, asyncHandler(getUserHarems))

router.post('/user-harems', authenticateToken, createUserHarem)
router.put('/user-harems/:id', authenticateToken, asyncHandler(updateHarem))
router.delete('/user-harems/:id', authenticateToken, asyncHandler(deleteHarem))
router.put('/prospects/:id', authenticateToken, asyncHandler(updateProspect))
router.delete('/prospects/:id', authenticateToken, asyncHandler(deleteProspect))
router.post('/reorder-harems', authenticateToken, reorderHarems)
router.post(
	'/reorder-prospects',
	authenticateToken,
	asyncHandler(reorderProspects),
)
router.post('/move-prospect', authenticateToken, asyncHandler(moveProspect))
router.get(
	'/seed-harems',
	authenticateToken,
	async (req: Request, res: Response) => {
		const userId = req.userId
		console.info(userId)

		return res.send('ok')
	},
)

router.post('/prospect', authenticateToken, createProspect)

router.get(
	'/validate-token',
	authenticateToken,
	(req: Request, res: Response) => {
		// If we reach here, the token is valid (authenticateToken middleware passed)
		return res.status(200).json({
			valid: true,
			userId: req.userId,
		})
	},
)

export default router
