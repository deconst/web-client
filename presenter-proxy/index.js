var url = require('url');

var express = require('express');
var request = require('request');

var app = express();

var PRESENTER_BASE_NAME = process.env.PRESENTER_BASE_NAME || 'web-client-presenter-';

var getSegments = (originalUrl) => {
  var segments = originalUrl.split('/');

  // loop over segments backwards, removing empty ones.
  for (var i = segments.length - 1; i >= 0; i--) {
    if(segments[i] === '') {
      segments.splice(i, 1);
    }
  }

  return segments;
};

var rewriteURLs = (body, path) => {
  body = body.replace(/(<[^<]+?)(href="|src=")(\/.*?)(".*?>)/g, '$1$2' + path + '$3$4');
  return body;
};

// This is something browsers will request autonomously, and I don't want it
// creating server-side errors.
app.get('/favicon.ico', (req, res) => {
  res.status(404);
  res.end();
});

/**
 * We expect reqeusts to come in the form /:changesetId/foo/bar. The changesetId
 * param will be used to format a hostname that will be used as the upstream,
 * and the rest of the URL is used as the upstream path.
 *
 * e.g: `/abc/foo/bar` is proxied to `upstream-abc/foo/bar`
 */
app.use((req, res, next) => {
  var allSegments = getSegments(req.originalUrl);
  // The first segment is the changesetId, the rest will get passed upstream
  var changesetId = allSegments.splice(0,1)[0];

  if (!changesetId) {
    // bail out if they're requesting
    res.status(404);
    res.end();
    return;
  }

  // It should only contain hex characters
  changesetId = changesetId.replace(/[^a-f0-9]/g, '');

  var upstreamUrl = url.format({
    protocol: 'http',
    hostname: PRESENTER_BASE_NAME + changesetId,
    port: 8080,
    pathname: allSegments.join('/')
  });

  console.log('Proxy request to upstream presenter', {
    url: upstreamUrl
  });

  request.get(upstreamUrl, (err, response) => {
    if (err) {
      // If there was a problem reaching the upstream server, that should always
      // be 502-style error
      console.log('Error retrieving upstream response', {
        error: err
      });
      res.status(502);
      res.end();
      return;
    }

    // Piping to the express res stream would be more elegant, but I can't
    // seem to make that work /shrug
    res.status(response.statusCode);
    res.headers = response.headers;
    res.send(rewriteURLs(response.body, '/' + changesetId));
  });
});

var server = app.listen(process.env.NODE_PORT || 8080, function (err) {
  console.log('Server listening on port %s...', process.env.NODE_PORT || 8080);
});
