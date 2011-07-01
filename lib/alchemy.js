var cli         = require('cli').enable('status');
var http        = require("http");
var nwm         = require('./nwm');
var qs          = require("querystring");
var util        = require("util");

function debug(o) { console.log(util.inspect(o, true, null)); }

var alchemy = function alchemy(key) {
  var self     = this;
  var apiKey   = key;
  var lastCall = 0;

  function _getCategory(obj, cb){
    nwm.getJson("http://access.alchemyapi.com/calls/html/HTMLGetCategory", cb, {
      apikey: apiKey,
      outputMode: 'json',
      html: obj.text,
      url: obj.url,
      sourcetext: 'cleaned_or_raw'
    });
  }
  function _getText(obj, cb){
    nwm.getJson("http://access.alchemyapi.com/calls/url/URLGetText?" + qs.stringify({
      url: obj.url, 
      apikey: apiKey,
      useMetadata: 1,
      extractLinks: 1,
      outputMode: 'json'
    }), cb);
  }
  function _getEntities(obj, cb){
   nwm.getJson("http://access.alchemyapi.com/calls/html/HTMLGetRankedNamedEntities", cb, {
      apikey: apiKey,
      outputMode: 'json',
      html: obj.text,
      url: obj.url,
      disambiguate: 1,
      linkedData: 1,
      coreference: 1,
      quotations: 1,
      sentiment: 1,
      sourcetext: 'cleaned',
      showSourceText: 1
    });
  }
  function _getKeywords(obj, cb){
    nwm.getJson("http://access.alchemyapi.com/calls/html/HTMLGetRankedKeywords", cb, {
      apikey: apiKey,
      outputMode: 'json',
      html: obj.text,
      url: obj.url,
      sourcetext: 'cleaned',
      keywordExtractMode: 'strict',
      sentiment: 1
    });
  }
  function _getSentiment(obj, cb){
    nwm.getJson("http://access.alchemyapi.com/calls/html/HTMLGetTextSentiment", cb, {
      apikey: apiKey,
      outputMode: 'json',
      html: obj.text,
      url: obj.url,
      sourcetext: 'cleaned'
    });
  }
  function _getConcepts(obj, cb){
    nwm.getJson("http://access.alchemyapi.com/calls/html/HTMLGetRankedConcepts", cb, {
      apikey: apiKey,
      outputMode: 'json',
      html: obj.text,
      url: obj.url,
      sourcetext: 'cleaned'
    });
  }
  this.get = function get(doc, cb){
    var alc = {
      url: doc.url,
      text: '',
      entities: {},
      concepts: {},
      keywords: {},
      sentiment: {},
      category: '',
      lang: '',
      errors: []
    };
    var functions = [];
    functions.push(function(){
      _getEntities(alc, function(res){
        if (res.status === 'OK') {
          alc.entities = res.entities;
          alc.lang = res.language;
        } else alc.errors.push({entities: res}); 
        next();
      });
    });
    functions.push(function(){
      _getConcepts(alc, function(res){
        if (res.status === 'OK') {
          alc.concepts = res.concepts;
        } else alc.errors.push({concepts: res});
        next();
      });
    });
    functions.push(function(){
      _getKeywords(alc, function(res){
        if (res.status === 'OK') {
          alc.keywords = res.keywords;
        } else alc.errors.push({keywords: res});
        next();
      });
    });
    functions.push(function(){
      _getSentiment(alc, function(res){
        if (res.status === 'OK') {
          alc.sentiment = res.docSentiment;
        } else alc.errors.push({sentiment: res});
        next();
      });
    });
    functions.push(function(){
      _getCategory(alc, function(res){
        if (res.status === 'OK') {
          alc.category = res.category;
        } else alc.errors.push({category: res});
        next();
      });
    });
    var nb = functions.length;
    var next = function() {
      nb--;
      if (nb === 0) {
        cb(alc);
      }
    };
    _getText(alc, function(res){
      if (res.status === 'OK') {
        alc.text = res.text;
        functions.forEach(function(f) {
          f();
        });
      } else {
        cb(alc);
      }
    });
  };
};

module.exports = alchemy;
