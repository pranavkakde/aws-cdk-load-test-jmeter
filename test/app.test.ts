import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as AwsCdkLoadTestJmeter from '../lib/app-stack';
import {VPCStack} from '../lib/vpc-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    const vpcStack = new VPCStack(app,'VPCStack');
    // WHEN
    const stack = new AwsCdkLoadTestJmeter.LoadGenStack(app, 'LoadGenStack', 
                      {vpc: vpcStack.vpc, securityGroup: vpcStack.securityGroup, s3bucket: vpcStack.s3bucket});
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
