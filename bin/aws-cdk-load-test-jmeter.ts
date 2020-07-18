#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsCdkLoadTestJmeterStack } from '../lib/aws-cdk-load-test-jmeter-stack';

const app = new cdk.App();
new AwsCdkLoadTestJmeterStack(app, 'AwsCdkLoadTestJmeterStack');
