#!/usr/bin/env node
/**
 * This file is part of bbNightWatchman
 *
 * Copyright (C) 2011  Clochix.net
 *
 * Keskispas is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * bbNightWatchman is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 */
/**
 * Usage
 * nwm.js -n 20 get toto : get 20 tweets about toto
 * nwm.js long : convert short urls to real
 * nwm.js readability : parse document with readability
 * nwm.js viewtext : parse document with viewtext
 */

GLOBAL.DEBUG = false;

// nmp install cli; // https://github.com/chriso/cli
var cli         = require('cli').enable('status');
var events      = require('events');
var http        = require("http");
var https       = require("https");
var mongodb     = require("mongodb");
var qs          = require("querystring");
var readability = require("./lib/readability");
var sys         = require("sys");
var url         = require("url");
var util        = require("util");

readability.debugging = false;

var db = new mongodb.Db('veille', new mongodb.Server("127.0.0.1", 27017, {}));

function debug(o) {
  console.log(util.inspect(o, true, null));
}

/**
 * getJson 
 * 
 * @param {String}   uri
 * @param {Function} onResult
 */
function getJson(uri, onResult) {
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
}
/**
 * getHtml
 * 
 * @param {String}   uri
 * @param {Function} onResult
 */
function getHtml(uri, onResult) {
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
}
/**
 * getRealUrl
 * 
 * @param {String}   shortUrl
 * @param {Function} callback
 */
function getRealUrl(shortUrl, callback, level) {
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
  var req = http.request(options, function(res) {
    var header = res.headers;
    if (header.location) {
      if (header.location.length < 40 && level < 3) {
        cli.debug('MORE: Resolving ' + shortUrl + ' to ' + header.location);
        getRealUrl(header.location, callback, level+1);
      } else {
        callback(header.location);
        cli.debug('Resolving ' + shortUrl + ' to ' + header.location);
      }
    } else {
      cli.debug('Unable to resolve ' + shortUrl);
      callback(shortUrl);
    }
  });
  req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
  });
  req.end();
}
var Document = function(uri) {
  var self = this;
  this.getUri = function getUri() {
    return uri;
  };
  this.getViewText = function getViewText(callback) {
    getJson('http://viewtext.org/api/text?' + qs.stringify({url: self.getUri(), rl: false, format: 'JSON'}), callback);
  };
  this.getReadability = function getReadability(callback) {
    getHtml(self.getUri(), function(html){
      readability.parse(html, pUrl, {}, callback);
    });
  };
};
function getDocument(uri) {
  parsed = url.parse(uri);
  getJson('http://viewtext.org/api/text?' + qs.stringify({url: uri, rl: false, format: 'JSON'}), function(res){
    var saveFct = function(err, db) {
      if (err) cli.error(err);
console.log(res);
/*
      db.collection('documents', function(err, collection) {
        if (err) cli.error(err);
        collection.save(res, {safe: true}, function(a,b){
          db.close();
        });
      });
*/
    };
    if (db.state == 'notConnected') db.open(saveFct);
    else saveFct(null, db);
  });
}
function massSave(colName, cond, updFct) {
  db.collection(colName, function(err, collection) {
    if (err) cli.error(err);
    collection.find(cond, function(err, cursor) {
      if (err) cli.error(err);
      cursor.toArray(function(err, items){
        var nb = items.length;
        cli.debug('Nb to update: ' + nb);
        if (0 === nb) {
          db.close();
        } else {
          items.forEach(function(doc){
            var cb = function(){
              collection.save(doc, {safe: true}, function() {
                nb--;
                cli.debug('Nb: ' + nb);
                if (0 === nb) {
                  db.close();
                }
              });
            };
            updFct(doc, cb);
          });
        }
      });
    });
  });
}
function massUpdate(colName, cond, toSet, updFct) {
  db.collection(colName, function(err, collection) {
    if (err) cli.error(err);
    collection.find(cond, function(err, cursor) {
      if (err) cli.error(err);
      cursor.toArray(function(err, items){
        var nb = items.length;
        cli.debug('Nb to update: ' + nb);
        if (0 === nb) {
          db.close();
        } else {
          items.forEach(function(doc){
            var cb = function(res){
              var newDoc;
              if (typeof toSet == 'Object') {
                newDoc = toSet;
              } else {
                newDoc = {$set: {}};
                newDoc['$set'][toSet] = res;
              }
              collection.update({_id: doc._id}, newDoc, {safe:true, upsert: true}, function(err) {
                if (err) cli.error(err);
                nb--;
                cli.debug('Nb: ' + nb);
                if (0 === nb) {
                  db.close();
                }
              });
            };
            updFct(doc, cb);
          });
        }
      });
    });
  });
}

var TweetCollection = function() {
  var self = this;
  /**
   *  
   */
  this.get  = function get(tag, rpp) {
    var queryOptions = {
      rpp: rpp, // responses per page
      q: tag  // query
    };
    getJson('http://search.twitter.com/search.json?' + qs.stringify(queryOptions),  function(res){
      res.results.forEach(function(t, i) {
        var id = '000000000000000000000000' + t.id.toString(16);
        res.results[i]._id    = new db.bson_serializer.ObjectID(id.substr(-24));
        res.results[i].query  = tag;
        res.results[i].urls   = t.text.match(/(https?:\/\/\S+)/ig);
        if (res.results[i].urls) {
          res.results[i].urls.forEach(function(u, j){
            res.results[i].urls[j] = u.length < 40 ? {short_url: u} : {long_url: u};
          });
        }
      });
      self.save(res.results);
      cli.debug('Saving ' + res.results.length + ' new tweets');
    });
  };
  this.save = function save(tweets) {
    var nb = tweets.length;
    if (nb === 0) {
      db.close();
    }
    var saveFct = function(err, db) {
      db.collection('tweets', function(err, collection) {
        if (err) cli.error(err);
        tweets.forEach(function(t, i){
          collection.save(t, {safe: true}, function(err){
            if (err) cli.error(err);
            nb--;
            if (nb === 0) {
              db.close();
            }
          });
        });
      });
    };
    if (db.state == 'notConnected') db.open(saveFct);
    else saveFct(null, db);
  };
  this.getRealUrls = function getRealUrls() {
    var updateFct = function(err, db) {
      if (err) cli.error(err);
      var colName = 'tweets';
      var cond    = {'urls.short_url': {$exists: true}, 'urls.long_url': {$exists: false}};
      var documents = new mongodb.Collection(db, 'documents');
      var updFct  = function(doc, callback){
        if (doc && doc.urls) {
          doc.urls.forEach(function(u, i) {
            if (!u.long_url) {
              getRealUrl(u.short_url, function(long_url){
                cli.debug('Updating url of document to ' + long_url);
                doc.urls[i].long_url = long_url;
                documents.update({url: long_url}, {$set: {url: long_url}}, {safe:true, upsert: true}, function(err) {
                  if (err) console.warn(err.message);
                });
                callback();
              });
            }
          });
        } else {
          cli.error('Invalid document : ');
          debug(doc);
        }
      };
      massSave(colName, cond, updFct);
    };
    if (db.state == 'notConnected') db.open(updateFct);
    else updateFct(null, db);
  };
};

// Options: long_tag: [short_tag, description, value_type, default_value]
cli.parse({
  num: ['n', 'Number of tweets to fetch', 'number', 5]
},
  ['get', 'long', 'resolve', 'test', 'readability', 'viewtext']
);

switch (cli.command) {
  case 'get':
    cli.debug('Fetching tweets');
    var t = new TweetCollection();
    t.get(cli.args[0], cli.options.num);
    break;
  case 'long':
    cli.debug('Resolving short urls');
    var t = new TweetCollection();
    t.getRealUrls();
    break;
  case 'resolve':
    getRealUrl(cli.args[0], function(){});
    break;
  case 'readability':
    var fct = function() {
      var colName = 'documents';
      var toSet   = 'reada';
      var cond    = {};
      cond[toSet] = {$exists: false};
      var updFct  = function(d, c){
        var doc = new Document(d.url);
        doc.getReadability(c);
      };
      massUpdate(colName, cond, toSet, updFct);
    }
    if (db.state == 'notConnected') db.open(fct);
    else fct();
    break;
  case 'viewtext':
    var fct = function() {
      var colName = 'documents';
      var toSet   = 'viewtext';
      var cond    = {};
      cond[toSet] = {$exists: false};
      var updFct  = function(d, c){
        var doc = new Document(d.url);
        doc.getViewText(c);
      };
      massUpdate(colName, cond, toSet, updFct);
    }
    if (db.state == 'notConnected') db.open(fct);
    else fct();
    break;
  case 'test':
    var pUrl = cli.args[0];
    getHtml(pUrl, function(html){
      readability.parse(html, pUrl, {}, function(result){
        db.open(function(err, client) {
          var documents = new mongodb.Collection(client, 'documents');
          documents.update({url: pUrl}, {$set: {reada: result}}, {safe:true, upsert: true}, function(err) {
            if (err) console.warn(err.message);
            else console.log('successfully updated');
            db.close();
          });
        });
      });
    });
/*
    getHtml(pUrl, function(html){
      readability.parse(html, pUrl, {}, function(result){
        db.open(function(err, client) {
          var documents = new mongodb.Collection(client, 'documents');
          documents.update({url: pUrl}, {$set: {reada: result}}, {safe:true, upsert: true}, function(err) {
              if (err) console.warn(err.message);
              else console.log('successfully updated');
              db.close();
            });
        });
      });
    });
*/
    break;
  default:
    break;
}

/*
db.open(function(err, db) {
  db.collection('tweets', function(err, collection) {
    collection.find({}, function(err, cursor) {
      cursor.each(function(err, doc){
        var updated = false;
        if (doc && doc.urls) {
          doc.urls.forEach(function(u, i) {
            getDocument(u);
          });
        }
      });
    });
  });
});
*/
