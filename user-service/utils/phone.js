// Normalize phone: decodeURIComponent turns '+' into a space, so we fix it back
module.exports = function normalizePhone(raw) {
  let p = decodeURIComponent(String(raw)).trim();
  if (p.startsWith(" ")) p = "+" + p.slice(1);
  if (!p.startsWith("+")) p = "+" + p;
  return p;
};
