'use strict';

const chai = require('chai');
const hapi = require('hapi');
const hoek = require('hoek');
const mocha = require('mocha');

const describe = mocha.describe;
const expect = chai.expect;
const it = mocha.it;

const extractCookie = (res) => {
  const cookie = res.headers['set-cookie'][0];
  return cookie.slice(0, cookie.indexOf(';'));
};

const runServer = async (options, callback) => {
  const server = new hapi.Server({
    host: 'localhost',
    address: '127.0.0.1',
  });

  server.route({
    method: 'GET',
    path: '/test',
    handler: (request, h) => {
      if (request.query.test) {
        if (request.query.test === 'delete') {
          delete request.session;
        } else {
          request.session.test = request.query.test;
        }
      }
      return '';
    },
  });

  await server.register({plugin: require('..'), options});

  server.decorate('server', 'testInject', (options) => {
    options = options || {};
    let url = '/test';
    if (options.value) {
      url += '?test=' + options.value;
    }
    const headers = options.cookie ? {cookie: options.cookie} : {};
    return server.inject({url: url, headers: headers});
  });
  server.decorate('server', 'testInjectWithValue', () => server.testInject({value: '1'}));
  server.decorate('server', 'testInjectWithCookie', async () => {
    const res = await server.testInjectWithValue();
    return server.testInject({cookie: extractCookie(res)});
  });
  server.decorate('server', 'testInjectWithCookieAndValue', async () => {
    const res = await server.testInjectWithValue();
    return server.testInject({cookie: extractCookie(res), value: '2'});
  });

  await server.start();
  try {
    await callback(server);
  } finally {
    await server.stop();
  }
};

describe('when key is set', () => {
  describe('and cookie is not set', () => {
    describe('and session is not modified', () => {
      it('should create session and not set cookie', () =>
        runServer({expiresIn: 1000, key: 'test'}, async (server) => {
          const res = await server.testInject();
          expect(res.request.session).to.deep.equal({});
          expect(res.statusCode).to.equal(200);
          expect(res.headers['set-cookie']).to.not.exist;
        }));
    });
    describe('and session is modified', () => {
      it('should create session and set cookie', () =>
        runServer({key: 'test'}, async (server) => {
          const res = await server.testInjectWithValue();
          expect(res.request.session).to.deep.equal({test: '1'});
          expect(res.statusCode).to.equal(200);
          expect(res.headers['set-cookie']).to.exist;
          expect(res.headers['set-cookie'][0]).to.match(
            /^id=[0-9A-Za-z_-]{64}; Secure; HttpOnly; SameSite=Lax; Path=\/$/,
          );
        }));
      describe('and creating id fails', () => {
        it('should reply with internal server error', () =>
          runServer({algorithm: 'invalid', expiresIn: 1000, key: 'test'}, async (server) => {
            const res = await server.testInjectWithValue();
            expect(res.statusCode).to.equal(500);
          }));
      });
      describe('and cache is unavailable', () => {
        it('should reply with internal server error', () =>
          runServer({expiresIn: 1000, key: 'test'}, async (server) => {
            server._core.caches.get('_default').client.stop();
            const res = await server.testInjectWithValue();
            expect(res.statusCode).to.equal(500);
          }));
      });
    });
  });
  describe('and cookie is set', () => {
    describe('and cookie is valid', () => {
      describe('and session is not modified', () => {
        it('should load session and not set cookie', () =>
          runServer({expiresIn: 1000, key: 'test'}, async (server) => {
            const res = await server.testInjectWithCookie();
            expect(res.request.session).to.deep.equal({test: '1'});
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.not.exist;
          }));
        describe('and cache is expired', () => {
          it('should create session and clear cookie', () =>
            runServer({cache: {expiresIn: 1}, expiresIn: 1000, key: 'test'}, async (server) => {
              let res = await server.testInjectWithValue();
              await hoek.wait(1);
              res = await server.testInject({cookie: extractCookie(res)});
              expect(res.request.session).to.deep.equal({});
              expect(res.statusCode).to.equal(200);
              expect(res.headers['set-cookie']).to.exist;
              expect(res.headers['set-cookie'][0]).to.equal(
                'id=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Lax; Path=/',
              );
            }));
        });
        describe('and cache is unavailable', () => {
          it('should reply with internal server error', () =>
            runServer({expiresIn: 1000, key: 'test'}, async (server) => {
              let res = await server.testInjectWithValue();
              server._core.caches.get('_default').client.stop();
              res = await server.testInject({cookie: extractCookie(res)});
              expect(res.statusCode).to.equal(500);
            }));
        });
      });
      describe('and session is modified', () => {
        it('should load session and not set cookie', () =>
          runServer({expiresIn: 1000, key: 'test'}, async (server) => {
            const res = await server.testInjectWithCookieAndValue();
            expect(res.request.session).to.deep.equal({test: '2'});
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.not.exist;
          }));
      });
    });
    describe('and cookie is not valid', () => {
      describe('and session is modified', () => {
        it('should create session and set cookie', () =>
          runServer({expiresIn: 1000, key: 'test'}, async (server) => {
            const res = await server.testInject({
              cookie: 'id=KRf_gZUqEMW66rRSIbZdIEJ07XGZxBAAfqnbNGAtyDDVmMSHbzKoFA7oAkCsvxgfC2xSVJPMvjI', // expired
              value: '1',
            });
            expect(res.request.session).to.deep.equal({test: '1'});
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.exist;
            expect(res.headers['set-cookie'][0]).to.match(
              /^id=[0-9A-Za-z_-]{75}; Max-Age=1; Expires=(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT; Secure; HttpOnly; SameSite=Lax; Path=\/$/,
            );
          }));
      });
    });
  });
});

describe('when key is not set', () => {
  describe('and cookie is not set', () => {
    describe('and session is modified', () => {
      it('should create session and set cookie', () =>
        runServer({cookie: {ttl: 1000}}, async (server) => {
          const res = await server.testInjectWithValue();
          expect(res.request.session).to.deep.equal({test: '1'});
          expect(res.statusCode).to.equal(200);
          expect(res.headers['set-cookie']).to.exist;
          expect(res.headers['set-cookie'][0]).to.match(
            /^id=[0-9A-Za-z_-]{22}; Max-Age=1; Expires=(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT; Secure; HttpOnly; SameSite=Lax; Path=\/$/,
          );
        }));
    });
  });
  describe('and cookie is set', () => {
    describe('and cookie is valid', () => {
      describe('and session is not modified', () => {
        it('should load session and not set cookie', () =>
          runServer({}, async (server) => {
            const res = await server.testInjectWithCookie();
            expect(res.request.session).to.deep.equal({test: '1'});
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.not.exist;
          }));
      });
      describe('and session is modified', () => {
        it('should load session and not set cookie', () =>
          runServer({}, async (server) => {
            const res = await server.testInjectWithCookieAndValue();
            expect(res.request.session).to.deep.equal({test: '2'});
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.not.exist;
          }));
      });
      describe('and session is deleted', () => {
        it('should clear cookie and delete cache', () =>
          runServer({}, async (server) => {
            let res = await server.testInjectWithValue();
            const cookie = extractCookie(res);
            const key = {
              id: cookie.split('=')[1],
              segment: 'session',
            };
            let cache = await server._core.caches.get('_default').client.get(key);
            expect(cache.item).to.deep.equal({test: '1'});
            res = await server.testInject({cookie: cookie, value: 'delete'});
            expect(res.request.session).to.be.undefined;
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.exist;
            expect(res.headers['set-cookie'][0]).to.equal(
              'id=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Lax; Path=/',
            );
            cache = await server._core.caches.get('_default').client.get(key);
            expect(cache).to.be.null;
          }));
      });
    });
    describe('and cookie is not valid', () => {
      describe('and session is not modified', () => {
        it('should create session and clear cookie', () =>
          runServer({}, async (server) => {
            const responses = [
              await server.testInject({cookie: 'id=!'}), // invalid base64
              await server.testInject({cookie: 'id=abcd'}), // short
            ];
            for (const res of responses) {
              expect(res.request.session).to.deep.equal({});
              expect(res.statusCode).to.equal(200);
              expect(res.headers['set-cookie']).to.exist;
              expect(res.headers['set-cookie'][0]).to.equal(
                'id=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Lax; Path=/',
              );
            }
          }));
      });
    });
  });
});
