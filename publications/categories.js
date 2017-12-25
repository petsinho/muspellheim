
// TODO: Create fixtures for when db is empty
// TODO: Split up db ops from pub-sub ops
const deflate = require('permessage-deflate');
const AWS = require('aws-sdk');
const DynamoDBStream = require('dynamodb-stream');
const converter = require('dynamo-converter');
const schedule = require('tempus-fugit').schedule;
const _ = require('lodash');
const faye = require('faye');
const ddb = require('../singletons');
const bayeux = new faye.NodeAdapter({ mount: '/' });
bayeux.addWebsocketExtension(deflate);

// From env variables
const categoriedARN = process.env.DB_CATEGORIES_DEV_ARN;

let localState = { };

const marshallItemsToJS = () => localState.Items.map(i => converter.fromItem(i));

const params = {
  TableName: 'dev-categories',
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


// TODO: publish only change, not all categories
const pubishCategories = () => bayeux.getClient().publish('/categories', marshallItemsToJS(localState.Items));

ddb.scan(params, (err, data) => {
  console.log('scanned categories: ', data);
  if (err) {
    console.log('Error', err);
  } else {
    localState = data.Items;
  }
});

const subscribeToDBStream = () => {
  // fetch stream state initially
  console.log('listening to categories changes..');
  const ddbStream = new DynamoDBStream(new AWS.DynamoDBStreams(), categoriedARN);
  ddbStream.fetchStreamState((err) => {
    if (err) {
      console.error('err:', err);
      return process.exit(1);
    }

    // fetch all the data
    ddb.scan({ TableName: 'dev-categories' }, (err, results) => {
      localState = results;
        // do this every 5s, starting from the next round minute
      schedule({ second: 1 }, (job) => {
        ddbStream.fetchStreamState(job.callback());
      });
    });
  });

  ddbStream.on('insert record', (data) => {
    localState.Items.push(converter.toItem(data));
    pubishCategories();
  });

  ddbStream.on('remove record', (data) => {
    localState.Items = _.reject(localState.Items, i => converter.fromItem(i).id === data.id);
    // delete localState[data.id];
    pubishCategories();
  });

  ddbStream.on('modify record', (newData, oldData) => {
    localState.Items = localState.Items.map(i =>
       (converter.fromItem(i).id === oldData.id ?
         converter.toItem(newData) :
         i)
    );
    localState[oldData.id] = newData;
    pubishCategories();
      // const diff = deepDiff(oldData, newData);
      // if (diff) {
      //   // handle the diffs
      // }
  });
};

subscribeToDBStream();

module.exports = pubishCategories;
