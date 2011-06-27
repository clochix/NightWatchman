var cli         = require('cli').enable('status'); // https://github.com/chriso/cli
var nwm         = require('./nwm');
var qs          = require("querystring");
var sys         = require('sys');

var TweetsCollection = function TweetCollection(db) {
  var self = this;
  this.db  = db;
  /**
   *  
   */
  this.get  = function get(tag, rpp, next) {
    if (typeof next === 'undefined') next = function(){};
    var queryOptions = {
      rpp: rpp, // responses per page
      q: tag  // query
    };
    nwm.getJson('http://search.twitter.com/search.json?' + qs.stringify(queryOptions),  function(res){
      res.results.forEach(function(t, i) {
        var id = '000000000000000000000000' + t.id.toString(16);
        res.results[i]._id    = new self.db.bson_serializer.ObjectID(id.substr(-24));
        res.results[i].query  = tag;
        res.results[i].urls   = t.text.match(/(https?:\/\/\S+)/ig);
        if (res.results[i].urls) {
          res.results[i].urls.forEach(function(u, j){
            res.results[i].urls[j] = u.length < 40 ? {short_url: u} : {long_url: u};
          });
        }
      });
      save(res.results, next);
      cli.debug('Saving ' + res.results.length + ' new tweets');
    });
  };
  function save(tweets, next) {
    if (typeof next === 'undefined') next = function(){};
    var nb = tweets.length;
    if (nb === 0) {
      self.db.close();
      next();
    } else {
      var saveFct = function(err, db) {
        db.collection('tweets', function(err, collection) {
          if (err) cli.error(err);
          collection.insert(tweets, function(err){
            if (err) cli.error(err);
            else {
              db.close();
              next();
            }
          });
        });
      };
      if (self.db.state === 'notConnected') self.db.open(saveFct);
      else saveFct(null, self.db);
    }
  }
  this.getRealUrls = function getRealUrls(next) {
    if (typeof next === 'undefined') next = function(){};
    var updateFct = function(err, db) {
      if (err) cli.error(err);
      var colName = 'tweets';
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
      self.massUpdate(colName, cond, updFct, null, next);
    };
    if (self.db.state === 'notConnected') self.db.open(updateFct);
    else updateFct(null, self.db);
  };
};
sys.inherits(TweetsCollection, require('./collection').Collection);

exports.TweetsCollection = TweetsCollection;
