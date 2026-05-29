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
  return db.runSql(
    `ALTER TABLE payments ADD CONSTRAINT payments_stripe_payment_intent_id_uniq UNIQUE (stripe_payment_intent_id);`
  );
};

exports.down = function (db) {
  return db.runSql(
    `ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_stripe_payment_intent_id_uniq;`
  );
};

exports._meta = {
  version: 1,
};
