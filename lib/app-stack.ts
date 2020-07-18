import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ec2 from '@aws-cdk/aws-ec2';
import { EcsOptimizedAmi, EcsOptimizedImage } from '@aws-cdk/aws-ecs';

export class AwsCdkLoadTestJmeterStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "loadgen-vpc", {
      maxAzs: 1 
    });

    const cluster = new ecs.Cluster(this, "loadgen-cluster", {
      vpc: vpc
    });

    cluster.addCapacity('newcap',{
      instanceType: new ec2.InstanceType("t2.micro"),
      desiredCapacity: 1,
      machineImage: EcsOptimizedImage.amazonLinux()
    });

    const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');

    taskDefinition.addContainer('DefaultContainer', {
      image: ecs.ContainerImage.fromAsset("./jmeter-server-image/"),
      memoryLimitMiB: 1024,
    });

  }
}
