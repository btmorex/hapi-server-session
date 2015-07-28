'use strict';

var hapi = require('hapi');

var server = new hapi.Server();

server.connection({
  host: 'localhost',
  address: '127.0.0.1',
  port: 8000,
});

server.register({
  register: require('./index.js'),
  options: {
    cookieOptions: {
      isSecure: false,
    },
  },
}, function (err) { if (err) { throw err; } });

server.route({
  method: 'GET',
  path: '/',
  handler: function (request, reply) {
    request.session.views = request.session.views + 1 || 1;
    reply('Views: ' + request.session.views);
  },
});

server.start();
