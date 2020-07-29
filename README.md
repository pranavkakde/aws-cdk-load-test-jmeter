# Load Test using aws cdk and JMeter

This project utilizes aws cdk to spin up ECS Cluser and FARGATE tasks as load generators. It runs JMeter scripts using docker images running on these FARGATE tasks. It uses and EC2 instance as a JMeter Server or controller. It logs all execution steps in Cloud Watch.
The project creates 3 stacks;
1. **VPCStack** which runs following tasks;
    * Creates VPCs, Subnets & Security Group
    * Creeats a S3 bucket and copies the Jmeter Test plan from local project to S3 bucket
2. **LoadGenStack** which runs following tasks;
    * Creates ECS Cluster
    * Creates FARGATE Tasks as load generators with docker image from ECR
3. **EC2Stack** which runs following tasks;
    * Creates EC2 instance and runs following actions in UserData;
        * Associates EC2 with ECS Cluster
        * Installs AWS CLI and copies JMeter Test Plan to local
        * Pulls Docker image for JMeter Server from ECR
        * Gets the IP Address of running FARGATE Tasks
        * Runs Jmeter Server with Test Plan and Remote IP addresses of FARGATE Tasks
        * Copies outfile.jtl to S3 Bucket after execution is complete

## How to run this project

1. Ensure that AWS KEY is setup either through .credentials file or through variables.
2. Ensure a Jmeter script file is created and available in *files* dir.
3. Update config.json to match the Jmeter file name and number of load generator tasks.
4. Clone this repo and run one of the commands.
5. Once all stacks are created, EC2 instance initiates Jmeter test execution which is added as part of its UserData.
6. Upon test execution an output file will also be generated and added to the S3 Bucket where Jmeter Test Plan is uploaded.
7. Destroying the stack does not destroy CloudWatch Logs and S3 bucket. You need to delete them manually.

## Useful commands

 * `npm run build`           builds the project
 * `npm run cdk synth`       emits the synthesized CloudFormation template for all Stacks
 * `npm run cdk deploy`      deploy all stacks to your default AWS account/region 
 * `npm run cdk destroy`     destroy all stacks from your default AWS account/region. It asks for permission to destroy stack.