# hapi-server-session

Simple server-side session support for hapi

[![Build Status](https://travis-ci.org/btmorex/hapi-server-session.svg?branch=master)](https://travis-ci.org/btmorex/hapi-server-session) [![Coverage Status](https://coveralls.io/repos/btmorex/hapi-server-session/badge.svg?branch=master&service=github)](https://coveralls.io/github/btmorex/hapi-server-session?branch=master)

## Install

```shell
$ npm install hapi-server-session
```

## Example

```javascript
'use strict';

const hapi = require('hapi');

const server = new hapi.Server();

server.connection({
  host: 'localhost',
  address: '127.0.0.1',
  port: 8000,
});

server.register({
  register: require('hapi-server-session'),
  options: {
    cookie: {
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
```
