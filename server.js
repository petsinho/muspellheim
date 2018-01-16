// TODO: Create fixtures for when db is empty
// TODO: Split up db ops from pub-sub ops
const deflate = require('permessage-deflate');
const https = require('https');
const server = https.createServer();
const pubishProjects = require('./publications/projects');
const pubishCategories = require('./publications/categories');
const bayeux = require('./singletons').bayeux;
const express = require('express');


const port = process.env.PORT || 3000;

const app = express();

app.get('/', (req, res) => {
  res.send({
    Output: 'Hello World!',
  });
});

app.post('/', (req, res) => {
  res.send({
    Output: 'Hello World!',
  });
});

app.listen(port);


bayeux.addWebsocketExtension(deflate);

// From env variables
const wsPort = process.env.WS_PORT;

bayeux.attach(server);
server.listen(wsPort);

bayeux.on('subscribe', (clientId, channel) => {
  // Publish to client when the client connects
  console.log(`[SUBSCRIBED] ${clientId} -> ${channel}`);
  pubishProjects();
  pubishCategories();
});
