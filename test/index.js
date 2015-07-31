/* eslint no-unused-expressions: 0 */

'use strict';

const chai = require('chai');
const hapi = require('hapi');
const mocha = require('mocha');
const node = require('when/node');
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
      register: require('..'),
      options: options,
    },
  ];
  return node.call(server.register.bind(server), plugins)
    .then(function () { return node.call(server.start.bind(server)); })
    .yield(server);
}

function extractCookie(res) {
  const cookie = res.headers['set-cookie'][0];
  return cookie.slice(0, cookie.indexOf(';'));
}

function inject(server, options) {
  options = options || {};
  const url = options.value ? '/?test=' + options.value : '/';
  const headers = options.cookie ? {cookie: options.cookie} : {};
  return server.injectThen({url: url, headers: headers});
}

function injectWithValue(server) {
  return inject(server, {value: '1'});
}

function injectWithCookie(server) {
  return injectWithValue(server)
    .then(function (res) { return inject(server, {cookie: extractCookie(res)}); });
}

function injectWithCookieAndvalue(server) {
  return injectWithValue(server)
    .then(function (res) { return inject(server, {cookie: extractCookie(res), value: '2'}); });
}

describe('when key is set', function () {
  describe('when cookie is not set', function () {
    describe('when session is not modified', function () {
      it('should create session and not set cookie', function (done) {
        createServer({key: 'test'})
          .then(inject)
          .then(function (res) {
            expect(res.request.session).to.deep.equal({});
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.not.exist;
          })
          .done(done, done);
      });
    });
    describe('when session is modified', function () {
      it('should create session and set cookie', function (done) {
        createServer({key: 'test'})
          .then(injectWithValue)
          .then(function (res) {
            expect(res.request.session).to.deep.equal({test: '1'});
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.exist;
            expect(res.headers['set-cookie'][0]).to.match(/id=[0-9A-Za-z_-]{75}; Secure; HttpOnly/);
          })
          .done(done, done);
      });
      describe('when creating id fails', function () {
        it('should reply with internal server error', function (done) {
          createServer({algorithm: 'invalid', key: 'test'})
            .then(injectWithValue)
            .then(function (res) { expect(res.statusCode).to.equal(500); })
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
            .then(function (res) { expect(res.statusCode).to.equal(500); })
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
            .then(function (res) {
              expect(res.request.session).to.deep.equal({test: '1'});
              expect(res.statusCode).to.equal(200);
              expect(res.headers['set-cookie']).to.not.exist;
            })
            .done(done, done);
        });
        describe('when cache is expired', function () {
          it('should create session and not set cookie', function (done) {
            createServer({key: 'test', cache: {expiresIn: 1}})
              .then(injectWithCookie)
              .then(function (res) {
                expect(res.request.session).to.deep.equal({});
                expect(res.statusCode).to.equal(200);
                expect(res.headers['set-cookie']).to.not.exist;
              })
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
                    return inject(server, {cookie: extractCookie(res)});
                  });
              })
              .then(function (res) { expect(res.statusCode).to.equal(500); })
              .done(done, done);
          });
        });
      });
      describe('when session is modified', function () {
        it('should load session and not set cookie', function (done) {
          createServer({key: 'test'})
            .then(injectWithCookieAndvalue)
            .then(function (res) {
              expect(res.request.session).to.deep.equal({test: '2'});
              expect(res.statusCode).to.equal(200);
              expect(res.headers['set-cookie']).to.not.exist;
            })
            .done(done, done);
        });
      });
    });
    describe('when cookie is not valid', function () {
      describe('when session is modified', function () {
        it('should create session and set cookie', function (done) {
          createServer({key: 'test'})
            .then(function (server) {
              const options = {
                cookie: 'id=KRf_gZUqEMW66rRSIbZdIEJ07XGZxBAAfqnbNGAtyDDVmMSHbzKoFA7oAkCsvxgfC2xSVJPMvjI',
                value: '1',
              };
              return inject(server, options); // expired
            })
            .then(function (res) {
              expect(res.request.session).to.deep.equal({test: '1'});
              expect(res.statusCode).to.equal(200);
              expect(res.headers['set-cookie']).to.exist;
              expect(res.headers['set-cookie'][0]).to.match(/id=[0-9A-Za-z_-]{75}; Secure; HttpOnly/);
            })
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
            .then(function (res) {
              expect(res.request.session).to.deep.equal({test: '1'});
              expect(res.statusCode).to.equal(200);
              expect(res.headers['set-cookie']).to.not.exist;
            })
            .done(done, done);
        });
      });
      describe('when session is modified', function () {
        it('should load session and not set cookie', function (done) {
          createServer({expiresIn: null})
            .then(injectWithCookieAndvalue)
            .then(function (res) {
              expect(res.request.session).to.deep.equal({test: '2'});
              expect(res.statusCode).to.equal(200);
              expect(res.headers['set-cookie']).to.not.exist;
            })
            .done(done, done);
        });
      });
    });
    describe('when cookie is not valid', function () {
      describe('when session is not modified', function () {
        it('should create session and clear cookie', function (done) {
          createServer({expiresIn: null})
            .then(function (server) { return inject(server, {cookie: 'id=abcd'}); }) // short
            .then(function (res) {
              expect(res.request.session).to.deep.equal({});
              expect(res.statusCode).to.equal(200);
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
