const AWS = require('aws-sdk');
const faye = require('faye');

AWS.config.update({ region: 'us-east-1' });
// Create DynamoDB service object
const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

const bayeux = new faye.NodeAdapter({ mount: '/' });


module.exports.ddb = ddb;
module.exports.bayeux = bayeux;
