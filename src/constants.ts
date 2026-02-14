// Secret key for JWT - in production, use environment variable
console.info(process.env.JWT_SECRET)
export const JWT_SECRET = process.env.JWT_SECRET || ''
export const TOKEN_EXPIRY = '24h' // Token expires in 24 hours
