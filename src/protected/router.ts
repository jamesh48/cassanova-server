import { Router } from 'express'
import { asyncHandler, authenticateToken } from '../utils'
import {
	addTagToProspect,
	createProspect,
	createTag,
	createUserHarem,
	deleteHarem,
	deleteProspect,
	deleteTag,
	getCurrentUser,
	getUserHarems,
	getUserTags,
	moveProspect,
	removeTagFromProspect,
	reorderHarems,
	reorderProspects,
	updateCurrentUser,
	updateHarem,
	updateProspect,
	validateToken,
} from './controllers'

const router = Router()

router.get('/user-harems', authenticateToken, asyncHandler(getUserHarems))
router.get('/user', authenticateToken, asyncHandler(getCurrentUser))
router.patch('/user', authenticateToken, asyncHandler(updateCurrentUser))
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

// Tags
router.get('/tags', authenticateToken, asyncHandler(getUserTags))
router.post('/tags', authenticateToken, asyncHandler(createTag))
router.delete('/tags/:id', authenticateToken, asyncHandler(deleteTag))
router.post('/prospects/:id/tags', authenticateToken, asyncHandler(addTagToProspect))
router.delete('/prospects/:id/tags/:tagId', authenticateToken, asyncHandler(removeTagFromProspect))

export default router
