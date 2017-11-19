// TODO: Create fixtures for when db is empty
// TODO: Split up db ops from pub-sub ops

const deflate = require('permessage-deflate');
const AWS = require('aws-sdk');
const DynamoDBStream = require('dynamodb-stream');
const converter = require('dynamo-converter');
const schedule = require('tempus-fugit').schedule;
const _ = require('lodash');

const http = require('http');
const faye = require('faye');
const server = http.createServer();
const bayeux = new faye.NodeAdapter({ mount: '/' });
bayeux.addWebsocketExtension(deflate);

// From env variables
const wsPort = process.env.WS_PORT;
const dbARNDev = process.env.DB_PROJECTS_DEV_ARN;
bayeux.attach(server);
server.listen(wsPort);

AWS.config.update({ region: 'us-east-1' });
// Create DynamoDB service object
const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

let localState = { };

const marshallItemsToJS = () => localState.Items.map(i => converter.fromItem(i));

// TODO: publish only change, not all projects
const pubishProjects = () => bayeux.getClient().publish('/projects', marshallItemsToJS(localState.Items));

const subscribeToDBStream = () => {
  // fetch stream state initially
  console.log('listening to db changes..');
  const ddbStream = new DynamoDBStream(new AWS.DynamoDBStreams(), dbARNDev);
  ddbStream.fetchStreamState((err) => {
    if (err) {
      console.error('err:', err);
      return process.exit(1);
    }

    // fetch all the data
    ddb.scan({ TableName: 'dev-projects' }, (err, results) => {
      localState = results;
        // do this every 5s, starting from the next round minute
      schedule({ second: 1 }, (job) => {
        ddbStream.fetchStreamState(job.callback());
      });
    });
  });

  ddbStream.on('insert record', (data) => {
    localState.Items.push(converter.toItem(data));
    pubishProjects();
  });

  ddbStream.on('remove record', (data) => {
    localState.Items = _.reject(localState.Items, i => converter.fromItem(i).id === data.id);
    // delete localState[data.id];
    pubishProjects();
  });

  ddbStream.on('modify record', (newData, oldData) => {
    localState.Items = localState.Items.map(i =>
       converter.fromItem(i).id === oldData.id ?
         converter.toItem(newData) :
         i
    );
    localState[oldData.id] = newData;
    pubishProjects();
      // const diff = deepDiff(oldData, newData);
      // if (diff) {
      //   // handle the diffs
      // }
  });
};


const params = {
  TableName: 'dev-projects',
  ExpressionAttributeValues: {
    ':visibility': { BOOL: false },
  },
  ExpressionAttributeNames: {
    '#isHidden': 'isHidden',
  },
  // FIXME: Visibility is not working
  FilterExpression: '#isHidden = :visibility',
  // ProjectionExpression: 'Title, Subtitle',
  // FilterExpression: 'contains (Subtitle, :topic)',
};


ddb.scan(params, (err, data) => {
  console.log('scanned data: ', data);
  if (err) {
    console.log('Error', err);
  } else {
    localState = data.Items;
    // data.Items.forEach((element, index, array) => {
    //   console.log('active project:', element.description.S);
    // });
  }
});

subscribeToDBStream();

bayeux.on('subscribe', (clientId, channel) => {
  // Publish to client when the client connects
  console.log(`[SUBSCRIBED] ${clientId} -> ${channel}`);
  pubishProjects();
});
