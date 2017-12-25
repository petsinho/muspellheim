const AWS = require('aws-sdk');

AWS.config.update({ region: 'us-east-1' });
// Create DynamoDB service object
const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

module.exports = ddb;
