const fallbackPort = 3667;
var port = process.env.PORT || fallbackPort;
var express = require('express');
const deflate = require('permessage-deflate');
var AWS = require('aws-sdk');

var app = express();

app.get('/', function(req, res) {
  res.send({
    "Output": "Hello World!"
  });
});

app.post('/', function(req, res) {
  res.send({
    "Output": "Hello World!"
  });
});



app.listen(port);

const port2 = 3668;
const http = require('http');
const faye = require('faye');
let server = http.createServer(),
bayeux = new faye.NodeAdapter({ mount: '/' });
bayeux.addWebsocketExtension(deflate);

bayeux.attach(server);
server.listen(port2);

bayeux.on('subscribe', function(clientId, channel) {
  console.log('[  SUBSCRIBE] ' + clientId + ' -> ' + channel);
});


// AWS.config.update({region: 'us-east-1'});

// // Create DynamoDB service object
// var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

// var params = {
//   ExpressionAttributeValues: {
//     ':s': {N: '2'},
//     ':e' : {N: '09'},
//     ':topic' : {S: 'PHRASE'}
//    },
//  KeyConditionExpression: 'Season = :s and Episode > :e',
//  ProjectionExpression: 'Title, Subtitle',
//  FilterExpression: 'contains (Subtitle, :topic)',
//  TableName: 'EPISODES_TABLE'
// };

// ddb.query(params, function(err, data) {
//   if (err) {
//     console.log("Error", err);
//   } else {
//     data.Items.forEach(function(element, index, array) {
//       console.log(element.Title.S + " (" + element.Subtitle.S + ")");
//     });
//   }
// });


const dothat = () => bayeux.getClient().publish('/messages', {
  text: 'Hello there'
});

setTimeout(dothat, 20000);
