/**
 * Waits for PostgreSQL to be ready before proceeding.
 * Used by db:setup to ensure the container is healthy before running migrations.
 */

const { Client } = require('pg');

const config = {
  user: 'dana',
  password: 'dana2002',
  host: 'localhost',
  port: 5432,
  database: 'taskero_db',
};

const MAX_RETRIES = 30;
const RETRY_INTERVAL_MS = 2000;

async function waitForDB() {
  console.log('Waiting for PostgreSQL to be ready...');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const client = new Client(config);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log(`PostgreSQL is ready (attempt ${attempt})`);
      process.exit(0);
    } catch (err) {
      console.log(`Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      await client.end().catch(() => {});
      if (attempt === MAX_RETRIES) {
        console.error('PostgreSQL did not become ready in time.');
        process.exit(1);
      }
      await new Promise((res) => setTimeout(res, RETRY_INTERVAL_MS));
    }
  }
}

waitForDB();
