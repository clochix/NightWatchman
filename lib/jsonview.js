/**
 * @author Benjamin Hollis
 * 
 * This component provides a stream converter that can translate from JSON to HTML.
 * It is compatible with Firefox 3 and up, since it uses many components that are new
 * to Firefox 3.
 */

// Save some tedious typing
function JSONFormatter() {
}
JSONFormatter.prototype = {
  htmlEncode: function (t) {
    return t !== null ? t.toString().replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;") : '';
  },
  
  decorateWithSpan: function (value, className) {
    return '<span class="' + className + '">' + this.htmlEncode(value) + '</span>';
  },
  
  // Convert a basic JSON datatype (number, string, boolean, null, object, array) into an HTML fragment.
  valueToHTML: function(value) {
    var valueType = typeof value;
    
    var output = "";
    if (value === null) {
      output += this.decorateWithSpan('null', 'null');
    }
    else if (value && value.constructor === Array) {
      output += this.arrayToHTML(value);
    }
    else if (valueType === 'object') {
      output += this.objectToHTML(value);
    } 
    else if (valueType === 'number') {
      output += this.decorateWithSpan(value, 'num');
    }
    else if (valueType === 'string') {
      if (/^(http|https):\/\/[^\s]+$/i.test(value)) {
        output += '<a href="' + value + '">' + this.htmlEncode(value) + '</a>';
      } else {
        output += this.decorateWithSpan('"' + value + '"', 'string');
      }
    }
    else if (valueType === 'boolean') {
      output += this.decorateWithSpan(value, 'bool');
    }
    
    return output;
  },
  
  // Convert an array into an HTML fragment
  arrayToHTML: function(json) {
    var output = '[<ul class="array collapsible">';
    var hasContents = false;
    for ( var prop in json ) {
      hasContents = true;
      output += '<li>';
      output += this.valueToHTML(json[prop]);
      output += '</li>';
    }
    output += '</ul>]';
    
    if ( ! hasContents ) {
      output = "[ ]";
    }
    
    return output;
  },
  
  // Convert a JSON object to an HTML fragment
  objectToHTML: function(json) {
    var output = '{<ul class="obj collapsible">';
    var hasContents = false;
    for ( var prop in json ) {
      hasContents = true;
      output += '<li>';
      output += '<span class="prop">' + this.htmlEncode(prop) + '</span>: ';
      output += this.valueToHTML(json[prop]);
      output += '</li>';
    }
    output += '</ul>}';
    
    if ( ! hasContents ) {
      output = "{ }";
    }
    
    return output;
  },
  
  // Convert a whole JSON object into a formatted HTML document.
  jsonToHTML: function(json) {
    var output = '';
    output += '<div id="json">';
    output += this.valueToHTML(json);
    output += '</div>';
    return this.toHTML(output);
  },
  
  // Produce an error document for when parsing fails.
  errorPage: function(error, data, uri) {
    var output = '<div id="error">' + this.stringbundle.GetStringFromName('errorParsing') + '</div>';
    output += '<h1>' + this.stringbundle.GetStringFromName('docContents') + ':</h1>';
    output += '<div id="json">' + this.htmlEncode(data) + '</div>';
    return this.toHTML(output, uri + ' - Error');
  },
  
  // Wrap the HTML fragment in a full document. Used by jsonToHTML and errorPage.
  toHTML: function(content) {
    return '<doctype html>' + 
      '<html><head>' +
      '<link rel="stylesheet" type="text/css" href="jsonview.css">' + 
      '<script type="text/javascript" src="jsonview.js"></script>' + 
      '</head><body>' +
      content + 
      '</body></html>';
  }
};

// JSONView class constructor. Not much to see here.
function JSONView() {  
  // Native JSON implementation, new to FF3
  this.jsonFormatter = new JSONFormatter();
    
    try {
      outputDoc = this.jsonFormatter.jsonToHTML(jsonObj);      
    }
    catch(e) {
      outputDoc = this.jsonFormatter.errorPage(e, this.data, this.uri);
    }
}
exports.JSONFormatter = JSONFormatter;
