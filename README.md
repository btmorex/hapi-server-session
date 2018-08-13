# hapi-server-session

Simple server-side session support for hapi

[![npm version](https://badge.fury.io/js/hapi-server-session.svg)](https://badge.fury.io/js/hapi-server-session) [![Build Status](https://travis-ci.org/btmorex/hapi-server-session.svg?branch=master)](https://travis-ci.org/btmorex/hapi-server-session) [![Coverage Status](https://coveralls.io/repos/btmorex/hapi-server-session/badge.svg?branch=master&service=github)](https://coveralls.io/github/btmorex/hapi-server-session?branch=master) [![Dependency Status](https://david-dm.org/btmorex/hapi-server-session.svg)](https://david-dm.org/btmorex/hapi-server-session)

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
    plugin: require('hapi-server-session'),
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
```

## Options

- `algorithm`: [Default: `'sha256'`] algorithm to use during signing
- `cache`: supports the same options as [`server.cache(options)`](<https://hapijs.com/api#server.cache()>)
  - `expiresIn`: [Default: session `expiresIn` if set or `2147483647`] session cache expiration in milliseconds
  - `segment`: [Default: `'session'`] session cache segment
- `cookie`: supports the same options as [`server.state(name, [options])`](<https://hapijs.com/api#server.state()>)
  - `isSameSite`: [Default: `'Lax'`] sets the `SameSite` flag
  - `path`: [Default: `'/'`] sets the `Path` flag
  - `ttl`: [Default: session `expiresIn` if set] sets the `Expires` and `Max-Age` flags
- `expiresIn`: session expiration in milliseconds
- `name`: [Default: `'id'`] name of the cookie
- `key`: signing key. Prevents weaknesses in randomness from affecting overall security
- `size`: [Default: `16`] number of random bytes in the session id

## Questions

### Can you explain what the `expiresIn` and `ttl` options do?

When the session `expiresIn` is not set, the cookie `ttl` is not set and the cache `expiresIn` is `2147483647`. This creates a true session cookie, i.e. one that is deleted when the browser is closed, but will last forever otherwise. This is the default with no configuration.

When the session `expiresIn` is set, it defaults both the cookie `ttl` and the cache `expiresIn` to the same value. This creates a session that will last `expiresIn` milliseconds. Even if the cookie `ttl` is ignored by the browser, the server-side cache will expire.

More complex configurations are possible. For example, when the session `expiresIn` is set and the cookie `ttl` is explicitly set to `null`, a session will last until the browser is closed, but no longer than `expiresIn` milliseconds.

### How do I destroy the session (e.g. to logout a user)?

```javascript
delete request.session;
```

will unset the cookie and delete the session from the cache.

## Changes

### [v4.3.0](https://github.com/btmorex/hapi-server-session/compare/v4.2.0...v4.3.0)

- add way to destroy the session

### [v4.2.0](https://github.com/btmorex/hapi-server-session/compare/v4.1.0...v4.2.0)

- default cookie `path` to `'/'`

### [v4.1.0](https://github.com/btmorex/hapi-server-session/compare/v4.0.0...v4.1.0)

- default cookie `ttl` to session `expiresIn`
- remove `key` requirement on session `expiresIn`

### [v4.0.0](https://github.com/btmorex/hapi-server-session/compare/v3.0.0...v4.0.0)

- support hapi v17

### [v3.0.0](https://github.com/btmorex/hapi-server-session/compare/v2.0.0...v3.0.0)

- default `SameSite` flag to `Lax`. Could break sites that require session during certain kinds of cross site requests. See <https://www.owasp.org/index.php/SameSite>

## Author

[Avery Fay](https://averyfay.com/)
