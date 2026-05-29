const Redis = require('ioredis');

const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  enableOfflineQueue: false,
});

client.on('error', (err) => {
  console.error('[cache] Redis error:', err.message);
});

client.on('connect', () => {
  console.log('[cache] Redis connected');
});

async function get(key) {
  try {
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

async function set(key, value, ttlSeconds) {
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // silently fall through
  }
}

async function del(key) {
  try {
    await client.del(key);
  } catch {
    // silently fall through
  }
}

async function delPattern(pattern) {
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // silently fall through
  }
}

module.exports = { get, set, del, delPattern, client };
