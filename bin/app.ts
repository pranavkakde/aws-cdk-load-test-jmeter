#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { LoadGenStack } from '../lib/app-stack';
import {VPCStack} from '../lib/vpc-stack';

const app = new cdk.App();
const vpcStack = new VPCStack(app,'VPCStack');
const JmeterStack = new LoadGenStack(app, 'LoadGenStack',{vpc: vpcStack.vpc, securityGroup: vpcStack.securityGroup, s3bucket: vpcStack.s3bucket});
JmeterStack.addDependency(vpcStack);