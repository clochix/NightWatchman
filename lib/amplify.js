var cli         = require('cli').enable('status');
var http        = require("http");
var nwm         = require('./nwm');
var qs          = require("querystring");
var util        = require("util");

function debug(o) { console.log(util.inspect(o, true, null)); }

var amplify = function amplify(key) {
  var self     = this;
  var apiKey   = key;
  var lastCall = 0;

  this.get = function get(doc, cb){
    nwm.getJson("http://portaltnx20.openamplify.com/AmplifyWeb_v20/AmplifyThis", cb, {
      apikey: apiKey,
      outputFormat: 'json',
      inputText: doc.text,
      //sourceURL: url,
      analysis: 'all'
    });
  };
};

module.exports = amplify;
