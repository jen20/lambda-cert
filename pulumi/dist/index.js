"use strict";
/*
 * Copyright 2018, James Nugent.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at
 * http://mozilla.org/MPL/2.0/.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const aws = require("@pulumi/aws");
const pulumi_1 = require("@pulumi/pulumi");
/**
 * The Let's Encrypt ACME v2 Staging URL
 */
exports.letsEncryptV2StagingUrl = "https://acme-staging-v02.api.letsencrypt.org/directory";
/**
 * The Let's Encrypt ACME v2 Production URL
 */
exports.letsEncryptV2ProductionUrl = "https://acme-v02.api.letsencrypt.org/directory";
/**
 * LambdaCert is a Pulumi component which creates the necessary resources to run
 * `lambda-cert` for a given domain name.
 */
class LambdaCert extends pulumi_1.ComponentResource {
    static create(name, inputs, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const instance = new LambdaCert(`${name}-lambda-cert`, opts);
            const instanceParent = { parent: instance };
            const releaseURL = "https://github.com/jen20/lambda-cert/releases/download/v1.1.0/lambda-cert.zip";
            const acmeUrl = inputs.acmeUrl || exports.letsEncryptV2StagingUrl;
            const baseName = name.toLowerCase();
            const completeName = `${inputs.domainNamePrefix}.${inputs.route53DomainName}`;
            const route53Zone = yield aws.route53.getZone({
                name: inputs.route53DomainName,
                privateZone: false,
            });
            const callerAccountId = (yield aws.getCallerIdentity()).accountId;
            const accountRootARN = `arn:aws:iam::${callerAccountId}:root`;
            const kmsKeyPolicy = {
                Version: "2012-10-17",
                Statement: [
                    {
                        Sid: "Delegate Key Access to IAM",
                        Effect: "Allow",
                        Principal: { AWS: accountRootARN },
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
            const roleParent = { parent: lambdaRole };
            const lambdaPolicy = yield pulumi_1.all([kmsKey.arn, keyBucket.arn])
                .apply(([kmsARN, bucketARN]) => {
                const policy = {
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
            const environment = pulumi_1.all([keyBucket.bucket, kmsKey.keyId])
                .apply(([bucketName, kmsKeyId]) => {
                return {
                    ACME_SERVER_URL: acmeUrl,
                    KMS_KEY_ID: kmsKeyId,
                    BUCKET_NAME: bucketName,
                    CERTIFICATE_NAME: `${inputs.domainNamePrefix}.${inputs.route53DomainName}`,
                    ADMIN_EMAIL: inputs.adminEmail,
                    GENERATE_JAVA_KEYSTORE: inputs.generateJavaKeyStore ? "true" : "false",
                };
            });
            const certTags = Object.assign({
                Name: `Maintain TLS Keys for ${inputs.description}`,
            }, inputs.baseTags);
            const certFunction = new aws.lambda.Function(`${baseName}-lambda-cert-function`, {
                description: `Maintain TLS Certificate for ${inputs.description}`,
                runtime: aws.lambda.Go1dxRuntime,
                code: new pulumi_1.asset.RemoteArchive(releaseURL),
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
            const triggerParent = { parent: trigger };
            new aws.cloudwatch.EventTarget(`${baseName}-lambda-cert-target`, {
                rule: trigger.name,
                targetId: certFunction.name,
                arn: certFunction.arn,
            }, triggerParent);
            const lambdaParent = { parent: certFunction };
            new aws.lambda.Permission(`${baseName}-lambda-cert-permission`, {
                statementId: "AllowExecutionFromCloudWatch",
                action: "lambda:InvokeFunction",
                function: certFunction,
                principal: "events.amazonaws.com",
                sourceArn: trigger.arn,
            }, lambdaParent);
            return instance;
        });
    }
    constructor(name, opts) {
        super("operator-error:aws:LambdaCert", name, {}, opts);
    }
}
exports.LambdaCert = LambdaCert;
//# sourceMappingURL=index.js.map