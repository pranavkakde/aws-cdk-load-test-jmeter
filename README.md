# Load Test using aws cdk and JMeter

This project utilizes aws cdk to spin up ECS Cluser and FARGATE tasks and run JMeter scripts using docker images running on these FARGATE tasks.
1. Creates VPCs, Subnets & Security Group
2. Creates ECS Cluster
3. Creates FARGATE Tasks as load generators
4. Creates EC2 instance in ECS Cluster for JMeter Controller
5. Builds Docker image for JMeter Server and Client
6. Pushes Docker images in ECR.
7. Uses Docker images for JMeter Server and Client to run load tests on FARGATE Tasks

## Useful commands

 * `npm run build`   compile typescript to js
 * `cdk synth`       emits the synthesized CloudFormation template
 * `cdk deploy`      deploy this stack to your default AWS account/region 