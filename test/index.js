'use strict';

const chai = require('chai');
const CatboxMemory = require('catbox-memory');
const hapi = require('hapi');
const mocha = require('mocha');
const node = require('when/node');

const beforeEach = mocha.beforeEach;
const describe = mocha.describe;
const expect = chai.expect;
const it = mocha.it;

describe('plugin', function () {
  let server;
  let cache;

  beforeEach(function () {
    cache = new CatboxMemory();

    server = new hapi.Server({
      cache: {
        engine: cache,
      },
    });

    server.connection({
      host: 'localhost',
      address: '127.0.0.1',
    });

    server.route([
      {
        method: 'GET',
        path: '/',
        handler: function (request, reply) {
          reply(request.session.test);
        },
      },
      {
        method: 'GET',
        path: '/write',
        handler: function (request, reply) {
          request.session.test = request.query.test || true;
          reply(request.session.test);
        },
      },
    ]);
  });

  describe('when session does not exist', function () {
    beforeEach(function (done) {
      const plugin = {
        register: require('../index.js'),
        options: {
          cache: {
            expiresIn: 1,
          },
          key: 'test',
        },
      };
      node.call(server.register.bind(server), plugin)
        .then(function () {
          return node.call(server.start.bind(server));
        })
        .done(done, done);
    });

    describe('when session is not written to', function () {
      it('should create a session, but not set a cookie', function (done) {
        server.inject('/', function (response) {
          try {
            expect(response.statusCode).to.equal(200);
            expect(response.request.session).to.deep.equal({});
            expect(response.headers['set-cookie']).to.not.exist; //eslint-disable-line no-unused-expressions
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });

    describe('when session is written to', function () {
      it('should create a session, and set a cookie', function (done) {
        server.inject('/write', function (response) {
          try {
            expect(response.statusCode).to.equal(200);
            expect(response.request.session).to.deep.equal({test: true});
            expect(response.headers['set-cookie'][0]).to.match(/id=[0-9A-Za-z_-]{75}; Secure; HttpOnly/);
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });

    describe('when cookie is valid', function () {
      it('should create a session, but not set a cookie', function (done) {
        server.inject('/write', function (initialResponse) {
          const setCookie = initialResponse.headers['set-cookie'][0];
          const options = {
            url: '/',
            headers: {
              cookie: setCookie.slice(0, setCookie.indexOf(';')),
            },
          };
          server.inject(options, function (response) {
            try {
              expect(response.statusCode).to.equal(200);
              expect(response.request.session).to.deep.equal({});
              expect(response.headers['set-cookie']).to.not.exist; //eslint-disable-line no-unused-expressions
              done();
            } catch (err) {
              done(err);
            }
          });
        });
      });
    });

    describe('when cookie is too short', function () {
      it('should clear the cookie', function (done) {
        const options = {
          url: '/',
          headers: {
            cookie: 'id=abcd',
          },
        };
        server.inject(options, function (response) {
          try {
            expect(response.statusCode).to.equal(200);
            expect(response.request.session).to.deep.equal({});
            const clear = 'id=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly';
            expect(response.headers['set-cookie'][0]).to.equal(clear);
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });

    describe('when cookie is expired', function () {
      it('should clear the cookie', function (done) {
        const options = {
          url: '/',
          headers: {
            cookie: 'id=KRf_gZUqEMW66rRSIbZdIEJ07XGZxBAAfqnbNGAtyDDVmMSHbzKoFA7oAkCsvxgfC2xSVJPMvjI',
          },
        };
        server.inject(options, function (response) {
          try {
            expect(response.statusCode).to.equal(200);
            expect(response.request.session).to.deep.equal({});
            const clear = 'id=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly';
            expect(response.headers['set-cookie'][0]).to.equal(clear);
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });

    describe('when cache is unavailable', function () {
      it('should reply with service unavailable', function (done) {
        cache.stop();
        server.inject('/write', function (response) {
          try {
            expect(response.statusCode).to.equal(503);
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });
  });

  describe('when session does exist', function () {
    beforeEach(function (done) {
      const plugin = {
        register: require('../index.js'),
        options: {
          expiresIn: null,
        },
      };
      node.call(server.register.bind(server), plugin)
        .then(function () {
          return node.call(server.start.bind(server));
        })
        .done(done, done);
    });

    describe('when cookie is valid', function () {
      it('should load the session', function (done) {
        server.inject('/write', function (initialResponse) {
          const setCookie = initialResponse.headers['set-cookie'][0];
          const options = {
            url: '/',
            headers: {
              cookie: setCookie.slice(0, setCookie.indexOf(';')),
            },
          };
          server.inject(options, function (response) {
            try {
              expect(response.request.headers.cookie).to.equal(options.headers.cookie);
              expect(response.statusCode).to.equal(200);
              expect(response.request.session).to.deep.equal({test: true});
              done();
            } catch (err) {
              done(err);
            }
          });
        });
      });
    });

    describe('when cookie is valid and session is written to', function () {
      it('should load the session', function (done) {
        server.inject('/write', function (initialResponse) {
          const setCookie = initialResponse.headers['set-cookie'][0];
          const options = {
            url: '/write?test=different',
            headers: {
              cookie: setCookie.slice(0, setCookie.indexOf(';')),
            },
          };
          server.inject(options, function () {
            options.url = '/';
            server.inject(options, function (response) {
              try {
                expect(response.request.headers.cookie).to.equal(options.headers.cookie);
                expect(response.statusCode).to.equal(200);
                expect(response.request.session).to.deep.equal({test: 'different'});
                done();
              } catch (err) {
                done(err);
              }
            });
          });
        });
      });
    });

    describe('when cache is unavailable', function () {
      it('should reply with service unavailable', function (done) {
        server.inject('/write', function (initialResponse) {
          const setCookie = initialResponse.headers['set-cookie'][0];
          const options = {
            url: '/',
            headers: {
              cookie: setCookie.slice(0, setCookie.indexOf(';')),
            },
          };
          cache.stop();
          server.inject(options, function (response) {
            try {
              expect(response.statusCode).to.equal(503);
              done();
            } catch (err) {
              done(err);
            }
          });
        });
      });
    });
  });

  describe('when creating a session id fails', function () {
    it('should reply with internal server error', function (done) {
      const plugin = {
        register: require('../index.js'),
        options: {
          algorithm: 'bad',
          key: 'test',
        },
      };
      node.call(server.register.bind(server), plugin)
        .then(function () {
          return node.call(server.start.bind(server));
        })
        .done(function () {
          server.inject('/write', function (response) {
            try {
              expect(response.statusCode).to.equal(500);
              done();
            } catch (err) {
              done(err);
            }
          });
        }, done);
    });
  });
});
