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
    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(20),
      ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

    ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS refund_percentage INT;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS cancellation_count INT DEFAULT 0;
  `);
};

exports.down = function (db) {
  return db.runSql(`
    ALTER TABLE tasks
      DROP COLUMN IF EXISTS cancelled_by,
      DROP COLUMN IF EXISTS cancelled_at;

    ALTER TABLE payments
      DROP COLUMN IF EXISTS refund_amount,
      DROP COLUMN IF EXISTS refund_percentage;

    ALTER TABLE users
      DROP COLUMN IF EXISTS cancellation_count;
  `);
};

exports._meta = {
  version: 1,
};
