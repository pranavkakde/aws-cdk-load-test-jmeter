import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecr from "@aws-cdk/aws-ecr";
import { 
  Role, 
  ServicePrincipal, 
  PolicyStatement, 
  Effect  
} from '@aws-cdk/aws-iam';
import { VPCStackProps } from './vpc-stack';
import * as config from '../config.json';

export interface LoadGenStackProps extends cdk.StackProps {
  vpcStackProps: VPCStackProps,  
  cluster: ecs.ICluster,
  ecrRepository: ecr.IRepository
}

export class LoadGenStack extends cdk.Stack {
  readonly vpcStackProp: VPCStackProps;
  readonly cluster: ecs.ICluster;
  readonly ecrRepository: ecr.IRepository;

  constructor(scope: cdk.Construct, id: string, vpcProps: VPCStackProps) {
    super(scope, id, vpcProps);
    
    this.vpcStackProp = vpcProps;    
    
    //create log driver
    const logging = new ecs.AwsLogDriver({
      streamPrefix: "loadgen",
    });

    
    //create an ecs cluster
    this.cluster = new ecs.Cluster(this, 'loadgen-cluster', {
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

    this.ecrRepository = ecr.Repository.fromRepositoryName(this,'ecrrepository','aws-cdk/assets');
    const fargateContainer = fargateTaskDef.addContainer('client-container', {      
      image: ecs.ContainerImage.fromEcrRepository(this.ecrRepository,'latest'),
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
    
    config.tcpPortList.map((portNumber, index, arr) => {
      fargateContainer.addPortMappings({
        hostPort: portNumber,
        containerPort: portNumber,
        protocol: ecs.Protocol.TCP
      });
    });
    config.udpPortList.map((portNumber, index, arr) => {
      fargateContainer.addPortMappings({
        hostPort: portNumber,
        containerPort: portNumber,
        protocol: ecs.Protocol.UDP
      });
    });
    
    const fargateService = new ecs.FargateService(this, 'FargateService', {
      cluster: this.cluster,
      taskDefinition: fargateTaskDef,
      desiredCount: config.fargate.taskCount,
      securityGroup: vpcProps.securityGroup,
      assignPublicIp: true
    });

  }
}
