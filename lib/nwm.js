var cli         = require('cli').enable('status'); // https://github.com/chriso/cli
var http        = require("http");
var qs          = require("querystring");
var url         = require("url");

function debug(o) { console.log(require('util').inspect(o, true, null)); }

var nwm = exports;

/**
 * getJson 
 * 
 * @param {String|Object}   uri or request options
 * @param {Function} onResult
 * @param {Object} data: if defined, data to post
 */
nwm.getJson = function getJson(uri, onResult, data) {
  var httpOptions = {};
  var requestBody = '';
  switch (typeof uri) {
    case 'string':
      var parsed = url.parse(uri);
      if (!parsed.search) parsed.search = '';
      httpOptions = {
        host: parsed.host,
        port: (parsed.port ? parsed.port : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET'
      };
      if (typeof data === 'object') {
        requestBody = qs.stringify(data);
        httpOptions.method = 'POST';
        httpOptions.headers = {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': requestBody.length
        };
      }
      break;
    case 'object':
      httpOptions = uri;
      break;
  } 
  var req = http.request(httpOptions, function(res) {
    var body = '';
    res.on('data', function(chunk) {
      body += chunk;
    })
    .on('end', function() {
      var result = {};
      try {
        result = JSON.parse(body);
      } catch (e) {
        cli.error(e);
        cli.error(body);
      }
      onResult(result);
    });
  });
  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });
  req.write(requestBody);
  req.end();
};
/**
 * getHtml
 * 
 * @param {String}   uri
 * @param {Function} onResult
 */
nwm.getHtml = function getHtml(uri, onResult) {
  var httpOptions;
  switch (typeof uri) {
    case 'string':
      var parsed = url.parse(uri);
      httpOptions = {
        host: parsed.host,
        port: (parsed.port ? parsed.port : 80),
        path: parsed.pathname + (parsed.search || ''),
        method: 'GET'
      };
      break;
    case 'object':
      httpOptions = uri;
      break;
  } 
  var req = http.request(httpOptions, function(res) {
    var body = '';
    res.on('data', function(chunk) {
      body += chunk;
    })
    .on('end', function() {
      onResult(body);
    });
  });
  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });
  req.end();
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
    delete parsed.search;
    return url.format(parsed);
  }
  try {
    var req = http.request(options, function(res) {
      var header = res.headers;
      if (header.location) {
        if (/*header.location.length < 40*/ header.location !== shortUrl && level < 4) {
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

