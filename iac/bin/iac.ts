#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core'
import dotenv from 'dotenv'
import { CassanovaBackendStack } from '../lib/cassanova-be-stack'

dotenv.config({ path: '../.env' })

const app = new cdk.App()

const postgresPassword = process.env.POSTGRES_PASSWORD

if (!postgresPassword) {
	throw new Error('POSTGRES_PASSWORD env not defined!')
}

new CassanovaBackendStack(app, 'CassanovaBackendStack', {
	// Database password (same as in your infrastructure repo)
	databasePassword: postgresPassword,
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
})
