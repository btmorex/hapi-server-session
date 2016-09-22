# hapi-server-session

Simple server-side session support for hapi

[![Build Status](https://travis-ci.org/btmorex/hapi-server-session.svg?branch=master)](https://travis-ci.org/btmorex/hapi-server-session) [![Coverage Status](https://coveralls.io/repos/btmorex/hapi-server-session/badge.svg?branch=master&service=github)](https://coveralls.io/github/btmorex/hapi-server-session?branch=master) [![Dependency Status](https://www.versioneye.com/user/projects/57e385216dfcd0003649c8f5/badge.svg?style=flat-square)](https://www.versioneye.com/user/projects/57e385216dfcd0003649c8f5)

## Install


    $ npm install hapi-server-session


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

## Options

- `algorithm`: [Default: `'sha256'`] algorithm to use during signing
- `cache`: supports the same options as [`server.cache(options)`](http://hapijs.com/api#servercacheoptions)
    - `expiresIn`: [Default: session id `expiresIn` if set or `2147483647`] session cache expiration in milliseconds
    - `segment`: [Default: `'session'`] session cache segment
- `cookie`: supports the same options as [`server.state(name, [options])`](http://hapijs.com/api#serverstatename-options)
    - `isSameSite`: [Default: `'Lax'`] sets the `SameSite` flag
- `expiresIn`: session id expiration in milliseconds. Prevents intercepted cookies from working perpetually. Requires `key`
- `name`: [Default: `'id'`] name of the cookie
- `key`: signing key. Prevents weaknesses in randomness from affecting overall security
- `size`: [Default: `16`] number of random bytes in the session id

## Changes

### [v3.0.0](https://github.com/btmorex/hapi-server-session/compare/v2.0.5...v3.0.0)

- default `SameSite` flag to `Lax`. Could break sites that require session during certain kinds of cross site requests. See <https://www.owasp.org/index.php/SameSite>
