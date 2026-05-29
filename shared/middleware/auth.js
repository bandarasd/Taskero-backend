const admin = require('../firebaseAdmin');

/**
 * Verifies Firebase ID token from Authorization: Bearer <token> header.
 * Attaches req.user = { firebaseUid, email } on success.
 */
module.exports = async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await Promise.race([
      admin.auth().verifyIdToken(token),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('verifyIdToken timed out')), 10_000)
      ),
    ]);
    req.user = { firebaseUid: decoded.uid, email: decoded.email };
    next();
  } catch (err) {
    console.error('[auth] verifyIdToken error:', err.message);
    return res.status(401).json({ error: 'Unauthorized: invalid token' });
  }
};
