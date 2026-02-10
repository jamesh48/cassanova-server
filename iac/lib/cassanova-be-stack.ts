import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as cr from 'aws-cdk-lib/custom-resources'
import type { Construct } from 'constructs'

interface CassanovaBackendStackProps extends cdk.StackProps {
	/**
	 * PostgreSQL password
	 */
	databasePassword?: string

	/**
	 * Database name (default: postgres)
	 */
	databaseName?: string

	/**
	 * Path to your Prisma project directory (contains prisma/ folder)
	 * Default: './prisma' (relative to CDK project root)
	 */
	prismaPath?: string
}

export class CassanovaBackendStack extends cdk.Stack {
	public readonly migrationsBucket: s3.Bucket

	constructor(scope: Construct, id: string, props: CassanovaBackendStackProps) {
		super(scope, id, props)

		const dbName = props.databaseName || 'postgres'
		const prismaPath = props.prismaPath || '../prisma'

		// Import the database instance ID from the PostgresEc2Stack
		const databaseInstanceId = cdk.Fn.importValue('PostgresDatabaseInstanceId')

		// Import the database instance's IAM role ARN
		const dbInstanceRoleArn = cdk.Fn.importValue(
			'PostgresDatabaseInstanceRoleArn',
		)

		// S3 bucket to store Prisma schema and migrations
		this.migrationsBucket = new s3.Bucket(this, 'PrismaMigrationsBucket', {
			removalPolicy: cdk.RemovalPolicy.DESTROY,
			autoDeleteObjects: true,
		})

		// Grant the database instance's role read access to this bucket
		const dbInstanceRole = iam.Role.fromRoleArn(
			this,
			'DatabaseInstanceRole',
			dbInstanceRoleArn,
		)
		this.migrationsBucket.grantRead(dbInstanceRole)

		// Upload Prisma files to S3 on every deployment
		// Note: We need both the prisma/ folder AND the root prisma.config.ts
		new s3deploy.BucketDeployment(this, 'UploadPrismaFiles', {
			sources: [
				// Upload everything from the prisma directory
				s3deploy.Source.asset(prismaPath),
				// Also upload prisma.config.ts from the parent directory
				s3deploy.Source.asset(`${prismaPath}/..`, {
					// Only include prisma.config.ts
					exclude: ['*', '!prisma.config.ts'],
				}),
			],
			destinationBucket: this.migrationsBucket,
			destinationKeyPrefix: 'prisma',
			exclude: ['node_modules/*', '*.db', '*.db-journal', '.env*'],
			// This ensures new deployments overwrite old files
			prune: true,
		})

		// Custom resource to run migrations via SSM
		const _migrationRunner = new cr.AwsCustomResource(
			this,
			'RunPrismaMigrations',
			{
				onCreate: {
					service: 'SSM',
					action: 'sendCommand',
					parameters: {
						DocumentName: 'AWS-RunShellScript',
						InstanceIds: [databaseInstanceId],
						Parameters: {
							commands: [
								'#!/bin/bash',
								'set -e',
								'',
								'# Create working directory',
								'mkdir -p /opt/prisma-migrations',
								'cd /opt/prisma-migrations',
								'',
								'# Download latest Prisma files from S3',
								`sudo aws s3 sync s3://${this.migrationsBucket.bucketName}/prisma/ ./prisma/ --delete`,
								'',
								'# Copy prisma.config.ts to root (Prisma 7 looks for it here)',
								'if [ -f ./prisma/prisma.config.ts ]; then',
								'  cp ./prisma/prisma.config.ts ./prisma.config.ts',
								'fi',
								'',
								'# Install Node.js if not present',
								'if ! command -v node &> /dev/null; then',
								'  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -',
								'  apt-get install -y nodejs',
								'fi',
								'',
								'# Install Prisma dependencies and TypeScript (needed for Prisma 7)',
								'npm install @prisma/client prisma typescript ts-node @types/node dotenv',
								'',
								'# Run migrations',
								`export DATABASE_URL="postgresql://postgres:${props.databasePassword}@localhost:5432/${dbName}"`,
								'npx prisma migrate deploy',
								'',
								'echo "✅ Prisma migrations completed successfully"',
							],
						},
					},
					physicalResourceId: cr.PhysicalResourceId.of(Date.now().toString()),
				},
				onUpdate: {
					service: 'SSM',
					action: 'sendCommand',
					parameters: {
						DocumentName: 'AWS-RunShellScript',
						InstanceIds: [databaseInstanceId],
						Parameters: {
							commands: [
								'#!/bin/bash',
								'set -e',
								'',
								'cd /opt/prisma-migrations',
								'',
								'# Download latest Prisma files',
								`sudo aws s3 sync s3://${this.migrationsBucket.bucketName}/prisma/ ./prisma/ --delete`,
								'',
								'# Copy prisma.config.ts to root (Prisma 7 looks for it here)',
								'if [ -f ./prisma/prisma.config.ts ]; then',
								'  cp ./prisma/prisma.config.ts ./prisma.config.ts',
								'fi',
								'',
								'# Ensure dependencies are installed',
								'npm install @prisma/client prisma typescript ts-node @types/node dotenv',
								'',
								'# Run migrations',
								`export DATABASE_URL="postgresql://postgres:${props.databasePassword}@localhost:5432/${dbName}"`,
								'npx prisma migrate deploy',
								'',
								'echo "✅ Prisma migrations completed successfully"',
							],
						},
					},
					physicalResourceId: cr.PhysicalResourceId.of(Date.now().toString()),
				},
				policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
					resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
				}),
				// Increase timeout for migration commands
				timeout: cdk.Duration.minutes(10),
			},
		)

		// Output the S3 bucket name for reference
		new cdk.CfnOutput(this, 'MigrationsBucketName', {
			value: this.migrationsBucket.bucketName,
			description: 'S3 bucket containing Prisma migrations',
		})

		new cdk.CfnOutput(this, 'MigrationsStatus', {
			value: 'Migrations will run automatically on every deployment',
			description: 'Migration deployment status',
		})
	}
}
