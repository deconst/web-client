var fs = require('fs');
var url = require('url');
var MongoClient = require('mongodb').MongoClient;
var request = require('request');
var express = require('express');
var multer = require('multer');

var upload = multer({dest: '/tmp'}).any();
var app = express();
var jsonParser = require('body-parser').json({
  limit: '32mb'
});

var MONGO_URL = 'mongodb://content-proxy-db/webClient';
var UPSTREAM = process.env.CONTENT_UPSTREAM;

var DBConnection;

var getUpstreamUrl = function (originalUrl) {
  var segments = originalUrl.split('/');

  // loop over segments backwards, removing empty ones.
  for (var i = segments.length - 1; i >= 0; i--) {
    if(segments[i] === '') {
      segments.splice(i, 1);
    }
  }

  // Segment 0 is the changeSetId, which we don't want to send upstream
  segments.splice(0,1);
  return url.resolve(UPSTREAM, '/' + segments.join('/'));
};

var handleUpstreamResponse = function (err, upstream, client) {
  if (err) {
    console.log({
      error: err
    });

    return client.sendStatus(500);
  }

  return passUpstreamData(upstream, client);
};

var passUpstreamData = function (upstream, client) {
  client.status(upstream.statusCode);
  for (var headerName in upstream.headers) {
    client.set(headerName, upstream.headers[headerName]);
  }
  client.send(upstream.body);
  console.log('bombs away!!!');
};

// Log all teh things
app.use(function (req, res, next) {
  console.log('[%s] %s %s', new Date(), req.method, req.url);

  return next();
});

app.get('/:changeSet/content/:contentId', function (req, res) {
  DBConnection.collection('contentChanges').find({
    changeSet: req.params.changeSet,
    contentId: req.params.contentId
  }).limit(1).toArray(function (err, docs) {
    if (err) {
      console.log({
        error: err
      });
      res.status(500);
      res.end();
    }

    if (docs.length === 0) {
      console.log('Proxying content request upstream', {
        url: getUpstreamUrl(req.originalUrl)
      });

      return request.get(getUpstreamUrl(req.originalUrl), {timeout: 5000}, function (err, response) {
        console.log(req.originalUrl);
        handleUpstreamResponse(err, response, res);
      });
    }

    console.log('Returning changed content for ID: %s', req.params.contentId);
    return res.send({
      envelope: docs[0].envelope
    });
  });
});

app.put('/:changeSet/content/:contentId', jsonParser, function (req, res) {
  DBConnection.collection('contentChanges').updateOne(
    // filter
    {
      changeSet: req.params.changeSet,
      contentId: req.params.contentId
    },
    // document
    {
      changeSet: req.params.changeSet,
      contentId: req.params.contentId,
      envelope: req.body
    },
    // options
    {upsert: true},
    // callback
    function (err, result) {
      if (err) {
        console.log(err);
      }
      console.log('Updated %s', req.params.contentId, req.body);

      res.status(200);
      res.end();
    }
  );

});

app.delete('/:changeSet/content/:contentId', function (req, res) {
  DBConnection.collection('contentChanges').findOneAndDelete({
    changeSet: req.params.changeSet,
    contentId: req.params.contentId
  }, function (err, result) {
    if (err) {
      console.log(err);
    }

    console.log('Deleted changed copy of %s', req.params.contentId, result);
    res.status(204);
    res.end();
  });
});

app.get('/:changeSet/assets', function (req, res) {
  console.log('Proxying assets request upstream', {
    url: getUpstreamUrl(req.originalUrl)
  });

  return request.get(getUpstreamUrl(req.originalUrl), {timeout: 5000}, function (err, response) {
    handleUpstreamResponse(err, response, res);
  });
});

app.post('/assets', upload, function (req, res) {
  // This write/delete thrashing clearly sucks.
  req.files.forEach(function (file) {
    fs.unlink(file.path);
  });
  res.send({});
});

app.get('/:changeSet/control', function (req, res) {
  return request.get(getUpstreamUrl(req.originalUrl), {timeout: 5000}, function (err, response) {
    handleUpstreamResponse(err, response, res);
  });
});


MongoClient.connect(MONGO_URL, function (err, db) {
  if (err) {
    throw err;
  }

  DBConnection = db;

  var server = app.listen(process.env.NODE_PORT || 8080, function () {
    console.log('Server listening on port %s...', process.env.NODE_PORT || 8080);
  });
});
