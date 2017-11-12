'use strict';

const crypto = require('crypto');
const hoek = require('hoek');

const defaultOptions = {
  algorithm: 'sha256',
  cache: {
    segment: 'session',
  },
  cookie: {
    isSameSite: 'Lax',
  },
  name: 'id',
  size: 16,
};

const register = (server, options) => {
  options = hoek.applyToDefaults(defaultOptions, options, true);
  hoek.assert(!options.expiresIn || options.key, 'options.expiresIn requires options.key');
  if (!options.cache.expiresIn) {
    const maxExpiresIn = Math.pow(2, 31) - 1;
    options.cache.expiresIn = Math.min(options.expiresIn || maxExpiresIn, maxExpiresIn);
  }

  server.state(options.name, options.cookie);

  const cache = server.cache(options.cache);

  const createSessionId = (randomBytes, expiresAt) => {
    const sessionId = [randomBytes || crypto.randomBytes(options.size)];
    if (options.expiresIn) {
      const buffer = new Buffer(8);
      buffer.writeDoubleBE(expiresAt || Date.now() + options.expiresIn);
      sessionId.push(buffer);
    }
    if (options.key) {
      const hmac = crypto.createHmac(options.algorithm, options.key);
      sessionId.forEach(function (value) {
        hmac.update(value);
      });
      sessionId.push(hmac.digest());
    }
    return hoek.base64urlEncode(Buffer.concat(sessionId));
  };

  const isValidSessionId = (sessionId) => {
    let minSize = options.size;
    if (options.expiresIn) {
      minSize += 8;
    }
    let decodedSessionId;
    try {
      decodedSessionId = hoek.base64urlDecode(sessionId, 'buffer');
    } catch (err) {
      return false;
    }
    if (decodedSessionId.length < minSize) {
      return false;
    }
    const randomBytes = decodedSessionId.slice(0, options.size);
    let expiresAt;
    if (options.expiresIn) {
      expiresAt = decodedSessionId.readDoubleBE(options.size);
      if (Date.now() >= expiresAt) {
        return false;
      }
    }
    return sessionId === createSessionId(randomBytes, expiresAt);
  };

  const loadSession = async (request, h) => {
    const sessionId = request.state[options.name];
    if (sessionId) {
      if (isValidSessionId(sessionId)) {
        request._sessionId = sessionId;
        const value = await cache.get(request._sessionId);
        request.session = value !== null ? value : {};
        request._session = hoek.clone(request.session);
        return h.continue;
      } else {
        h.unstate(options.name);
      }
    }
    request.session = {};
    request._session = {};
    return h.continue;
  };
  server.ext('onPreAuth', loadSession);

  const storeSession = async (request, h) => {
    if (hoek.deepEqual(request.session, request._session)) {
      return h.continue;
    }
    let sessionId = request._sessionId;
    if (!sessionId) {
      sessionId = createSessionId();
      h.state(options.name, sessionId);
    }
    await cache.set(sessionId, request.session, 0);
    return h.continue;
  };
  server.ext('onPreResponse', storeSession);
};

exports.plugin = {
  pkg: require('../package.json'),
  register,
};
