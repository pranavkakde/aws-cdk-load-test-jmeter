#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { LoadGenStack } from '../lib/app-stack';
import {VPCStack} from '../lib/vpc-stack';
import {EC2Stack} from '../lib/ec2-stack';

const app = new cdk.App();
const vpcStack = new VPCStack(app,'VPCStack');
const loadgenStack = new LoadGenStack(app, 'LoadGenStack',{vpc: vpcStack.vpc, securityGroup: vpcStack.securityGroup, s3bucket: vpcStack.s3bucket});
const ec2Stack = new EC2Stack(app, 'EC2Stack', {cluster: loadgenStack.cluster, ecrRepository: loadgenStack.ecrRepository, vpcStackProps: loadgenStack.vpcStackProp});
loadgenStack.addDependency(vpcStack);
ec2Stack.addDependency(vpcStack);