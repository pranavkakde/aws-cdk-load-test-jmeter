import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as s3 from '@aws-cdk/aws-s3';
import { BlockPublicAccess, BucketPolicy, CfnAccessPoint } from '@aws-cdk/aws-s3';
import * as s3deploy from '@aws-cdk/aws-s3-deployment';
import * as config from '../config.json';
import { RemovalPolicy, CfnOutput, cfnTagToCloudFormation } from '@aws-cdk/core';
import { isNull } from 'util';

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
        
        config.tcpPortList.map((portNumber, index, arr) => {
            this.securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(portNumber));      
        });
        
        config.udpPortList.map((portNumber, index, arr) => {
            this.securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(portNumber));
        });
        
        this.s3bucket = new s3.Bucket(this,'jmeter-data', {
            blockPublicAccess: new BlockPublicAccess({ blockPublicPolicy: true }),
            //removalPolicy: RemovalPolicy.DESTROY
        });   

        const s3dep = new s3deploy.BucketDeployment(this, 'jmeterfiles', {
            sources: [s3deploy.Source.asset('./files')],       
            destinationBucket: this.s3bucket
        });          
    }
}