import { Router } from 'express'
import { asyncHandler, authenticateToken } from '../utils'
import {
	createProspect,
	createUserHarem,
	deleteHarem,
	deleteProspect,
	getUserHarems,
	moveProspect,
	reorderHarems,
	reorderProspects,
	updateHarem,
	updateProspect,
	validateToken,
} from './controllers'

const router = Router()

router.get('/user-harems', authenticateToken, asyncHandler(getUserHarems))

router.post('/user-harems', authenticateToken, asyncHandler(createUserHarem))
router.put('/user-harems/:id', authenticateToken, asyncHandler(updateHarem))
router.delete('/user-harems/:id', authenticateToken, asyncHandler(deleteHarem))
router.put('/prospects/:id', authenticateToken, asyncHandler(updateProspect))
router.delete('/prospects/:id', authenticateToken, asyncHandler(deleteProspect))
router.post('/reorder-harems', authenticateToken, asyncHandler(reorderHarems))
router.post(
	'/reorder-prospects',
	authenticateToken,
	asyncHandler(reorderProspects),
)
router.post('/move-prospect', authenticateToken, asyncHandler(moveProspect))
router.post('/prospect', authenticateToken, createProspect)
router.get('/validate-token', authenticateToken, asyncHandler(validateToken))

export default router
