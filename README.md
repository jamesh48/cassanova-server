# Cassanova Backend

Backend API for the Cassanova application built with Express, TypeScript, and Prisma.

## Prerequisites

- Node.js 20+ (tested with v24.11.1)
- Yarn 1.22+
- PostgreSQL 16+ (if running locally without Docker)
- Docker & Docker Compose (if running with Docker)

## Getting Started

### Option 1: Local Development (without Docker)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cassanova-server
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```bash
   DATABASE_URL="postgresql://username:password@localhost:5432/cassanova"
   POSTGRES_PASSWORD="your-password"
   JWT_SECRET="your-jwt-secret-key"
   ```

4. **Set up PostgreSQL database**

   Make sure PostgreSQL is running locally and create a database:
   ```bash
   createdb cassanova
   ```

5. **Run database migrations**
   ```bash
   yarn prisma migrate deploy
   ```

6. **Generate Prisma Client**
   ```bash
   yarn prisma generate
   ```

7. **Start the development server**
   ```bash
   yarn dev
   ```

   The API will be available at `http://localhost:3030`

### Option 2: Docker Development (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cassanova-server
   ```

2. **Start the application**
   ```bash
   yarn docker:dev
   ```

   Or using docker-compose directly:
   ```bash
   docker-compose up --build
   ```

   This will:
   - Build the Docker image
   - Start a PostgreSQL 16 container
   - Run database migrations
   - Start the backend API on `http://localhost:3030`

3. **Stop the application**
   ```bash
   yarn docker:dev:down
   ```

## Environment Variables

The following environment variables are required:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/cassanova` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `your-secure-password` |
| `JWT_SECRET` | Secret key for JWT token signing | `your-jwt-secret-key` |
| `NODE_ENV` | Environment mode | `development` or `production` |

## Available Scripts

- `yarn dev` - Start development server with hot reload
- `yarn build` - Build TypeScript to JavaScript
- `yarn docker:dev` - Start Docker development environment
- `yarn docker:dev:down` - Stop Docker development environment
- `yarn docker:prod` - Start Docker production environment
- `yarn docker:prod:down` - Stop Docker production environment

## Database

This project uses Prisma as the ORM with PostgreSQL.

### Prisma Commands

- `yarn prisma migrate dev` - Create and apply a new migration (development)
- `yarn prisma migrate deploy` - Apply pending migrations (production)
- `yarn prisma generate` - Generate Prisma Client
- `yarn prisma studio` - Open Prisma Studio (database GUI)

### Database Schema

The schema includes:
- **User** - User accounts with authentication
- **Harem** - User-created collections
- **Prospect** - Items within collections

See `prisma/schema.prisma` for the full schema definition.

## Project Structure

```
cassanova-be/
├── src/
│   ├── index.ts           # Application entry point
│   ├── prisma.ts          # Prisma client configuration
│   └── ...                # Additional source files
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
├── generated/
│   └── prisma/            # Generated Prisma Client
├── prisma.config.ts       # Prisma configuration
├── docker-compose.yml     # Docker development setup
├── Dockerfile             # Docker image definition
└── package.json
```

## API Endpoints

The API runs on port `3030` and includes:

- Health check: `GET /api/healthcheck`
- Additional endpoints documentation coming soon

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:

1. **Local development**: Ensure PostgreSQL is running and the DATABASE_URL in `.env` is correct
2. **Docker**: Make sure no other services are using port 5432
3. **Docker**: If containers exist from a previous run, try `docker-compose down -v` to remove volumes

### Prisma Issues

If Prisma commands fail:
- Make sure `prisma.config.ts` exists in the root directory
- Verify that DATABASE_URL is set in your environment
- Try regenerating the Prisma Client: `yarn prisma generate`

## License

ISC