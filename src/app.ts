import cors from 'cors'
import express from 'express'

const app = express()

app.use(express.json())
app.use(
	cors({
		origin: [
			'https://cassanova.net',
			'https://www.cassanova.net',
			// for local development
			'http://localhost:3000',
		],
		credentials: true,
	}),
)
app.use((req, _res, next) => {
	console.info(`${req.method} ${req.url}`)
	next()
})

export default app
