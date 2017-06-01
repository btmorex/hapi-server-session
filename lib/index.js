'use strict';

const boom = require('boom');
const crypto = require('crypto');
const hoek = require('hoek');
const node = require('when/node');

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

function register(server, options, next) {
  options = hoek.applyToDefaults(defaultOptions, options, true);
  hoek.assert(!options.expiresIn || options.key, 'options.expiresIn requires options.key');
  if (!options.cache.expiresIn) {
    const maxExpiresIn = Math.pow(2, 31) - 1;
    options.cache.expiresIn = Math.min(options.expiresIn || maxExpiresIn, maxExpiresIn);
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
    let minSize = options.size;
    if (options.expiresIn) {
      minSize += 8;
    }
    const decodedSessionId = hoek.base64urlDecode(sessionId, 'buffer');
    if (decodedSessionId instanceof Error || decodedSessionId.length < minSize) {
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
  }

  server.ext('onPreAuth', function loadSession(request, reply) {
    const sessionId = request.state[options.name];
    if (sessionId) {
      if (isValidSessionId(sessionId)) {
        request._sessionId = sessionId;
        node.call(cache.get.bind(cache), request._sessionId)
          .done(function (value) {
            request.session = value[0] !== null ? value[0] : {};
            request._session = hoek.clone(request.session);
            reply.continue();
          }, function (err) {
            reply(boom.wrap(err));
          });
        return;
      } else {
        reply.unstate(options.name);
      }
    }
    request.session = {};
    request._session = {};
    reply.continue();
  });

  server.ext('onPreResponse', function storeSession(request, reply) {
    if (hoek.deepEqual(request.session, request._session)) {
      reply.continue();
      return;
    }
    let sessionId = request._sessionId;
    if (!sessionId) {
      try {
        sessionId = createSessionId();
      } catch (err) {
        reply(boom.wrap(err));
        return;
      }
      reply.state(options.name, sessionId);
    }
    node.call(cache.set.bind(cache), sessionId, request.session, 0)
      .done(function () {
        reply.continue();
      }, function (err) {
        reply(boom.wrap(err));
      });
  });

  next();
}

register.attributes = {
  pkg: require('../package.json'),
};

exports.register = register;
