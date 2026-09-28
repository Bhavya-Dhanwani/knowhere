import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

// Media buckets in their own AWS account (deployed with that account's credentials). Only the
// app account's storage role (the EKS service account used by course/media services) gets in.

export interface MediaStackProps extends StackProps {
  // the account running the app (EKS)
  appAccount: string;
  // browsers upload / stream from this origin (presigned URLs, cross-origin)
  appOrigin: string;
}

// names both stacks agree on without cross-account references
export const mediaBucketName = (kind: 'raw' | 'transcoded', account: string, region: string) =>
  `knowhere-${kind}-${account}-${region}`;

// CloudFormation names the app's storage role "Knowhere-ClusterStorageSaRole<hash>-<suffix>"
export const storageRoleArnPattern = (appAccount: string) =>
  `arn:aws:iam::${appAccount}:role/Knowhere-ClusterStorageSaRole*`;

export class KnowhereMediaStack extends Stack {
  constructor(scope: Construct, id: string, props: MediaStackProps) {
    super(scope, id, props);
    for (const kind of ['raw', 'transcoded'] as const) {
      const bucket = new s3.Bucket(this, `${kind}Bucket`, {
        bucketName: mediaBucketName(kind, this.account, this.region),
        encryption: s3.BucketEncryption.S3_MANAGED, // SSE-S3: no key policy needed cross-account
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        // objects written by the app account still belong to this account
        objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
        removalPolicy: RemovalPolicy.RETAIN,
        cors: [
          {
            allowedOrigins: [props.appOrigin],
            allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.HEAD],
            allowedHeaders: ['*'],
            exposedHeaders: ['ETag', 'Content-Length', 'Content-Range'],
            maxAge: 3600
          }
        ]
      });
      const onlyStorageRole = {
        ArnLike: { 'aws:PrincipalArn': storageRoleArnPattern(props.appAccount) }
      };
      bucket.addToResourcePolicy(
        new iam.PolicyStatement({
          principals: [new iam.AccountPrincipal(props.appAccount)],
          actions: ['s3:ListBucket', 's3:GetBucketLocation'],
          resources: [bucket.bucketArn],
          conditions: onlyStorageRole
        })
      );
      bucket.addToResourcePolicy(
        new iam.PolicyStatement({
          principals: [new iam.AccountPrincipal(props.appAccount)],
          actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:AbortMultipartUpload'],
          resources: [bucket.arnForObjects('*')],
          conditions: onlyStorageRole
        })
      );
      new CfnOutput(this, `${kind}BucketName`, { value: bucket.bucketName });
    }
  }
}
