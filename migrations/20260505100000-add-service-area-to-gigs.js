'use strict';

var dbm;
var type;
var seed;

exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function(db) {
  var filePath = __dirname + '/sqls/20260505100000-add-service-area-to-gigs-up.sql';
  return new Promise(function(resolve, reject) {
    require('fs').readFile(filePath, { encoding: 'utf-8' }, function(err, data) {
      if (err) return reject(err);
      db.runSql(data, function(err) {
        if (err) return reject(err);
        resolve();
      });
    });
  });
};

exports.down = function(db) {
  var filePath = __dirname + '/sqls/20260505100000-add-service-area-to-gigs-down.sql';
  return new Promise(function(resolve, reject) {
    require('fs').readFile(filePath, { encoding: 'utf-8' }, function(err, data) {
      if (err) return reject(err);
      db.runSql(data, function(err) {
        if (err) return reject(err);
        resolve();
      });
    });
  });
};

exports._meta = { "version": 1 };
