var hoek = require('hoek');
var uuid = require('node-uuid');

var defaultOptions = {
  cacheOptions: {
    expiresIn: 24 * 60 * 60 * 1000,
    segment: 'session'
  },
  cookie: 's',
  cookieOptions: {
    isSecure: true,
    isHttpOnly: true
  }
};

exports.register = function (server, options, next) {
  options = hoek.applyToDefaults(defaultOptions, options);

  server.state(options.cookie, options.cookieOptions);

  var cache = server.cache(options.cacheOptions);

  server.ext('onPreAuth', function (request, reply) {
    var attachSession = function (err, value) {
      if (err) {
        reply(err);
      }
      request.session = value != null ? value : {};
      request._session = hoek.clone(request.session);
      reply.continue();
    };
    var sessionId = request.state[options.cookie];
    if (sessionId) {
      cache.get(sessionId, attachSession);
    } else {
      attachSession();
    }
  });

  server.ext('onPreResponse', function (request, reply) {
    if (hoek.deepEqual(request.session, request._session)) {
      reply.continue();
    } else {
      var sessionId = request.state[options.cookie];
      if (!sessionId) {
        sessionId = uuid.v4();
        reply.state(options.cookie, sessionId);
      }
      cache.set(sessionId, request.session, 0, function (err) {
        if (err) {
          reply(err);
        }
        reply.continue();
      });
    }
  });

  next();
};

exports.register.attributes = {
  pkg: require('./package.json')
};
