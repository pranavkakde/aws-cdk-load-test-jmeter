import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ec2 from '@aws-cdk/aws-ec2';
import { EcsOptimizedAmi, EcsOptimizedImage } from '@aws-cdk/aws-ecs';
import ecr = require("@aws-cdk/aws-ecr");
import * as s3 from '@aws-cdk/aws-s3';
import { BlockPublicAccess } from '@aws-cdk/aws-s3';

import { 
  ManagedPolicy, 
  Role, 
  ServicePrincipal, 
  PolicyStatement, 
  Effect 
} from '@aws-cdk/aws-iam';
import {UserData} from '@aws-cdk/aws-ec2';

export class AwsCdkLoadTestJmeterStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    //create log driver
    const logging = new ecs.AwsLogDriver({
      streamPrefix: "loadgen",
    });

    //create a VPC
    const vpc = new ec2.Vpc(this, 'loadgen-vpc', {
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 1,
      cidr: '10.0.0.0/16'
    });

    const securityGroup = new ec2.SecurityGroup(this, 'loadgen-sg', { 
      vpc, 
      allowAllOutbound: true,
    });

    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(1099));
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(4445));
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(50000));
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(51000));
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(51001));
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(51002));
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));

    //create an ecs cluster
    const cluster = new ecs.Cluster(this, 'loadgen-cluster', {
      vpc: vpc
    });    
    
    const ecsServiceRole = new Role(this, 'TaskExecutionServiceRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com')
    });
    ecsServiceRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: ['*'],
        actions: [            
          'ecr:GetAuthorizationToken',
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:CreateLogGroups',
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
      })
    );
    const fargateTaskDef = new ecs.FargateTaskDefinition(this, "FG-TaskDef", {            
      memoryLimitMiB: 512,
      cpu: 256,
      taskRole: ecsServiceRole,
      executionRole: ecsServiceRole      
    });

    const ecrRepository = ecr.Repository.fromRepositoryName(this,'ecrrepository','aws-cdk/assets');
    const fargateContainer = fargateTaskDef.addContainer('client-container', {
      //image: ecs.ContainerImage.fromRegistry('456088684141.dkr.ecr.us-east-1.amazonaws.com/aws-cdk/assets:latest'),
      image: ecs.ContainerImage.fromEcrRepository(ecrRepository,'latest'),
      logging,
      command: [
                "jmeter-server", 
                "-Jserver.rmi.ssl.disable=true", 
                "-Dserver.port=1099", 
                "-Dserver.rmi.localport=50000",
                "-Dclient.rmi.localport=51000",
                "-LTRACE",
                "-Lorg.apache.jmeter.protocol.http.control=TRACE",
                "-Lorg.apache.http=TRACE"
            ]            
    });
    fargateContainer.addPortMappings({
      hostPort: 443,
      containerPort: 443,
      protocol: ecs.Protocol.TCP
    });
    fargateContainer.addPortMappings({
      hostPort: 80,
      containerPort: 80,
      protocol: ecs.Protocol.TCP
    });
    fargateContainer.addPortMappings({
      hostPort: 1099,
      containerPort: 1099,
      protocol: ecs.Protocol.TCP
    });
    fargateContainer.addPortMappings({
      hostPort: 50000,
      containerPort: 50000,
      protocol: ecs.Protocol.TCP
    });
    fargateContainer.addPortMappings({
      hostPort: 51000,
      containerPort: 51000,
      protocol: ecs.Protocol.TCP
    });
    fargateContainer.addPortMappings({
      hostPort: 51001,
      containerPort: 51001,
      protocol: ecs.Protocol.TCP
    });
    fargateContainer.addPortMappings({
      hostPort: 51002,
      containerPort: 51002,
      protocol: ecs.Protocol.TCP
    }); 
    fargateContainer.addPortMappings({
      hostPort: 4445,
      containerPort: 4445,
      protocol: ecs.Protocol.UDP
    });
    
    const fargateService = new ecs.FargateService(this, 'FargateService', {
      cluster,
      taskDefinition:fargateTaskDef,
      desiredCount:1,
      securityGroup,
      assignPublicIp: true
    });

    const s3bucket = new s3.Bucket(this,'jmeter-data', {
      blockPublicAccess: new BlockPublicAccess({ blockPublicPolicy: true })
    });    
    
    //launch an ec2 instance
    /*const userData = UserData.forOperatingSystem(ec2.OperatingSystemType.LINUX);
    const connectToCluster = `echo ECS_CLUSTER=${cluster.clusterName} >> /etc/ecs/ecs.config`;
    userData.addCommands(connectToCluster);
    userData.addCommands('echo `curl -s http://169.254.169.254/latest/meta-data/instance-id`');
    
    const controller = new ec2.Instance(this, 'controller',{
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: EcsOptimizedImage.amazonLinux(),
      vpc,
      userData      
    });
    */    
    const ec2TaskDef = new ecs.Ec2TaskDefinition(this, "Ec2TaskDef", {
      taskRole: ecsServiceRole,
      networkMode: ecs.NetworkMode.AWS_VPC,
      executionRole: ecsServiceRole      
    });


    const ec2Container = ec2TaskDef.addContainer('server-container', {      
      image: ecs.ContainerImage.fromEcrRepository(ecrRepository,'latest'),
      logging,
      command: [
                "jmeter-server", 
                "-Jserver.rmi.ssl.disable=true", 
                "-Dserver.port=1099", 
                "-Dserver.rmi.localport=50000",
                "-Dclient.rmi.localport=51000",
                "-LTRACE",
                "-Lorg.apache.jmeter.protocol.http.control=TRACE",
                "-Lorg.apache.http=TRACE"
            ],
      memoryLimitMiB:512      
    });
    //create a new ec2 instance
    cluster.addCapacity('controller',{
      instanceType: new ec2.InstanceType('t2.micro'),
      desiredCapacity: 1,
      machineImage: EcsOptimizedImage.amazonLinux(),  
      canContainersAccessInstanceRole: true            
    });

    const ec2Service = new ecs.Ec2Service(this, 'Ec2Service', {
      cluster,
      taskDefinition: ec2TaskDef,
      desiredCount:1,
      securityGroup            
    });

  }
}
