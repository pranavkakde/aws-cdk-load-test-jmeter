import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ec2 from '@aws-cdk/aws-ec2';
import {SubnetSelection} from '@aws-cdk/aws-ec2';
import { EcsOptimizedImage, Volume, MountPoint } from '@aws-cdk/aws-ecs';
import * as ecr from "@aws-cdk/aws-ecr";
import { 
  ManagedPolicy, 
  Role, 
  ServicePrincipal, 
  PolicyStatement, 
  Effect  
} from '@aws-cdk/aws-iam';
import {UserData} from '@aws-cdk/aws-ec2';
import { VPCStackProps } from './vpc-stack';

export class LoadGenStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, vpcProps: VPCStackProps) {
    super(scope, id, vpcProps);
    
    const portList = [443,80,1099,50000,51000,51001,51002];
    //create log driver
    const logging = new ecs.AwsLogDriver({
      streamPrefix: "loadgen",
    });

    
    //create an ecs cluster
    const cluster = new ecs.Cluster(this, 'loadgen-cluster', {
      vpc: vpcProps.vpc
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
          'logs:CreateLogGroups'
        ]
      })
    );
    const fargateTaskDef = new ecs.FargateTaskDefinition(this, "FG-TaskDef", {            
      memoryLimitMiB: 1024,
      cpu: 256,
      taskRole: ecsServiceRole,
      executionRole: ecsServiceRole      
    });

    const ecrRepository = ecr.Repository.fromRepositoryName(this,'ecrrepository','aws-cdk/assets');
    const fargateContainer = fargateTaskDef.addContainer('client-container', {      
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
    
    portList.map((portNumber, index, arr) => {
      fargateContainer.addPortMappings({
        hostPort: portNumber,
        containerPort: portNumber,
        protocol: ecs.Protocol.TCP
      });
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
      securityGroup: vpcProps.securityGroup,
      assignPublicIp: true
    });
    

    const ec2InstanceRole1 = new Role(this, 'ec2IntanceRoleCDK', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com')
    });
    ec2InstanceRole1.addToPolicy(
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
          'ec2:DescribeTags',
          'ecs:CreateCluster',
          'ecs:DeregisterContainerInstance',
          'ecs:DiscoverPollEndpoint',
          'ecs:Poll',
          'ecs:RegisterContainerInstance',
          'ecs:StartTelemetrySession',
          'ecs:UpdateContainerInstancesState',
          'ecs:Submit*',
          'ecs:*',
          's3:*',
          'ec2:Describe*',
          'cloudwatch:ListMetrics',
          'cloudwatch:GetMetricStatistics',
          'cloudwatch:Describe*',
          'autoscaling:Describe*'
        ]
      })
    );

    //launch an ec2 instance
    const userData = UserData.forOperatingSystem(ec2.OperatingSystemType.LINUX);
    const connectToCluster = `echo ECS_CLUSTER=${cluster.clusterName} >> /etc/ecs/ecs.config`;
    userData.addCommands(connectToCluster);
    userData.addCommands('echo `curl -s http://169.254.169.254/latest/meta-data/instance-id`');
    userData.addCommands('yum install -y aws-cli');    
    userData.addCommands('aws ecr get-login --region us-east-1 --no-include-email | sh')
    userData.addCommands('export _JAVA_OPTIONS=\'-Djava.net.preferIPv4Stack=true -Djava.net.preferIPv6Addresses=false -Djava.net.preferIPv4Addresses=true\'');
    userData.addCommands('instanceid=\`curl -s http://169.254.169.254/latest/meta-data/instance-id\`');
    userData.addCommands('ipa=\`curl -s http://169.254.169.254/latest/meta-data/local-ipv4\`');
    const getS3File = `aws s3 cp ${vpcProps.s3bucket.s3UrlForObject()}/TestPlan.jmx /home/ec2-user/TestPlan.jmx`;
    const echoS3 = `echo ${getS3File}`;    
    userData.addCommands(echoS3);
    userData.addCommands(getS3File);
    userData.addCommands('echo $ipa');
    userData.addCommands('echo $instanceid');
    const getIPs = `aws ecs list-tasks --cluster ${cluster.clusterName} --region us-east-1 --query 'taskArns[]' --output text | 
                    while read line;
                    do loadgenRemoteIPs=\`aws ecs describe-tasks --cluster ${cluster.clusterName} --region us-east-1 --tasks $line --query 'tasks[].containers[].networkInterfaces[].privateIpv4Address' --output text\`;
                    echo $loadgenRemoteIPs;
                    done`;    
    userData.addCommands(getIPs);    
    const imagePath = `${ecrRepository.repositoryUri}:latest`
    const dockerCmd = `docker run --network host --mount type=bind,source=/home/ec2-user,target=/tmp ${imagePath} jmeter -n -t /tmp/TestPlan.jmx -l /tmp/outfile.jtl -j /tmp/jmeter.log -R $loadgenRemoteIPs -Dserver.port=1099 -Dclient.rmi.localport=51000 -Dserver.rmi.localport=50000 -Lorg.apache.jmeter.protocol.http.control=TRACE -Lorg.apache.http=TRACE -LTRACE -Jserver.rmi.ssl.disable=true -Djava.rmi.server.hostname=$ipa`
    const echoDocker = `echo ${dockerCmd}`;
    userData.addCommands(echoDocker);
    userData.addCommands(dockerCmd);

    const pubSubnet:SubnetSelection={      
      subnets: vpcProps.vpc.publicSubnets
    }  
    
    const controller = new ec2.Instance(this, 'controller',{
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: EcsOptimizedImage.amazonLinux(),
      vpc: vpcProps.vpc,
      userData,
      vpcSubnets: pubSubnet,
      securityGroup: vpcProps.securityGroup,
      role: ec2InstanceRole1    
    });
        
    /*const volume:Volume = {
      name:'jmetervol',
      host: {
        sourcePath: "/tmp"
      }
    }
    const ec2TaskDef = new ecs.Ec2TaskDefinition(this, "Ec2TaskDef", {
      taskRole: ecsServiceRole,
      networkMode: ecs.NetworkMode.AWS_VPC,
      executionRole: ecsServiceRole ,
      volumes: [volume]         
    });

    //create a new ec2 instance
    const cap = cluster.addCapacity('controller',{
      instanceType: new ec2.InstanceType('t2.micro'),
      desiredCapacity: 1,
      machineImage: EcsOptimizedImage.amazonLinux(),  
      canContainersAccessInstanceRole: true       
    });
    
    const userData = `
      #!/bin/bash
      yum install -y aws-cli
      export _JAVA_OPTIONS=\'-Djava.net.preferIPv4Stack=true -Djava.net.preferIPv6Addresses=false -Djava.net.preferIPv4Addresses=true\'
      echo \`curl -s http://169.254.169.254/latest/meta-data/instance-id\`    
      instanceid=\`curl -s http://169.254.169.254/latest/meta-data/instance-id\`
      ipa=\`curl -s http://169.254.169.254/latest/meta-data/local-ipv4\`      
      aws s3 cp ${s3bucket.bucketArn}/TestPlan.jmx /tmp/TestPlan.jmx
      loadgenRemoteIPs="10.0.0.1"
    `

    cap.addUserData(userData);

    const ec2Container = ec2TaskDef.addContainer('server-container', {      
      image: ecs.ContainerImage.fromEcrRepository(ecrRepository,'latest'),
      logging,
      command: [
                "jmeter -n -t /tmp/TestPlan.jmx -l /tmp/outfile.jtl -j /tmp/jmeter.log",
                "-R $loadgenRemoteIPs",
                "-Jserver.rmi.ssl.disable=true", 
                "-Dserver.port=1099", 
                "-Dserver.rmi.localport=50000",
                "-Dclient.rmi.localport=51000",                
                "-Lorg.apache.jmeter.protocol.http.control=TRACE",
                "-Lorg.apache.http=TRACE",
                "-Djava.rmi.server.hostname=$ipa"
            ],
      memoryLimitMiB:2048      
    });
    //add enviroment variables    
    const mountPoints:MountPoint={
      containerPath:"/tmp",
      readOnly:false,
      sourceVolume: "jmetervol"
    }
    ec2Container.addMountPoints(mountPoints);
    portList.map((portNumber, index, arr) => {
      ec2Container.addPortMappings({
        hostPort: portNumber,
        containerPort: portNumber,
        protocol: ecs.Protocol.TCP
      });
    });
    ec2Container.addPortMappings({
      hostPort: 4445,
      containerPort: 4445,
      protocol: ecs.Protocol.UDP
    });
    const pubSubnet:SubnetSelection={      
      subnets:vpc.publicSubnets      
    }    
    const ec2Service = new ecs.Ec2Service(this, 'Ec2Service', {
      cluster,
      taskDefinition: ec2TaskDef,
      desiredCount:1,
      securityGroup,
      vpcSubnets: pubSubnet,
      assignPublicIp: true      
    });
    */
  }
}
