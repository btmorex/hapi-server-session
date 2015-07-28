'use strict';

const crypto = require('crypto');
const hoek = require('hoek');

const defaultOptions = {
  algorithm: 'sha256',
  cache: {
    segment: 'session',
  },
  cookie: {
    isSecure: true,
    isHttpOnly: true,
  },
  expiresIn: 24 * 60 * 60 * 1000,
  name: 'id',
  size: 16,
};

function register(server, options, next) {
  options = hoek.applyToDefaults(defaultOptions, options);
  if (options.expiresIn && typeof options.cache.expiresIn === 'undefined') {
    options.cache.expiresIn = options.expiresIn;
  }

  server.state(options.name, options.cookie);

  const cache = server.cache(options.cache);

  function createSessionId(randomBytes, expiresAt) {
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
  }

  function isValidSessionId(sessionId) {
    const decodedSessionId = hoek.base64urlDecode(sessionId, 'buffer');
    const randomBytes = decodedSessionId.slice(0, options.size);
    let expiresAt;
    if (options.expiresIn) {
      expiresAt = decodedSessionId.readDoubleBE(options.size);
      if (Date.now() >= expiresAt) {
        return false;
      }
    }
    return sessionId === createSessionId(randomBytes, expiresAt);
  }

  server.ext('onPreAuth', function loadSession(request, reply) {
    function attachSession(err, value) {
      if (err) {
        reply(err);
      }
      request.session = value != null ? value : {};
      request._session = hoek.clone(request.session);
      return reply.continue();
    }

    const sessionId = request.state[options.name];
    if (sessionId) {
      if (isValidSessionId(sessionId)) {
        return cache.get(sessionId, attachSession);
      } else {
        reply.unstate(options.name);
      }
    }
    return attachSession();
  });

  server.ext('onPreResponse', function saveSession(request, reply) {
    if (hoek.deepEqual(request.session, request._session)) {
      return reply.continue();
    }
    let sessionId = request.state[options.name];
    if (!sessionId) {
      try {
        sessionId = createSessionId();
      } catch (err) {
        return reply(err);
      }
      reply.state(options.name, sessionId);
    }
    cache.set(sessionId, request.session, 0, function (err) {
      if (err) {
        return reply(err);
      }
      return reply.continue();
    });
  });

  next();
}

register.attributes = {
  pkg: require('./package.json'),
};

exports.register = register;
