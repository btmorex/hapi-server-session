/* eslint no-unused-expressions: 0 */

'use strict';

const chai = require('chai');
const hapi = require('hapi');
const hoek = require('hoek');
const mocha = require('mocha');
const node = require('when/node');
const util = require('util');
const when = require('when');

const describe = mocha.describe;
const expect = chai.expect;
const it = mocha.it;

function createServer(options) {
  const server = new hapi.Server();
  server.connection({
    host: 'localhost',
    address: '127.0.0.1',
  });
  server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {
      if (request.query.test) {
        request.session.test = request.query.test;
      }
      reply(request.session.test);
    },
  });
  const plugins = [
    {
      register: require('inject-then'),
      options: {
        Promise: when.Promise,
      },
    },
    {
      register: require('../index.js'),
      options: options,
    }
  ];
  return node.call(server.register.bind(server), plugins)
    .then(function () {
      node.call(server.start.bind(server));
    })
    .yield(server);
}

function extractCookie(res) {
  let cookie = res.headers['set-cookie'][0];
  return cookie.slice(0, cookie.indexOf(';'));
}

function inject(server, value, cookie) {
  const url = value ? '/?test=' + value : '/';
  const options = {url: url};
  if (!util.isNullOrUndefined(cookie)) {
    options.headers = {cookie: cookie};
  }
  return server.injectThen(options);
}

function injectWithValue(server, value) {
  return inject(server, value || '1');
}

function injectWithCookie(server, value) {
  return injectWithValue(server)
    .then(function (res) {
      return inject(server, value, extractCookie(res));
    });
}

function injectWithCookieAndvalue(server) {
  return injectWithCookie(server, '2');
}

function expectFailure(res) {
  expect(res.statusCode).to.equal(500);
}

function expectSuccess(res, value) {
  expect(res.request.session).to.deep.equal(value ? {test: value} : {});
  expect(res.statusCode).to.equal(200);
}

function expectSuccessWithoutCookie(res, value) {
  expectSuccess(res, value);
  expect(res.headers['set-cookie']).to.not.exist;
}

function expectSuccessWithCookie(res, value) {
  expectSuccess(res, value);
  expect(res.headers['set-cookie']).to.exist;
  expect(res.headers['set-cookie'][0]).to.match(/id=[0-9A-Za-z_-]{32,75}; Secure; HttpOnly/);
}

describe('when key is set', function () {
  describe('when cookie is not set', function () {
    describe('when session is not modified', function () {
      it('should create session and not set cookie', function (done) {
        createServer({key: 'test'})
          .then(inject)
          .then(expectSuccessWithoutCookie)
          .done(done, done);
      });
    });
    describe('when session is modified', function () {
      it('should create session and set cookie', function (done) {
        createServer({key: 'test'})
          .then(injectWithValue)
          .then(function (res) { expectSuccessWithCookie(res, '1'); })
          .done(done, done);
      });
      describe('when creating id fails', function () {
        it('should reply with internal server error', function (done) {
          createServer({algorithm: 'invalid', key: 'test'})
            .then(injectWithValue)
            .then(expectFailure)
            .done(done, done);
        });
      });
      describe('when cache is unavailable', function () {
        it('should reply with internal server error', function (done) {
          createServer({key: 'test'})
            .then(function (server) {
              server._caches._default.client.stop();
              return server;
            })
            .then(injectWithValue)
            .then(expectFailure)
            .done(done, done);
        });
      });
    });
  });
  describe('when cookie is set', function () {
    describe('when cookie is valid', function () {
      describe('when session is not modified', function () {
        it('should load session and not set cookie', function (done) {
          createServer({key: 'test'})
            .then(injectWithCookie)
            .then(function (res) { expectSuccessWithoutCookie(res, '1'); })
            .done(done, done);
        });
        describe('when cache is expired', function () {
          it('should create session and not set cookie', function (done) {
            createServer({key: 'test', cache: {expiresIn: 1}})
              .then(function (server) {
                return injectWithValue(server)
                  .then(function (res) {
                    return inject(server, undefined, extractCookie(res));
                  })
              })
              .then(expectSuccessWithoutCookie)
              .done(done, done);
          });
        });
        describe('when cache is unavailable', function () {
          it('should reply with internal server error', function (done) {
            createServer({key: 'test'})
              .then(function (server) {
                return injectWithValue(server)
                  .then(function (res) {
                    server._caches._default.client.stop();
                    return inject(server, undefined, extractCookie(res));
                  })
              })
              .then(expectFailure)
              .done(done, done);
          });
        });
      });
      describe('when session is modified', function () {
        it('should load session and not set cookie', function (done) {
          createServer({key: 'test'})
            .then(injectWithCookieAndvalue)
            .then(function (res) { expectSuccessWithoutCookie(res, '2'); })
            .done(done, done);
        });
      });
    });
    describe('when cookie is not valid', function () {
      describe('when session is modified', function () {
        it('should create session and set cookie', function (done) {
          createServer({key: 'test'})
            .then(function (server) {
              return inject(server, '1', 'id=KRf_gZUqEMW66rRSIbZdIEJ07XGZxBAAfqnbNGAtyDDVmMSHbzKoFA7oAkCsvxgfC2xSVJPMvjI'); // expired
            })
            .then(function (res) { expectSuccessWithCookie(res, '1'); })
            .done(done, done);
        });
      });
    });
  });
});

describe('when key is not set', function () {
  describe('when cookie is set', function () {
    describe('when cookie is valid', function () {
      describe('when session is not modified', function () {
        it('should load session and not set cookie', function (done) {
          createServer({expiresIn: null})
            .then(injectWithCookie)
            .then(function (res) { expectSuccessWithoutCookie(res, '1'); })
            .done(done, done);
        });
      });
      describe('when session is modified', function () {
        it('should load session and not set cookie', function (done) {
          createServer({expiresIn: null})
            .then(injectWithCookieAndvalue)
            .then(function (res) { expectSuccessWithoutCookie(res, '2'); })
            .done(done, done);
        });
      });
    });
    describe('when cookie is not valid', function () {
      describe('when session is not modified', function () {
        it('should create session and clear cookie', function (done) {
          createServer({expiresIn: null})
            .then(function (server) {
              return inject(server, undefined, 'id=abcd'); // short
            })
            .then(function (res) {
              expectSuccess(res);
              const clear = 'id=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly';
              expect(res.headers['set-cookie']).to.exist;
              expect(res.headers['set-cookie'][0]).to.equal(clear);
            })
            .done(done, done);
        });
      });
    });
  });
});
