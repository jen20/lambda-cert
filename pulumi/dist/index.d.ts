import { ComponentResource, Output, ResourceOptions } from "@pulumi/pulumi";
/**
 * The Let's Encrypt ACME v2 Staging URL
 */
export declare const letsEncryptV2StagingUrl = "https://acme-staging-v02.api.letsencrypt.org/directory";
/**
 * The Let's Encrypt ACME v2 Production URL
 */
export declare const letsEncryptV2ProductionUrl = "https://acme-v02.api.letsencrypt.org/directory";
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
export declare class LambdaCert extends ComponentResource implements LambdaCertOutputs {
    keyBucketArn: Output<string>;
    keyBucketName: Output<string>;
    kmsKeyArn: Output<string>;
    kmsKeyId: Output<string>;
    static create(name: string, inputs: LambdaCertInputs, opts?: ResourceOptions): Promise<LambdaCert>;
    private constructor();
}
