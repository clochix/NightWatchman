var cli         = require('cli').enable('status'); // https://github.com/chriso/cli
var http        = require("http");
var qs          = require("querystring");
var url         = require("url");

var nwm = exports;

/**
 * getJson 
 * 
 * @param {String}   uri
 * @param {Function} onResult
 */
nwm.getJson = function getJson(uri, onResult) {
  parsed = url.parse(uri);
  httpOptions = {
    host: parsed.host,
    port: (parsed.port ? parsed.port : 80),
    path: parsed.pathname + parsed.search,
    method: 'GET'
  };
  http.get(httpOptions, function(res) {
    var body = '';
    res.on('data', function(chunk) {
      body += chunk;
    })
    .on('end', function() {
      onResult(JSON.parse(body));
    });
  })
  .on('error', function(e) {
    console.log("Got error: " + e.message);
  });
};
/**
 * getHtml
 * 
 * @param {String}   uri
 * @param {Function} onResult
 */
nwm.getHtml = function getHtml(uri, onResult) {
  parsed = url.parse(uri);
  options = {
    host: parsed.host,
    port: (parsed.port ? parsed.port : 80),
    path: parsed.pathname + (parsed.search || ''),
    method: 'GET'
  };
  http.get(options, function(res) {
    var body = '';
    res.on('data', function(chunk) {
      body += chunk;
    })
    .on('end', function() {
      onResult(body);
    });
  })
  .on('error', function(e) {
    cli.error("Got error: " + e.message);
  });
};
/**
 * getRealUrl
 * 
 * @param {String}   shortUrl
 * @param {Function} callback
 */
nwm.getRealUrl = function getRealUrl(shortUrl, callback, level) {
  if (!level) level = 1;
  cli.debug('Trying to resolve ' + shortUrl);
  var parsed  = url.parse(shortUrl);
  var options = {
    host: parsed.host,
    port: (parsed.port ? parsed.port : 80),
    path: parsed.pathname,
    method: 'HEAD'
  };
  var realUrl = shortUrl;
  function cleanup(dirty) {
    var parsed = url.parse(dirty, true);
    delete parsed.query.utm_source;
    delete parsed.query.utm_medium;
    delete parsed.query.utm_campaign;
    return url.format(parsed);
  }
  try {
    var req = http.request(options, function(res) {
      var header = res.headers;
      if (header.location) {
        if (header.location.length < 40 && level < 3) {
          cli.debug('MORE: Resolving ' + shortUrl + ' to ' + header.location);
          getRealUrl(header.location, callback, level+1);
        } else {
          callback(cleanup(header.location));
          cli.debug('Resolving ' + shortUrl + ' to ' + header.location);
        }
      } else {
        cli.debug('Unable to resolve ' + shortUrl);
        callback(cleanup(shortUrl));
      }
    });
    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });
    req.end();
  } catch (e) {
    cli.debug('Unable to resolve ' + shortUrl);
    callback(shortUrl);
  }
};

