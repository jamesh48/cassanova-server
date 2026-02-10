import cors from 'cors'
import express from 'express'

const app = express()

app.use(express.json())
app.use(cors({ origin: ['http://localhost:3000'] }))
app.use((req, _res, next) => {
	console.info(`${req.method} ${req.url}`)
	next()
})

export default app
