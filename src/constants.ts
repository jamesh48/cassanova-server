// Secret key for JWT - in production, use environment variable
export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this'
export const TOKEN_EXPIRY = '24h' // Token expires in 24 hours
