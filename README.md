# web-service

A simple web service for AtDex application

- build AMI
```
Packer build ami.prk.hcl
```

- create table
```
<!-- aws dynamodb create-table \
    --table-name test-events \
    --attribute-definitions AttributeName=UserID,AttributeType=S AttributeName=TransactionHash,AttributeType=S \
    --key-schema AttributeName=UserID,KeyType=HASH AttributeName=TransactionHash,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST -->
aws dynamodb create-table \
    --table-name ADP1 \
    --attribute-definitions \
        AttributeName=UserID,AttributeType=S \
        AttributeName=Timestamp,AttributeType=N \
        AttributeName=EventType,AttributeType=S \
    --key-schema \
        AttributeName=UserID,KeyType=HASH \
        AttributeName=Timestamp,KeyType=RANGE \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --region us-east-1

aws dynamodb update-table \
    --table-name ADP1 \
    --attribute-definitions AttributeName=EventType,AttributeType=S AttributeName=Timestamp,AttributeType=N \
    --global-secondary-index-updates \
    "[{\"Create\":{\"IndexName\": \"EventTypeIndex\",\"KeySchema\":[{\"AttributeName\":\"EventType\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"Timestamp\",\"KeyType\":\"RANGE\"}],\"ProvisionedThroughput\": {\"ReadCapacityUnits\": 5,\"WriteCapacityUnits\": 5},\"Projection\":{\"ProjectionType\":\"ALL\"}}}]"

```

- delete table
```
aws dynamodb delete-table --table-name test-events --region us-east-1
```

- scan table
```
aws dynamodb scan --table-name test-events
```


# infrastructure



## command for configure profile
```
aws configure --profile=dev

aws configure --profile=demo

```

## command for creating vpc
```
aws ec2 create-vpc \
    --cidr-block 10.0.0.0/16 \
    --amazon-provided-ipv6-cidr-block
```

## command for creating stack
Use default ciderblock
```
aws cloudformation create-stack --profile=demo --stack-name myVpc --template-body file://adp-infra.yml
```

Use given ciderblock
```
<!-- aws cloudformation create-stack --profile=demo --stack-name myvpc --template-body file://adp-infra.yml --parameters ParameterKey=VpcCidrBlock,ParameterValue="10.0.0.0/16" ParameterKey=SubCidrBlockA,ParameterValue="10.0.0.0/24" ParameterKey=SubCidrBlockB,ParameterValue="10.0.1.0/24" ParameterKey=SubCidrBlockC,ParameterValue="10.0.2.0/24" ParameterKey=AMIid,ParameterValue="ami-00726cda799b175c2" -->

aws cloudformation create-stack --profile=demo --stack-name myVpc --template-body file://adp-infra.yml --parameters ParameterKey=VpcCIDR,ParameterValue="10.0.0.0/16" ParameterKey=AmazonImageID,ParameterValue="ami-00726cda799b175c2" --capabilities CAPABILITY_IAM


```

Use given AMIid
```
aws cloudformation create-stack --profile=demo --capabilities CAPABILITY_NAMED_IAM --template-body file://adp-infra.yml --parameters ParameterKey=AMIid,ParameterValue="ami-00726cda799b175c2" ParameterKey=CurrentProfile,ParameterValue="demo" --stack-name myVpc
```


## command for deleting stack
```
aws cloudformation delete-stack --profile=dev  --stack-name myVpc

aws cloudformation delete-stack --profile=demo  --stack-name myVpc
```

## Command for deleting bucket
```
aws --profile=dev s3 rm s3://79562bc0-5c21-11ed-aabd-027cfbe3a35b --recursive

aws --profile=demo s3 rm s3://79562bc0-5c21-11ed-aabd-027cfbe3a35b --recursive
```


## Other useful command
check ```AvailabilityZone``` for your profile
```
aws ec2 describe-availability-zones --profile=[profile_name]
```

### test line