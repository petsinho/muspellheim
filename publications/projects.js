
// TODO: Create fixtures for when db is empty
// TODO: Split up db ops from pub-sub ops
const AWS = require('aws-sdk');
const DynamoDBStream = require('dynamodb-stream');
const converter = require('dynamo-converter');
const schedule = require('tempus-fugit').schedule;
const _ = require('lodash');
const ddb = require('../singletons').ddb;
const bayeux = require('../singletons').bayeux;

// From env variables
const projectsARN = process.env.DB_PROJECTS_DEV_ARN;

let localState = { };

const marshallItemsToJS = () => localState.Items.map(i => converter.fromItem(i));

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
};


// TODO: publish only change, not all projects
const pubishProjects = () => bayeux.getClient().publish('/projects', marshallItemsToJS(localState.Items));

ddb.scan(params, (err, data) => {
  console.log('scanned projs: ', data);
  if (err) {
    console.log('Error', err);
  } else {
    localState = data.Items;
  }
});

const subscribeToDBStream = () => {
  // fetch stream state initially
  console.log('listening to projects changes..');
  const ddbStream = new DynamoDBStream(new AWS.DynamoDBStreams(), projectsARN);
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
  });
};

subscribeToDBStream();

module.exports = pubishProjects;
