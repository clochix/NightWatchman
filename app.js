/**
 * Module dependencies.
 */
var config  = require('./config');
var dc      = require('./lib/documents_collection');
var express = require('express');
var jsv     = require('./lib/jsonview.js');
var mongodb = require("mongodb");
var stache  = require('./lib/stache');
var tc      = require('./lib/tweets_collection');

var app = module.exports = express.createServer();

var db = new mongodb.Db('veille', new mongodb.Server("127.0.0.1", 27017, {}));

// Configuration

app.configure(function(){
  app.set('view engine', 'mustache');
  app.set('views', __dirname + '/views');
  //app.set('view options', {layout: false});
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'your secret here' }));
  app.use(express.compiler({ src: __dirname + '/public', enable: ['less'] }));
  app.use(express['static'](__dirname + '/public'));
  app.use(app.router);
  app.register(".html", require(__dirname + '/lib/stache')); // For Mustache
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes
app.get(/^\/(documents|tweets)(?:\/(.+$))?/, function(req, res){

  var objName = req.params[0];
  var colName = objName[0].toUpperCase() + objName.substring(1) + 'Collection';
  var col = require('./lib/' + objName + '_collection')[colName];
  col = new col(db);
  if (req.params[1]) {
    var method = (config.data.fetch_missing === true ? 'getOrFetch' : 'get');
    col[method](req.params[1], function(doc) {
      if (!doc) {
        res.send('No ' + objName + ' with id ' + req.params[1], 404);
      } else {
        var jsonFormatter = new jsv.JSONFormatter();
        res.render(objName + '/view.html', {
          locals: {
                    doc: doc,
          escaped: jsonFormatter.jsonToHTML(doc)
                  },
          partials: {},
          layout: !req.xhr
        });
      }
    }, function(){
    });
  } else {
    col.index(function(documents) {
      res.render(objName + '/index.html', {
        locals: {
                  documents: documents
                },
        partials: {},
        layout: !req.xhr
      });
    }, function(){
    });
  }
});
app.get(/^\/(alchemy|amplify|calais)(?:\/(.+$))/, function(req, res){
  var dc = require('./lib/documents_collection');
  var col = new dc.DocumentsCollection(db);
  col.getOrFetch(req.params[1], function(doc) {
    var tmpDoc = {
      url: doc.url,
      text: doc.viewtext.content
    };
    var lib = require('./lib/' + req.params[0] + '.js');
    lib = new lib(config.data[req.params[0]]);
    lib.get(tmpDoc, function(doc){
      var jsonFormatter = new jsv.JSONFormatter();
      res.render('test/view.html', {
        locals: {
                  escaped: jsonFormatter.jsonToHTML(doc)
                },
        partials: {},
        layout: !req.xhr
      });
    });
  });
});
app.get('*', function(req, res){
  res.send('404', 404);
});
app.listen(3000);
console.log("Express server listening on port %d", app.address().port);
