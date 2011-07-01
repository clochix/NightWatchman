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

GLOBAL.DEBUG = true;

var nwm     = require('./lib/nwm');
var tc      = require('./lib/tweets_collection');
var dc      = require('./lib/documents_collection');

var cli     = require('cli').enable('status'); // https://github.com/chriso/cli
var config  = require('./config');
var mongodb = require("mongodb");
var util    = require("util");

var db = new mongodb.Db('veille', new mongodb.Server("127.0.0.1", 27017, {}));

function debug(o) {
  console.log(util.inspect(o, true, null));
}



// Options: long_tag: [short_tag, description, value_type, default_value]
cli.parse({
  num: ['n', 'Number of tweets to fetch', 'number', 5]
},
  ['get', 'long', 'resolve', 'test', 'readability', 'viewtext', 'calais']
);

switch (cli.command) {
  case 'get':
    if (cli.args.length !== 1) {
      cli.error("get tag");
    } else {
      cli.debug('Fetching tweets');
      var t = new tc.TweetsCollection(db);
      var d = new dc.DocumentsCollection(db);
      t.search(cli.args[0], cli.options.num, function(){
        t.getRealUrls(function(){
          d.update('reada', 'getReadability', function(){
            d.update('viewtext', 'getViewText', function(){
              d.update('calais', 'getCalais', function(){
              });
            });
          });
        });
      });
    }
    break;
  case 'long':
    cli.debug('Resolving short urls');
    var t = new tc.TweetsCollection(db);
    t.getRealUrls();
    break;
  case 'resolve':
    nwm.getRealUrl(cli.args[0], function(){});
    break;
  case 'readability':
    var d = new dc.DocumentsCollection(db);
    d.update('reada', 'getReadability');
    break;
  case 'viewtext':
    var d = new dc.DocumentsCollection(db);
    d.update('viewtext', 'getViewText');
    break;
  case 'calais':
    var d = new dc.DocumentsCollection(db);
    d.update('calais', 'getCalais');
    break;
  case 'test':
    var alchemy = require('./lib/alchemy.js');
    alchemy = new alchemy(config.data.alchemy);
    alchemy.get(cli.args[0], function(res){debug(res);});
    /*
    db.open(function(err, db) {
      db.collection('documents', function(err, collection) {
        collection.findOne({}, function(err, doc) {
          Document.prototype.getCalais(doc, function(obj){debug(obj);db.close();});
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
