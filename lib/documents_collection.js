var cli         = require('cli').enable('status'); // https://github.com/chriso/cli
var nwm         = require('./nwm');
var qs          = require("querystring");
var readability = require("./readability");
var sys         = require('sys');

readability.debugging = false;

var config      = require('../config');
var calais      = require('./calais');
calais = new calais(config.data.calais);

var DocumentsCollection = function DocumentsCollection(db) {
  var self = this;
  this.db  = db;
  this.collectionName = 'documents';
  this.key = 'url';
};
sys.inherits(DocumentsCollection, require('./collection').Collection);
DocumentsCollection.prototype.update = function(toSet, fun, next) {
  var self = this;
  if (typeof next === 'undefined') next = function(){};
  var fct = function() {
    var colName = 'documents';
    var cond    = {};
    cond[toSet] = {$exists: false};
    var updFct  = function(d, c){
      DocumentsCollection.prototype[fun].call(null, d, c);
    };
    self.massUpdate(colName, cond, updFct, toSet, next);
  };
  if (self.db.state === 'notConnected') self.db.open(fct);
  else fct();
};
DocumentsCollection.prototype.getViewText = function getViewText(doc, callback) {
  nwm.getJson('http://viewtext.org/api/text?' + qs.stringify({url: doc.url, rl: false, format: 'JSON'}), callback);
};
DocumentsCollection.prototype.getReadability = function getReadability(doc, callback) {
  var docUrl = doc.url;
  nwm.getHtml(docUrl, function(html){
    readability.parse(html, docUrl, {}, callback);
  });
};
DocumentsCollection.prototype.getCalais = function getCalais(doc, callback) {
  var content = '';
  if (doc.reada && doc.reada.content) content = doc.reada.content;
  else if (doc.viewtext && doc.viewtext.content) content = doc.viewtext.content;
  if (content) {
    calais.get({text: content}, callback);
  } else {
    callback({});
  }
};
DocumentsCollection.prototype.fetch = function fetch(url, callback) {
  var self = this;
  var doc = {url: url};
  var nb = 2;
  var next = function(){
    nb--;
    if (nb === 0) {
      self.save(doc, callback);
    }
  };
  self.getReadability(doc, function(res){
    doc.reada = res;
    next();
  });
  self.getViewText(doc, function(res){
    doc.viewtext = res;
    next();
  });
};
exports.DocumentsCollection = DocumentsCollection;
