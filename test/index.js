'use strict';

const chai = require('chai');
const hapi = require('hapi');
const mocha = require('mocha');

const plugin = require('../index.js');

const beforeEach = mocha.beforeEach;
const describe = mocha.describe;
const expect = chai.expect;
const it = mocha.it;

describe('plugin', function () {
  let server;

  beforeEach(function () {
    server = new hapi.Server();
    server.connection({
      host: 'localhost',
      address: '127.0.0.1',
    });
  });

  describe('#register()', function () {
    it('should not fail', function (done) {
      server.register({
        register: plugin,
      }, function (err) {
        expect(err).to.not.exist; //eslint-disable-line no-unused-expressions
        done(err);
      });
    });
  });
});
