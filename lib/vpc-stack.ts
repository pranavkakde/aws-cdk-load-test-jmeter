import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import { Ec2Service } from '@aws-cdk/aws-ecs';
import * as s3 from '@aws-cdk/aws-s3';
import { BlockPublicAccess } from '@aws-cdk/aws-s3';
import * as s3deploy from '@aws-cdk/aws-s3-deployment';
import { ServerHttp2Session } from 'http2';

export interface VPCStackProps extends cdk.StackProps {
    vpc: ec2.IVpc,
    securityGroup: ec2.ISecurityGroup,
    s3bucket: s3.IBucket    
}

export class VPCStack extends cdk.Stack {
    readonly vpc: ec2.IVpc;
    readonly securityGroup: ec2.ISecurityGroup;
    readonly s3bucket: s3.IBucket;

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
      super(scope, id, props);
      
        const portList = [443,80,1099,50000,51000,51001,51002];  
        //create a VPC
        this.vpc = new ec2.Vpc(this, 'loadgen-vpc', {
            enableDnsHostnames: true,
            enableDnsSupport: true,
            maxAzs: 1,
            cidr: '10.0.0.0/16'
        });
        const vpcId = this.vpc
        this.securityGroup = new ec2.SecurityGroup(this, 'loadgen-sg', { 
            vpc: vpcId, 
            allowAllOutbound: true,
        });
        
        portList.map((portNumber, index, arr) => {
            this.securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(portNumber));      
        });
        this.securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(4445));

        this.s3bucket = new s3.Bucket(this,'jmeter-data', {
            blockPublicAccess: new BlockPublicAccess({ blockPublicPolicy: true })
          });    
          
        const s3dep = new s3deploy.BucketDeployment(this, 'jmeterfiles', {
        sources: [s3deploy.Source.asset('./files')],       
        destinationBucket: this.s3bucket
        });
    }
}