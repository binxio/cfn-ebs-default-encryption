const AWS = require('aws-sdk');
const response = require('cfn-response');
const ec2 = new AWS.EC2();

async function respond(event, context, success) {
    const status = (success ? 'SUCCESS' : 'FAILED');
    return new Promise((resolve, reject) => {
        response.send(
            event,
            {
                logStreamName: context.logStreamName,
                done: () => { resolve() }
            },
            status
        );
    });
}

async function upsertEbsEncryption(kmsKeyId) {
    const promises = [];

    promises.push(ec2.enableEbsEncryptionByDefault().promise());

    switch (kmsKeyId) {
        case undefined:
        case "":
        case "aws/ebs":
            promises.push(ec2.resetEbsDefaultKmsKeyId().promise());
            break;
        default:
            promises.push(ec2.modifyEbsDefaultKmsKeyId({KmsKeyId: kmsKeyId}).promise());
            break;
    }

    return Promise.all(promises);
}

async function disableEbsEncryption() {
    return ec2.disableEbsEncryptionByDefault().promise();
}

exports.handler = async (event, context) => {
    try {
        console.log("Event:", JSON.stringify(event));
        const kmsKeyId = event.ResourceProperties.KmsKeyId;

        switch (event.RequestType) {
            case 'Create':
            case 'Update':
                await upsertEbsEncryption(kmsKeyId);
                return await respond(event, context, true);
            case 'Delete':
                await disableEbsEncryption()
                return await respond(event, context, true);
            default:
                throw Error(`Unable to handle request type '${event.RequestType}'`);
        }
    } catch (e) {
        console.log("Error:", e);
        return await respond(event, context, false);
    }
};
