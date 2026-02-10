# Express App CDK Stack with Automatic Prisma Migrations

This CDK stack is for your **Express app repository** and handles:
- Automatically running Prisma migrations on every deployment
- Later: ECS service, Load Balancer, etc.

## Prerequisites

Before deploying this stack, you must:

1. **Deploy your PostgresEc2Stack first** in your infrastructure repo
2. Ensure both stacks are in the **same AWS account and region**
3. The PostgresEc2Stack must export `PostgresDatabaseInstanceId` (this is automatic with the latest version)

## Project Structure

```
cassanova-server/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       └── 20240210_init/
│           └── migration.sql
├── src/
│   └── index.ts (your Express app)
├── iac/  (CDK code)
│   ├── bin/
│   │   └── app.ts
│   └── lib/
│       └── express-app-stack.ts
├── package.json
└── .env
```

## Setup

### 1. Initialize CDK in Your Express Repo

```bash
cd your-express-app
mkdir infrastructure
cd infrastructure

# Initialize CDK
cdk init app --language typescript

# Install dependencies
npm install
```

### 2. Copy the Stack File

Copy `express-app-stack.ts` to `infrastructure/lib/express-app-stack.ts`

### 3. Configure Your App Entry Point

Update `infrastructure/bin/<your-app-name>.ts`:

```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ExpressAppStack } from '../lib/express-app-stack';

const app = new cdk.App();

const postgresPassword = process.env.POSTGRES_PASSWORD;

if (!postgresPassword) {
  throw new Error("POSTGRES_PASSWORD env not defined!");
}

new CassanovaBEStack(app, 'ExpressAppStack', {
  // Database password
  databasePassword: process.env.POSTGRES_PASSWORD,

  // Optional: specify database name
  databaseName: 'postgres',

  // Path to your Prisma folder (relative to infrastructure/)
  prismaPath: '../prisma',

  env: {
    // IMPORTANT: Must be in same account/region as PostgresEc2Stack
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
```

**Note:** The database instance ID is automatically imported from your `PostgresEc2Stack` via CloudFormation exports.

### 4. Configure Environment Variables

Create `.env` in your infrastructure directory:

```bash
# infrastructure/.env
POSTGRES_PASSWORD=YourSecurePassword123
```

Add to `.gitignore`:
```
.env
```

**Note:** You no longer need to specify `DB_INSTANCE_ID` - it's automatically looked up from your PostgresEc2Stack!

### 5. Deploy

```bash
cd infrastructure

# Load environment variables
source .env

# Bootstrap (first time only)
cdk bootstrap

# Deploy
cdk deploy
```

## How It Works

### On Every Deployment:

1. **Upload Phase**: CDK uploads your `prisma/` folder to S3
2. **Migration Phase**: Custom resource triggers SSM command on DB instance
3. **Execution**:
   - Downloads Prisma files from S3 to `/opt/prisma-migrations/`
   - Installs Node.js and Prisma (if needed)
   - Runs `npx prisma migrate deploy`
4. **Success**: Migrations applied, stack deployment completes

### What Gets Uploaded to S3:

- `prisma/schema.prisma`
- `prisma/migrations/` (all migration files)
- Excludes: `node_modules`, `.db` files, `.env` files

## Development Workflow

### 1. Create a New Migration Locally

```bash
# In your Express app root
npx prisma migrate dev --name add_users_table
```

This creates a new migration in `prisma/migrations/`

### 2. Deploy to AWS

```bash
cd infrastructure
source .env
cdk deploy
```

CDK will:
- Upload your new migration
- Automatically run it on the database
- Complete the deployment

### 3. Verify

```bash
# Connect to database
aws ssm start-session --target $DB_INSTANCE_ID \
  --document-name AWS-StartPortForwardingSession \
  --parameters "portNumber=5432,localPortNumber=5432"

# In another terminal
psql postgresql://postgres:$POSTGRES_PASSWORD@localhost:5432/postgres

# Check migrations
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC;
```

## Adding ECS Later

When you're ready to add your Express app to ECS, add to the same stack:

```typescript
export class ExpressAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ExpressAppStackProps) {
    super(scope, id, props);

    // ... existing migration code ...

    // Add ECS cluster
    const cluster = new ecs.Cluster(this, 'ExpressCluster', {
      vpc: vpc,
    });

    // Add Fargate service
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'ExpressTask', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    taskDefinition.addContainer('express', {
      image: ecs.ContainerImage.fromRegistry('your-express-image'),
      environment: {
        DATABASE_URL: `postgresql://postgres:${props.databasePassword}@${dbHost}:5432/postgres`,
      },
      portMappings: [{ containerPort: 3000 }],
    });

    // Add load balancer, etc.
  }
}
```

## Troubleshooting

### Migration fails with "command not found"

Node.js installation might have failed. Connect via SSM and check:

```bash
aws ssm start-session --target i-0e6b35c6d628e910c
node --version
npm --version
```

### Migration fails with connection error

Check PostgreSQL is running:

```bash
aws ssm start-session --target i-0e6b35c6d628e910c
sudo systemctl status postgresql
```

### Want to see migration logs

Check CloudWatch or SSM command history:

```bash
aws ssm list-commands \
  --instance-id i-0e6b35c6d628e910c \
  --max-items 5
```

### Rollback a migration

Prisma doesn't support automatic rollback. You'll need to:

1. Create a new migration that reverses changes
2. Deploy it via `cdk deploy`

## Environment-Specific Deployments

Deploy different stacks for dev/staging/prod:

```typescript
// bin/app.ts
const app = new cdk.App();

// Dev environment
new ExpressAppStack(app, 'ExpressAppStackDev', {
  databasePassword: process.env.POSTGRES_PASSWORD_DEV!,
  env: { account: 'xxx', region: 'us-east-1' },
});

// Prod environment
new ExpressAppStack(app, 'ExpressAppStackProd', {
  databasePassword: process.env.POSTGRES_PASSWORD_PROD!,
  env: { account: 'yyy', region: 'us-east-1' },
});
```

**Important:** Each environment needs its own PostgresEc2Stack deployed first with the export name `PostgresDatabaseInstanceId`.

Deploy specific environment:
```bash
cdk deploy ExpressAppStackDev
cdk deploy ExpressAppStackProd
```

## Benefits of This Approach

✅ **Automatic**: Migrations run on every deployment
✅ **Infrastructure as Code**: Everything in version control
✅ **Incremental**: Only new migrations run
✅ **Safe**: Prisma tracks applied migrations
✅ **Scalable**: Easy to add ECS, ALB, etc. later
✅ **Separation of Concerns**: DB infrastructure separate from app infrastructure

## Next Steps

1. ✅ Set up migrations (you're doing this now)
2. Add ECS Fargate task definition
3. Add Application Load Balancer
4. Add auto-scaling
5. Add CloudWatch monitoring
6. Add CI/CD pipeline