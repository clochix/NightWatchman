var http        = require("http");
var cli         = require('cli').enable('status');
var util        = require("util");

function debug(o) { console.log(util.inspect(o, true, null)); }

var calais = function calais(key) {
  var self     = this;
  var apiKey   = key;
  var lastCall = 0;

  // @see http://www.opencalais.com/documentation/calais-web-service-api/interpreting-api-response/opencalais-json-output-format
  function resolveReferences(flatdb) {
    for (var element in flatdb)
      for (var attribute in flatdb[element]) {
        var val = flatdb[element][attribute];
        if (typeof val === 'string')
          if (flatdb[val] !== null)
            flatdb[element][attribute] = flatdb[val];
      }
  }
  // @see: http://www.opencalais.com/documentation/calais-web-service-api/interpreting-api-response/opencalais-json-output-format
  function createHierarchy(flatdb) {
    var hdb = {};
    var element;
    for (element in flatdb) {
      var elementType = flatdb[element]._type;
      var elementGroup = flatdb[element]._typeGroup;
      if (elementGroup) {
        if (!hdb[elementGroup]) hdb[elementGroup] = {};
        if (elementTypenull) {
          if (!hdb[elementGroup][elementType]) hdb[elementGroup][elementType] = {};
          hdb[elementGroup][elementType][element] = flatdb[element];
        } else
          hdb[elementGroup][element] = flatdb[element];
      } else
        hdb[element] = flatdb[element];
    }
    var hdc = {};
    for (element in hdb) {
      var key = element.replace(/\./g, '-');
      hdc[key] = hdb[element];
    }
    return hdc;
  }

  function _get(content, cb){
    var postRequest = {
        host: "api.opencalais.com",
        path: "/tag/rs/enrich",
        port: 80,
        method: "POST",
        headers: {
            'Content-Length': content.length,
            'x-calais-licenseID': apiKey,
            'Content-Type': 'text/html',
            'Accept': 'application/json',
            //'enableMetadataType': 'GenericRelations,SocialTags'
            'enableMetadataType': 'GenericRelations'
        }
    };

    var buffer = "";

    var req = http.request(postRequest, function(res)
    {
        res.setEncoding('utf8');
        res.on("data", function(data){
          buffer = buffer + data;
        });
        res.on("end", function() {
          var ocRes = {};
          try {
            var ocTmp = JSON.parse(buffer);
  //          resolveReferences(ocTmp);
  //          ocRes = createHierarchy(ocTmp);
            ocRes = ocTmp;
          } catch (e) {
            debug(buffer);
          }
          cb(ocRes);
        });
    } );

    req.write(content);
    req.end();
  }
  this.get = function get(doc, cb){
    var now = Date.now();
    if (now - lastCall > 250000) {
      _get(doc.text, cb);
      lastCall = now;
    } else {
      setTimeout(_get, (lastCall + 250000 - now) / 1000, doc.text, cb);
      lastCall += 250000;
    }
  };
};

module.exports = calais;
