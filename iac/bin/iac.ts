#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core'
import dotenv from 'dotenv'
import { CassanovaBackendStack } from '../lib/cassanova-be-stack'

dotenv.config({ path: '../.env' })

const app = new cdk.App()

const postgresPassword = process.env.POSTGRES_PASSWORD
const awsDefaultSg = process.env.AWS_DEFAULT_SG
const awsVpcId = process.env.AWS_VPC_ID
const awsClusterArn = process.env.AWS_CLUSTER_ARN
const jwtSecret = process.env.JWT_SECRET

if (!postgresPassword) {
	throw new Error('POSTGRES_PASSWORD env not defined!')
}

if (!jwtSecret) {
	throw new Error('JWT_SECRET env not defined!')
}

if (!awsDefaultSg) {
	throw new Error('AWS_DEFAULT_SG env not defined!')
}

if (!awsVpcId) {
	throw new Error('AWS_VPC_ID env not defined!')
}

if (!awsClusterArn) {
	throw new Error('AWS_CLUSTER_ARN env not defined!')
}

new CassanovaBackendStack(app, 'CassanovaBackendStack', {
	// Database password (same as in your infrastructure repo)
	databasePassword: postgresPassword,
	containerEnv: { JWT_SECRET: jwtSecret },
	// Optional: database name (default is 'postgres')
	databaseName: 'postgres',

	// Path to your Prisma folder (relative to this infrastructure/ directory)
	// If your structure is:
	//   cassanova-server/
	//     prisma/
	//     iac/
	// Then use '../prisma'
	prismaPath: '../prisma',

	env: {
		// IMPORTANT: Must be same account/region as PostgresEc2Stack
		account: process.env.CDK_DEFAULT_ACCOUNT,
		region: process.env.CDK_DEFAULT_REGION,
	},
	aws_env: {
		AWS_DEFAULT_SG: awsDefaultSg,
		AWS_VPC_ID: awsVpcId,
		AWS_CLUSTER_ARN: awsClusterArn,
	},
})
