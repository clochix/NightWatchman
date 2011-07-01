var cli     = require('cli').enable('status'); // https://github.com/chriso/cli
var config      = require('../config');
var nwm     = require('./nwm');
var qs      = require("querystring");
var twitter = require('twitter');
var util    = require('util');

var TweetsCollection = function TweetCollection(db) {
  var self = this;
  this.db  = db;
  this.collectionName = 'tweets';
  this.key = 'id_str';
  /**
   * extract URLs from a tweet
   *
   * @param {Object} t a tweet
   * @param {String} associated query (optionnal)
   *
   * @return {Object} tweet updated 
   */
  function getUrls(t, tag) {
    var id = '000000000000000000000000' + t.id.toString(16);
    t._id  = new self.db.bson_serializer.ObjectID(id.substr(-24));
    if (typeof tag !== 'undefined') t.query = tag;
    t.urls = t.text.match(/(https?:\/\/\S+)/ig);
    if (t.urls) {
      t.urls.forEach(function(u, j){
        t.urls[j] = u.length < 40 ? {short_url: u} : {long_url: u};
      });
    }
    return t;
  }
  /**
   * Fetch and save a tweet
   *
   * @param {String} id
   * @param {Function} callback
   */
  this.fetch = function fetch(id, callback) {
    var self = this,
        tweet = {};
    var twit = new twitter({
      consumer_key: config.data.twitter.consumer_key,
      consumer_secret: config.data.twitter.consumer_secret,
      access_token_key: config.data.twitter.access_token_key,
      access_token_secret: config.data.twitter.access_token_secret
    });
    twit.get('/statuses/show/' + id + '.json', {include_entities: false}, function(data) {
      if (data) {
        getUrls(data);
        var urls = [];
        data.urls.forEach(function(u, i) {
          if (u.short_url && !u.long_url) {
            urls.push({index: i, url: u.short_url});
          }
        });
        var nb = urls.length;
        if (nb === 0) {
          self.save(data, callback);
        } else {
          var next = function() {
            nb--;
            if (nb === 0) {
              self.save(data, callback);
            }
          };
          urls.forEach(function(u) {
            nwm.getRealUrl(u.url, function(long_url) {
              data.urls[u.index].long_url = long_url;
              next();
            });
          });
        }
      } else {
        callback({});
      }
    });
  };
  /**
   *  
   */
  this.search = function search(tag, rpp, next) {
    var self = this;
    if (typeof next === 'undefined') next = function(){};
    var queryOptions = {
      rpp: rpp, // responses per page
      q: tag  // query
    };
    nwm.getJson('http://search.twitter.com/search.json?' + qs.stringify(queryOptions),  function(res){
      res.results.forEach(function(t, i) {
        res.results[i] = getUrls(t, tag);
      });
      self.save(res.results, next);
      cli.debug('Saving ' + res.results.length + ' new tweets');
    });
  };
  this.getRealUrls = function getRealUrls(next) {
    var self = this;
    if (typeof next === 'undefined') next = function(){};
    var updateFct = function(err, db) {
      if (err) cli.error(err);
      var cond    = {'urls.short_url': {$exists: true}, 'urls.long_url': {$exists: false}};
      var updFct  = function(doc, callback){
        if (doc && doc.urls) {
          var nbMissingUrls = 0;
          doc.urls.forEach(function(u, i) {
            if (!u.long_url) {
              nbMissingUrls++;
            }
          });
          if (nbMissingUrls > 0) {
            doc.urls.forEach(function(u, i) {
              if (!u.long_url) {
                nwm.getRealUrl(u.short_url, function(long_url){
                  cli.debug('Updating url of document to ' + long_url);
                  doc.urls[i].long_url = long_url;
                  db.collection('documents', function(err, documents) {
                    documents.update({url: long_url}, {$set: {url: long_url, updated: Date.now()}}, {safe:true, upsert: true}, function(err) {
                      if (err) console.warn(err.message);
                    });
                  });
                  nbMissingUrls--;
                  if (nbMissingUrls === 0) {
                    callback();
                  }
                });
              }
            });
          }
        } else {
          cli.error('Invalid document : ');
          debug(doc);
        }
      };
      self.massUpdate(self.collectionName, cond, updFct, null, next);
    };
    if (self.db.state === 'notConnected') self.db.open(updateFct);
    else updateFct(null, self.db);
  };
};
util.inherits(TweetsCollection, require('./collection').Collection);

exports.TweetsCollection = TweetsCollection;
