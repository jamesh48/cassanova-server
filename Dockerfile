# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./
COPY tsconfig.json ./
COPY prisma.config.ts ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY src ./src
COPY prisma ./prisma

# Generate Prisma Client (DATABASE_URL not needed for generation)
RUN yarn prisma generate

# Build TypeScript
RUN yarn build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package.json yarn.lock ./
COPY prisma.config.ts ./

# Install production dependencies only
RUN yarn install --frozen-lockfile --production && yarn cache clean

# Copy Prisma schema (needed for Prisma Client)
COPY prisma ./prisma

# Generate Prisma Client in production (this ensures it's in node_modules)
RUN yarn prisma generate

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3030

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3030/api/healthcheck', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/src/index.js"]