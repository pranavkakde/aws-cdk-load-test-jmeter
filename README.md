# Load Test using aws cdk and JMeter

This project utilizes aws cdk to spin up ECS Cluser and FARGATE tasks as load generators. It runs JMeter scripts using docker images running on these FARGATE tasks. It uses and EC2 instance as a JMeter Server or controller. It logs all execution steps in Cloud Watch.
The project creates 3 stacks;
1. VPCStack which runs following tasks;
    a. Creates VPCs, Subnets & Security Group
    b. Creeats a S3 bucket and copies the Jmeter Test plan from local project to S3 bucket
2. LoadGenStack which runs following tasks;
    a. Creates ECS Cluster
    b. Creates FARGATE Tasks as load generators
3. EC2Stack which runs following tasks;
    a. Creates EC2 instance and runs following actions in UserData;
          i. Associates EC2 with ECS Cluster
         ii. Installs AWS CLI and copies JMeter Test Plan to local
        iii. Pulls Docker image for JMeter Server from ECR
         iv. Gets the IP Address of running FARGATE Tasks
          v. Runs Jmeter Server with Test Plan and Remote IP addresses of FARGATE Tasks
         vi. Copies outfile.jtl to S3 Bucket after execution is complete

## Useful commands

 * `npm run build`   compile typescript to js
 * `cdk synth`       emits the synthesized CloudFormation template
 * `cdk deploy`      deploy this stack to your default AWS account/region 