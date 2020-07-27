import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ec2 from '@aws-cdk/aws-ec2';
import {SubnetSelection} from '@aws-cdk/aws-ec2';
import { EcsOptimizedImage, Volume, MountPoint } from '@aws-cdk/aws-ecs';
import { 
  ManagedPolicy, 
  Role, 
  ServicePrincipal, 
  PolicyStatement, 
  Effect  
} from '@aws-cdk/aws-iam';
import {UserData} from '@aws-cdk/aws-ec2';
import {LoadGenStackProps} from './app-stack';
import * as config from '../config.json';

export class EC2Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: LoadGenStackProps) {
    super(scope, id, props);   
    
    //create log driver
    const logging = new ecs.AwsLogDriver({
      streamPrefix: "controller",
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
            'ecs:List*',
            'ecs:Describe*',
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
      const connectToCluster = `echo ECS_CLUSTER=${props.cluster.clusterName} >> /etc/ecs/ecs.config`;
      userData.addCommands(connectToCluster);
      userData.addCommands('echo `curl -s http://169.254.169.254/latest/meta-data/instance-id`');
      userData.addCommands('yum install -y aws-cli');    
      userData.addCommands('aws ecr get-login --region us-east-1 --no-include-email | sh')
      userData.addCommands('export _JAVA_OPTIONS=\'-Djava.net.preferIPv4Stack=true -Djava.net.preferIPv6Addresses=false -Djava.net.preferIPv4Addresses=true\'');      
      userData.addCommands('ipa=\`curl -s http://169.254.169.254/latest/meta-data/local-ipv4\`');
      const getS3File = `aws s3 cp ${props.vpcStackProps.s3bucket.s3UrlForObject()}/TestPlan.jmx /home/ec2-user/TestPlan.jmx`;
      const echoS3 = `echo ${getS3File}`;    
      userData.addCommands(echoS3);
      userData.addCommands(getS3File);
      userData.addCommands('echo $ipa');      
      const getTask = `tasklist=\`aws ecs list-tasks --cluster ${props.cluster.clusterName} --region us-east-1 --query 'taskArns[]' --output text\``;      
      userData.addCommands(getTask);
      userData.addCommands('echo $tasklist');
      const getIPs = `ips=\`aws ecs describe-tasks --cluster ${props.cluster.clusterName} --region us-east-1 --tasks $tasklist --query 'tasks[].containers[].networkInterfaces[].privateIpv4Address' --output text\``;      
      userData.addCommands(getIPs);
      userData.addCommands('echo $ips');
      const replaceComma='loadgenRemoteIPs=`echo $ips | sed \'s/\\s/,/g\'`';
      userData.addCommands(`echo ${replaceComma}`);
      userData.addCommands(replaceComma);
      userData.addCommands('echo $loadgenRemoteIPs');
      const imagePath = `${props.ecrRepository.repositoryUri}:latest`;
      const dockerCmd = `docker run --network host --mount type=bind,source=/home/ec2-user,target=/tmp ${imagePath} jmeter -n -t /tmp/TestPlan.jmx -l /tmp/outfile.jtl -j /tmp/jmeter.log -R $loadgenRemoteIPs -Dserver.port=1099 -Dclient.rmi.localport=51000 -Dserver.rmi.localport=50000 -Lorg.apache.jmeter.protocol.http.control=TRACE -Lorg.apache.http=TRACE -LTRACE -Jserver.rmi.ssl.disable=true -Djava.rmi.server.hostname=$ipa`;
      const echoDocker = `echo ${dockerCmd}`;
      userData.addCommands(echoDocker);
      userData.addCommands(dockerCmd);
      const getReport = `aws s3 cp /home/ec2-user/outfile.jtl ${props.vpcStackProps.s3bucket.s3UrlForObject()}/outfile.jtl`;
      userData.addCommands(getReport);
  
      const pubSubnet:SubnetSelection={      
        subnets: props.vpcStackProps.vpc.publicSubnets
      }  
      
      const controller = new ec2.Instance(this, 'controller',{
        instanceType: new ec2.InstanceType('t2.small'),
        machineImage: EcsOptimizedImage.amazonLinux(),
        vpc: props.vpcStackProps.vpc,
        userData,
        vpcSubnets: pubSubnet,
        securityGroup: props.vpcStackProps.securityGroup,
        role: ec2InstanceRole1    
      });
      //#region ECS EC2 
        /*  ## Uncomment folllowing lines for creating ECS EC2 Service and Task ######
      const volume:Volume = {
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
      config.tcpPortList.map((portNumber, index, arr) => {
        ec2Container.addPortMappings({
          hostPort: portNumber,
          containerPort: portNumber,
          protocol: ecs.Protocol.TCP
        });
      });
      config.udpPortList.map((portNumber, index, arr) => {
        ec2Container.addPortMappings({
            hostPort: portNumber,
            containerPort: portNumber,
            protocol: ecs.Protocol.UDP
        });
      });
      const pubSubnet:SubnetSelection={      
        subnets: props.vpcStackProps.vpc.publicSubnets
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
     //#endregion
  }
}
