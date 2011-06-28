/**
 * Module dependencies.
 */
var express = require('express');
var mongodb = require("mongodb");
var stache  = require('./lib/stache');
var tc      = require('./lib/tweets_collection');
var dc      = require('./lib/documents_collection');
var jsv     = require('./lib/jsonview.js');

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
    col.get(req.params[1], function(doc) {
      if (!doc) {
        res.send('No ' + objName + ' with id ' + req.params[1], 404);
      };
      var jsonFormatter = new jsv.JSONFormatter();
      res.render(objName + '/view.html', {
        locals: {
                  doc: doc,
                  escaped: jsonFormatter.jsonToHTML(doc)
                },
        partials: {},
        layout: !req.xhr
      });
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
app.get('*', function(req, res){
  res.send('404', 404);
});
app.listen(3000);
console.log("Express server listening on port %d", app.address().port);
