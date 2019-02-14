'use strict';

const b64 = require('b64');
const crypto = require('crypto');
const hoek = require('hoek');

const defaultOptions = {
  algorithm: 'sha256',
  cache: {
    segment: 'session',
  },
  cookie: {
    isSameSite: 'Lax',
    path: '/',
  },
  name: 'id',
  size: 16,
};

const register = (server, options) => {
  options = hoek.applyToDefaults(defaultOptions, options, true);
  if (options.cache.expiresIn === undefined) {
    const maxExpiresIn = Math.pow(2, 31) - 1;
    options.cache.expiresIn = Math.min(options.expiresIn || maxExpiresIn, maxExpiresIn);
  }
  if (options.cookie.ttl === undefined) {
    options.cookie.ttl = options.expiresIn;
  }

  server.state(options.name, options.cookie);

  const cache = server.cache(options.cache);

  const createSessionId = (randomBytes, expiresAt) => {
    const sessionId = [randomBytes || crypto.randomBytes(options.size)];
    if (options.key) {
      if (options.expiresIn) {
        const buffer = Buffer.alloc(8);
        buffer.writeDoubleBE(expiresAt || Date.now() + options.expiresIn);
        sessionId.push(buffer);
      }
      const hmac = crypto.createHmac(options.algorithm, options.key);
      sessionId.forEach((value) => hmac.update(value));
      sessionId.push(hmac.digest());
    }
    return b64.base64urlEncode(Buffer.concat(sessionId));
  };

  const isValidSessionId = (sessionId) => {
    let minSize = options.size;
    if (options.key && options.expiresIn) {
      minSize += 8;
    }
    let decodedSessionId;
    try {
      decodedSessionId = b64.base64urlDecode(sessionId, 'buffer');
    } catch (err) {
      return false;
    }
    if (decodedSessionId.length < minSize) {
      return false;
    }
    const randomBytes = decodedSessionId.slice(0, options.size);
    let expiresAt;
    if (options.key && options.expiresIn) {
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
        const session = await cache.get(sessionId);
        if (session !== null) {
          request._sessionId = sessionId;
          request.session = session;
          request._session = hoek.clone(request.session);
          return h.continue;
        }
      }
      // session is invalid or expired
      h.unstate(options.name);
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
    if (request.session === undefined) {
      h.unstate(options.name);
      await cache.drop(sessionId);
      return h.continue;
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
