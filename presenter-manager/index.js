const express = require('express');
const exec = require('child_process').exec;
const crypto = require('crypto');

var app = express();

var runDockerCommand = (command, callback) => {
  if (Array.isArray(command)) {
    command = command.join(' ');
  }

  exec(command, (err, stdout, stderr) => {
    if (err) {
      console.log({
        error: err,
        stderr: stderr
      });

      return callback({
        error: err,
        stderr: stderr
      });
    }

    return callback(null, stdout);
  });
};

app.post('/presenter', (req, res) => {
  // We should probably authenticate this request in some way, as it's pretty expensive

  var changesetId = crypto.randomBytes(8).toString('hex');

  var runCommmand = [
    'docker run',
    '-d',
    '--name web-client-presenter-' + changesetId,
    '--net web-client',
    '--restart always',
    '-e CONTROL_REPO_PATH=/tmp/control-repo',
    '-e CONTROL_REPO_URL=https://github.com/rackerlabs/nexus-control',
    '-e CONTENT_SERVICE_URL=http://content-proxy-1:8080/' + changesetId + '/',
    '-e PRESENTED_URL_PROTO=https',
    '-e PRESENTED_URL_DOMAIN=developer.rackspace.com',
    '-e PRESENTER_LOG_LEVEL=DEBUG',
    'presenter'
  ];

  runDockerCommand(runCommmand, (err, output) => {
    if (err) {
      res.status(500);
      res.send(err);
    }

    console.log('Created new presenter container', {
      name: 'web-client-presenter-' + changesetId,
      id: output
    });

    res.status(202);
    res.send({
      id: changesetId
    });
  });
});

app.delete('/presenter/:changesetId', (req, res) => {
  var deleteCommmand = [
    'docker rm',
    '-f',
    'web-client-presenter-' + req.params.changesetId,
  ];

  runDockerCommand(deleteCommmand, (err, output) => {
    if (err) {
      res.status(500);
      res.send(err);
      return;
    }

    console.log('Deleted presenter container', {
      name: 'web-client-presenter-' + req.params.changesetId,
      id: output
    });

    // No content. You just deleted it.
    res.status(204);
    res.end();
  });
});

var server = app.listen(process.env.NODE_PORT || 8080, (err) => {
  console.log('Server listening on port %s...', process.env.NODE_PORT || 8080);
});
