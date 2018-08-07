/*
 * Copyright 2018, James Nugent.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at
 * http://mozilla.org/MPL/2.0/.
 */

import * as aws from "@pulumi/aws";
import { all, asset, ComponentResource, Output, ResourceOptions } from "@pulumi/pulumi";

/**
 * The Let's Encrypt ACME v2 Staging URL
 */
export const letsEncryptV2StagingUrl = "https://acme-staging-v02.api.letsencrypt.org/directory";

/**
 * The Let's Encrypt ACME v2 Production URL
 */
export const letsEncryptV2ProductionUrl = "https://acme-v02.api.letsencrypt.org/directory";

/**
 * Tags is a dictionary object representing tags to be applied to an AWS resource.
 */
export interface Tags {
    [name: string]: string;
}

/**
 * `LambdaCertInputs` represents the arguments which can be specified for a `LambdaCert`
 * component.
 */
export interface LambdaCertInputs {
    /**
     * A human-friendly description of the purpose of the TLS keys. Used in tags.
     */
    description: string;

    /**
     * A collection of tags which will be applied to every object which supports tagging.
     * Avoid using `Name`, since this will be overridden by many resources.
     */
    baseTags: Tags;

    /**
     * The part of the domain name for which a certificate is required which does _not_
     * form part of the hosted zone name. For example, if requesting a certificate for
     * `*.vault.operator-error.com`, and the public hosted zone is for `operator-error.com`,
     * `domainNamePrefix` should be set to `*.vault` (without a trailing `.`).
     */
    domainNamePrefix: string;
    /**
     * The part of the domain name for which a certificate is required which is included
     * in the hosted zone name.
     */
    route53DomainName: string;

    /**
     * The admin email address to provide to the ACME service when creating an account.
     */
    adminEmail: string;
    /**
     * The URL of the ACME server. By default, this is set to the staging endpoint of
     * [Let's Encrypt](https://letsencrypt.org).
     */
    acmeUrl?: string;

    /**
     * If set to true, add the certificate to an Java KeyStore encrypted with the same
     * KMS key as the private key, and uploaded to the bucket along with the certificate
     * and encrypted private key..
     */
    generateJavaKeyStore?: boolean;
    /**
     * If set to true, force delete the entire contents of the bucket when destroying
     * the component using Pulumi. This can be useful for quick iteration in development
     * when using a staging endpoint, though be wary of rate limits when using a real
     * ACME service.
     */
    emptyBucketOnDestroy?: boolean;
}

/**
 * `LambdaCertOutputs` represents the important values resulting from creation of a
 * `LambdaCert` component.
 */
export interface LambdaCertOutputs {
    /**
     * The ARN of the bucket in which TLS certificates and keys will be stored.
     */
    keyBucketArn: Output<string>;

    /**
     * The name of the bucket in which TLS certificates and keys will be stored.
     */
    keyBucketName: Output<string>;

    /**
     * The ARN of the KMS key with which TLS private keys are encrypted.
     */
    kmsKeyArn: Output<string>;

    /**
     * The Key ID of the KMS key with which TLS private keys are encrypted.
     */
    kmsKeyId: Output<string>;
}

/**
 * LambdaCert is a Pulumi component which creates the necessary resources to run
 * `lambda-cert` for a given domain name.
 */
export class LambdaCert extends ComponentResource implements LambdaCertOutputs {
    public keyBucketArn: Output<string>;
    public keyBucketName: Output<string>;
    public kmsKeyArn: Output<string>;
    public kmsKeyId: Output<string>;

    public static async create(name: string, inputs: LambdaCertInputs,
                               opts?: ResourceOptions): Promise<LambdaCert> {
        const instance = new LambdaCert(`${name}-lambda-cert`, inputs, opts);
        const instanceParent = {parent: instance};

        const releaseURL = "https://github.com/jen20/lambda-cert/releases/download/v1.1.0/lambda-cert.zip";

        const acmeUrl = inputs.acmeUrl || letsEncryptV2StagingUrl;

        const baseName = name.toLowerCase();
        const completeName = `${inputs.domainNamePrefix}.${inputs.route53DomainName}`;

        const route53Zone = await aws.route53.getZone({
            name: inputs.route53DomainName,
            privateZone: false,
        });

        const callerAccountId = (await aws.getCallerIdentity()).accountId;
        const accountRootARN = `arn:aws:iam::${callerAccountId}:root`;

        const kmsKeyPolicy: aws.iam.PolicyDocument = {
            Version: "2012-10-17",
            Statement: [
                {
                    Sid: "Delegate Key Access to IAM",
                    Effect: "Allow",
                    Principal: {AWS: accountRootARN},
                    Action: ["kms:*"],
                    Resource: ["*"],
                },
            ],
        };

        const kmsKeyTags = Object.assign({
            Name: `${inputs.description} TLS Keys`,
        }, inputs.baseTags);

        const kmsKey = new aws.kms.Key(`${baseName}-lambda-cert-kms-key`, {
            deletionWindowInDays: 7,
            description: `Certificate encryption key for ${inputs.description}`,
            policy: JSON.stringify(kmsKeyPolicy),
            tags: kmsKeyTags,
        }, instanceParent);

        instance.kmsKeyArn = kmsKey.arn;
        instance.kmsKeyId = kmsKey.id;

        const bucketTags = Object.assign({
            Name: `${inputs.description} TLS Keys`,
        }, inputs.baseTags);

        const keyBucket = new aws.s3.Bucket(`${baseName}-lambda-cert-bucket`, {
            bucket: `${baseName}-tls-keys`,
            acl: "private",
            tags: bucketTags,
            forceDestroy: !!inputs.emptyBucketOnDestroy,
        }, instanceParent);

        instance.keyBucketArn = keyBucket.arn;
        instance.keyBucketName = keyBucket.bucket;

        const lambdaAssumePolicy = aws.iam.assumeRolePolicyForPrincipal({
            Service: "lambda.amazonaws.com",
        });

        const lambdaRole = new aws.iam.Role(`${baseName}-lambda-cert-function-role`, {
            assumeRolePolicy: JSON.stringify(lambdaAssumePolicy),
            path: `/${baseName}/`,
        }, instanceParent);
        const roleParent = {parent: lambdaRole};

        const lambdaPolicy = await all([kmsKey.arn, keyBucket.arn])
            .apply(([kmsARN, bucketARN]) => {
                const policy: aws.iam.PolicyDocument = {
                    Version: "2012-10-17",
                    Statement: [
                        {
                            Sid: "AllowLambdaLogging",
                            Effect: "Allow",
                            Action: [
                                "logs:CreateLogGroup",
                                "logs:CreateLogStream",
                                "logs:PutLogEvents",
                            ],
                            Resource: [
                                "arn:aws:logs:*:*:*",
                            ],
                        },
                        {
                            Sid: "AllowEncryptDecrypt",
                            Effect: "Allow",
                            Action: [
                                "kms:Encrypt",
                                "kms:Decrypt",
                                "kms:GenerateDataKey",
                            ],
                            Resource: [
                                kmsARN,
                            ],
                        },
                        {
                            Sid: "AllowDNS01Verification",
                            Effect: "Allow",
                            Action: [
                                "route53:GetChange",
                                "route53:ListHostedZonesByName",
                            ],
                            Resource: ["*"],
                        },
                        {
                            Sid: "AllowDNS01Modification",
                            Effect: "Allow",
                            Action: ["route53:ChangeResourceRecordSets"],
                            Resource: [
                                `arn:aws:route53:::hostedzone/${route53Zone.id}`,
                            ],
                        },
                        {
                            Sid: "AllowBucketReadWrite",
                            Effect: "Allow",
                            Action: [
                                "s3:GetObject",
                                "s3:PutObject",
                            ],
                            Resource: [
                                `${bucketARN}/config/config.json.enc`,
                                `${bucketARN}/${completeName}/cert.crt`,
                                `${bucketARN}/${completeName}/cert.key.enc`,
                                `${bucketARN}/${completeName}/keystore.jks`,
                            ],
                        },
                    ],
                };
                return JSON.stringify(policy);
            });

        const lambdaRolePolicy = new aws.iam.RolePolicy(`${baseName}-lambda-cert-function-policy`, {
            role: lambdaRole,
            policy: lambdaPolicy,
        }, roleParent);

        const certOpts = Object.assign({
            dependsOn: [lambdaRolePolicy],
        }, instanceParent);

        const environment = all([keyBucket.bucket, kmsKey.keyId])
            .apply(([bucketName, kmsKeyId]) => {
                const variables: any = {
                    ACME_SERVER_URL: acmeUrl,
                    KMS_KEY_ID: kmsKeyId,
                    BUCKET_NAME: bucketName,
                    CERTIFICATE_NAME: `${inputs.domainNamePrefix}.${inputs.route53DomainName}`,
                    ADMIN_EMAIL: inputs.adminEmail,
                };

                if (inputs.generateJavaKeyStore) {
                    variables.GENERATE_JAVA_KEYSTORE = true;
                }

                return variables;
            });

        const certTags = Object.assign({
            Name: `Maintain TLS Keys for ${inputs.description}`,
        }, inputs.baseTags);

        const certFunction = new aws.lambda.Function(`${baseName}-lambda-cert-function`, {
            description: `Maintain TLS Certificate for ${inputs.description}`,
            runtime: aws.lambda.Go1dxRuntime,
            code: new asset.RemoteArchive(releaseURL),
            handler: "lambda-cert",
            role: lambdaRole.arn,
            timeout: 300,
            environment: {
                variables: environment,
            },
            tags: certTags,
        }, certOpts);

        const triggerOpts = Object.assign({
            dependsOn: [certFunction],
        }, instanceParent);
        const trigger = new aws.cloudwatch.EventRule(`${baseName}-lambda-cert-schedule`, {
            description: `Check ${inputs.description} TLS Cert Status`,
            scheduleExpression: "rate(12 hours)",
        }, triggerOpts);

        const triggerParent = {parent: trigger};
        new aws.cloudwatch.EventTarget(`${baseName}-lambda-cert-target`, {
            rule: trigger.name,
            targetId: certFunction.name,
            arn: certFunction.arn,
        }, triggerParent);

        const lambdaParent = {parent: certFunction};
        new aws.lambda.Permission(`${baseName}-lambda-cert-permission`, {
            statementId: "AllowExecutionFromCloudWatch",
            action: "lambda:InvokeFunction",
            function: certFunction,
            principal: "events.amazonaws.com",
            sourceArn: trigger.arn,
        }, lambdaParent);

        return instance;
    }

    private constructor(name: string, inputs: LambdaCertInputs, opts?: ResourceOptions) {
        super("operator-error:aws:LambdaCert", name, inputs, opts);

        this.registerOutputs({
            keyBucketArn: this.keyBucketArn,
            keyBucketName: this.keyBucketName,
            kmsKeyArn: this.kmsKeyArn,
            kmsKeyId: this.kmsKeyId,
        });
    }
}
