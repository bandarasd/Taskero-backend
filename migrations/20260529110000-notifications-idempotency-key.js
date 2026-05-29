"use strict";

var dbm;
var type;
var seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  return db.runSql(`
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS notifications_idempotency_key_idx ON notifications (idempotency_key) WHERE idempotency_key IS NOT NULL;
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP INDEX IF EXISTS notifications_idempotency_key_idx;
    ALTER TABLE notifications DROP COLUMN IF EXISTS idempotency_key;
  `);
};

exports._meta = {
  version: 1,
};
