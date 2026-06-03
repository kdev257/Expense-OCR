// vite-wrapper.js
// Monkey-patch Buffer to support 'base64url' encoding in Node.js < 16
const originalToString = Buffer.prototype.toString;
Buffer.prototype.toString = function (encoding, ...args) {
  if (encoding === 'base64url') {
    const base64 = originalToString.call(this, 'base64', ...args);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
  return originalToString.call(this, encoding, ...args);
};

const originalFrom = Buffer.from;
Buffer.from = function (value, encoding, ...args) {
  if (typeof value === 'string' && encoding === 'base64url') {
    let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return originalFrom(base64, 'base64');
  }
  return originalFrom.call(this, value, encoding, ...args);
};

// Now import the actual Vite CLI binary
import('./node_modules/vite/bin/vite.js');
