'use strict';

const hapi = require('hapi');

const main = async () => {
  const server = new hapi.Server({
    host: 'localhost',
    address: '127.0.0.1',
    port: 8000,
  });

  await server.register({
    plugin: require('..'),
    options: {
      cookie: {
        isSecure: false, // never set to false in production
      },
    },
  });

  server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {
      request.session.views = request.session.views + 1 || 1;
      return 'Views: ' + request.session.views;
    },
  });

  await server.start();
};

main().catch(console.error);
