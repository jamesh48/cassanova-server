import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as iam from 'aws-cdk-lib/aws-iam'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
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

	aws_env: {
		AWS_CLUSTER_ARN: string
		AWS_DEFAULT_SG: string
		AWS_VPC_ID: string
	}
}

export class CassanovaBackendStack extends cdk.Stack {
	public readonly migrationsBucket: s3.Bucket

	constructor(scope: Construct, id: string, props: CassanovaBackendStackProps) {
		super(scope, id, props)

		const postgresIp = cdk.Fn.importValue('PostgresInstancePrivateIp')
		const dbName = props.databaseName || 'postgres'

		const novaBackendFargateSvc = new ecs.FargateService(
			this,
			'nova-backend-farget-service',
			{
				assignPublicIp: true,
				desiredCount: 1,
				capacityProviderStrategies: [
					{
						capacityProvider: 'FARGATE_SPOT',
						weight: 1,
					},
				],
				taskDefinition: new ecs.FargateTaskDefinition(
					this,
					'nova-backend-task-definition',
					{
						taskRole: iam.Role.fromRoleName(
							this,
							'jh-ecs-task-definition-role',
							'jh-ecs-task-definition-role',
						),
						executionRole: iam.Role.fromRoleName(
							this,
							'jh-ecs-task-execution-role',
							'jh-ecs-task-execution-role',
						),
					},
				),
				cluster: ecs.Cluster.fromClusterAttributes(this, 'jh-impoted-cluster', {
					securityGroups: [
						ec2.SecurityGroup.fromSecurityGroupId(
							this,
							'imported-default-sg',
							props.aws_env.AWS_DEFAULT_SG,
						),
					],
					clusterName: 'jh-e1-ecs-cluster',
					clusterArn: props.aws_env.AWS_CLUSTER_ARN,
					vpc: ec2.Vpc.fromLookup(this, 'jh-imported-vpc', {
						vpcId: props.aws_env.AWS_VPC_ID,
					}),
				}),
				enableExecuteCommand: true,
			},
		)

		const container = novaBackendFargateSvc.taskDefinition.addContainer(
			'novaBackend-container',
			{
				environment: {
					DATABASE_URL: `postgresql://postgres:${props.databasePassword}@${postgresIp}:5432/${dbName}`,
					NODE_ENV: 'production',
				},
				image: ecs.ContainerImage.fromAsset('../'),
				logging: new ecs.AwsLogDriver({
					streamPrefix: 'novabe-container',
					logRetention: RetentionDays.FIVE_DAYS,
				}),
			},
		)

		container.addPortMappings({
			containerPort: 3030,
			hostPort: 3030,
		})

		const importedALBListener = elbv2.ApplicationListener.fromLookup(
			this,
			'imported-listener',
			{
				listenerArn:
					'arn:aws:elasticloadbalancing:us-east-1:471507967541:listener/app/jh-alb/c64970f58fd07783/1708c911f9b31d9e',
			},
		)

		const targetGroup = new elbv2.ApplicationTargetGroup(this, 'nova-be-tg', {
			port: 3030,
			protocol: elbv2.ApplicationProtocol.HTTP,
			targets: [novaBackendFargateSvc],
			vpc: ec2.Vpc.fromLookup(this, 'jh-imported-vpc-tg', {
				vpcId: props.aws_env.AWS_VPC_ID,
			}),
			healthCheck: {
				path: '/api/healthcheck',
				unhealthyThresholdCount: 2,
				healthyHttpCodes: '200',
				healthyThresholdCount: 5,
				interval: cdk.Duration.seconds(30),
				port: '3030',
				timeout: cdk.Duration.seconds(10),
			},
		})

		importedALBListener.addTargetGroups('nova-listener-tg', {
			targetGroups: [targetGroup],
			priority: 20,
			conditions: [
				elbv2.ListenerCondition.hostHeaders(['data.cassanova.net']),
				elbv2.ListenerCondition.pathPatterns(['/', '/api/*']),
			],
		})

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
								'# Download prisma.config.ts to root',
								`sudo aws s3 cp s3://${this.migrationsBucket.bucketName}/prisma/prisma.config.ts ./prisma.config.ts`,
								'',
								'# Download Prisma folder',
								`sudo aws s3 sync s3://${this.migrationsBucket.bucketName}/prisma/ ./prisma/ --delete`,
								'',
								'# Install Node.js if not present',
								'if ! command -v node &> /dev/null; then',
								'  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -',
								'  sudo apt-get install -y nodejs',
								'fi',
								'',
								'# Install Prisma dependencies and TypeScript (needed for Prisma 7)',
								'sudo npm install @prisma/client prisma typescript ts-node @types/node dotenv --legacy-peer-deps',
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
								'# Download prisma.config.ts to root',
								`sudo aws s3 cp s3://${this.migrationsBucket.bucketName}/prisma/prisma.config.ts ./prisma.config.ts`,
								'',
								'# Download Prisma folder',
								`sudo aws s3 sync s3://${this.migrationsBucket.bucketName}/prisma/ ./prisma/ --delete`,
								'',
								'# Install Node.js if not present',
								'if ! command -v node &> /dev/null; then',
								'  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -',
								'  sudo apt-get install -y nodejs',
								'fi',
								'',
								'# Ensure dependencies are installed',
								'sudo npm install @prisma/client prisma typescript ts-node @types/node dotenv --legacy-peer-deps',
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

		const postgresSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
			this,
			'PostgresSecurityGroup',
			cdk.Fn.importValue('PostgresInstanceSecurityGroupId'),
		)

		const ecsSecurityGroup = novaBackendFargateSvc.connections.securityGroups[0]

		postgresSecurityGroup.addIngressRule(
			ecsSecurityGroup,
			ec2.Port.tcp(5432),
			'Allow ECS tasks to connect to Postgres',
		)
	}
}
