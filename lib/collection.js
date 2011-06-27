var cli         = require('cli').enable('status'); // https://github.com/chriso/cli

var Collection = function Collection(db) {
  var self = this;
  this.db  = db;
};
Collection.prototype.massUpdate = function massUpdate(colName, cond, updFct, toSet, next) {
  var self = this;
  if (typeof next === 'undefined') next = function(){};
  self.db.collection(colName, function(err, collection) {
    if (err) cli.error(err);
    collection.find(cond, function(err, cursor) {
      if (err) cli.error(err);
      cursor.toArray(function(err, items){
        var nb = items.length;
        cli.debug('Nb to update: ' + nb);
        if (0 === nb) {
          self.db.close();
          next();
        } else {
          items.forEach(function(doc){
            var cb = function(res){
              var afterSave = function(err, toto) {
                if (err) {
                  cli.error("Unable to update collection: " + err);
                  debug(res);
                }
                nb--;
                cli.debug('Nb: ' + nb);
                if (0 === nb) {
                  self.db.close();
                  next();
                }
              };
              if (doc._id) {
                var newDoc;
                if (typeof toSet === 'undefined' || toSet === null) {
                  newDoc = doc;
                } else if (typeof toSet === 'Object') {
                  newDoc = toSet;
                } else {
                  newDoc = {$set: {}};
                  newDoc.$set[toSet] = res;
                }
                collection.update({_id: doc._id}, newDoc, {safe:true, upsert: true}, afterSave);
              } else {
                collection.save(doc, {safe: true}, afterSave);
              }
            };
            updFct(doc, cb);
          });
        }
      });
    });
  });
};
exports.Collection = Collection;
