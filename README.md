# hapi-server-session

Simple server-side session support for hapi

[![Build Status](https://travis-ci.org/btmorex/hapi-server-session.svg?branch=master)](https://travis-ci.org/btmorex/hapi-server-session) [![Coverage Status](https://coveralls.io/repos/btmorex/hapi-server-session/badge.svg?branch=master&service=github)](https://coveralls.io/github/btmorex/hapi-server-session?branch=master) ![Dependency Status](https://david-dm.org/btmorex/hapi-server-session.svg)

## Install


    $ npm install hapi-server-session


## Example

```javascript
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
        isSecure: false,
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

### [v4.0.0](https://github.com/btmorex/hapi-server-session/compare/v3.0.2...v4.0.0)

- support hapi v17

### [v3.0.0](https://github.com/btmorex/hapi-server-session/compare/v2.0.5...v3.0.0)

- default `SameSite` flag to `Lax`. Could break sites that require session during certain kinds of cross site requests. See <https://www.owasp.org/index.php/SameSite>
