#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsCdkLoadTestJmeterStack } from '../lib/app-stack';

const app = new cdk.App();
new AwsCdkLoadTestJmeterStack(app, 'AwsCdkLoadTestJmeterStack');
