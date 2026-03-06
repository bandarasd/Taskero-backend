'use strict';

var dbm;
var type;
var seed;

/**
  * We receive the dbmigrate dependency from main.js
  */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function(db) {
  return db.addColumn('users', 'role', {
    type: 'string',
    length: 20,
    defaultValue: 'customer'
  });
};

exports.down = function(db) {
  return db.removeColumn('users', 'role');
};

exports._meta = {
  "version": 1
};
