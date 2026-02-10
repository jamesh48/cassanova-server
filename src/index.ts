import app from './app'
import protectedRoutes from './protected/controllers'
import unprotectedRoutes from './unprotected/controllers'

// Register routes
app.use('/api', unprotectedRoutes)
app.use('/api', protectedRoutes)

// Start server
app.listen('3030', () => console.info('Cassanova App Up!'))
