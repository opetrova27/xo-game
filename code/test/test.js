'use strict';

const server = require('../server')(),
  chai = require('chai'),
  request = require('supertest'),
  config = require('../configs'),
  winston = require('winston'),
  logger = winston.createLogger({
    transports: [
      new winston.transports.Console({ level: 'error' }),
      new winston.transports.File({
        filename: config.logfile,
        level: config.loglevel
      })
    ]
  });

server.create(config);
server.start();

const app = server.server,
  expect = chai.expect;

describe('Games API Integration Tests', function () {
  const ownerName = "Pamela";
  const opponentName = "Benedict";

  let gamecreated = {};
  describe('## Create game ', function () {
    it('should create a game', function (done) {
      request(app)
        .post('/games/new')
        .send({
          size: 3,
          name: ownerName
        })
        .end(function (err, res) {
          expect(res.body.status).to.equal("ok");
          expect(res.body.code).to.equal(0);
          expect(res.body.message).to.equal("ok");
          expect(res.body.gameToken).to.be.a('string').to.have.lengthOf(8);
          expect(res.body.accessToken).to.be.a('string').to.have.lengthOf(8);
          expect(res.body.refreshToken).to.be.a('string').to.have.lengthOf(8);
          gamecreated = res.body;
          logger.log('info', '[Create game] gamecreated=%s', gamecreated);
          done();
        });
    });
  });

  describe('#GET /games/list', function () {
    it('should get all games', function (done) {
      request(app)
        .get('/games/list')
        .end(function (err, res) {
          expect(res.body.status).to.equal("ok");
          expect(res.body.code).to.equal(0);
          expect(res.body.message).to.equal("ok");
          expect(res.body.games).to.be.an('array');
          logger.log('info', '[Get all games] games=%s', res.body.games);
          done();
        });
    });
  });


  let opponentjoined = {};
  describe('## Join opponent to game ', function () {
    it('should join opponent to game', function (done) {
      request(app)
        .post('/games/join')
        .send({
          name: opponentName,
          gameToken: gamecreated.gameToken
        })
        .end(function (err, res) {
          expect(res.body.status).to.equal("ok");
          expect(res.body.code).to.equal(0);
          expect(res.body.message).to.equal("ok");
          expect(res.body.accessToken).to.be.a('string').to.have.lengthOf(8);
          expect(res.body.refreshToken).to.be.a('string').to.have.lengthOf(8);
          opponentjoined = res.body;
          opponentjoined.name = opponentName;
          logger.log('info', '[Join opponent] opponentjoined=%s', opponentjoined);
          done();
        });
    });
  });

  //checking double joining
  describe('## Join second opponent to game ', function () {
    it('should not join opponent to game', function (done) {
      request(app)
        .post('/games/join')
        .send({
          name: "Lisa",
          gameToken: gamecreated.gameToken
        })
        .end(function (err, res) {
          expect(res.body.status).to.equal("error");
          expect(res.body.code).to.equal(13);
          done();
        });
    });
  });

  describe('#GET /games/state', function () {
    it('should get game state', function (done) {
      request(app)
        .get('/games/state')
        .set('accessToken', opponentjoined.accessToken)
        .set('name', opponentName)
        .end(function (err, res) {
          expect(res.body.status).to.equal("ok");
          expect(res.body.code).to.equal(0);
          expect(res.body.message).to.equal("ok");
          expect(res.body.field).to.be.an('array');
          expect(res.body.youTurn).to.equal(true);
          logger.log('info', '[Get game state] state=%s', res.body);
          done();
        });
    });
  });

  describe('## Opponent step 1', function () {
    it('should do opponent step', function (done) {
      request(app)
        .post('/games/do_step')
        .set('accessToken', opponentjoined.accessToken)
        .send({
          name: opponentName,
          row: 0,
          col: 0
        })
        .end(function (err, res) {
          expect(res.body.status).to.equal("ok");
          expect(res.body.code).to.equal(0);
          expect(res.body.message).to.equal("ok");
          done();
        });
    });
  });

  describe('#GET /games/state', function () {
    it('should get game state', function (done) {
      request(app)
        .get('/games/state')
        .set('accessToken', gamecreated.accessToken)
        .set('name', ownerName)
        .end(function (err, res) {
          expect(res.body.status).to.equal("ok");
          expect(res.body.code).to.equal(0);
          expect(res.body.message).to.equal("ok");
          expect(res.body.field).to.be.an('array');
          expect(res.body.youTurn).to.equal(true);
          logger.log('info', '[Get game state] state=%s', res.body);
          done();
        });
    });
  });

  //check wrong row
  describe('## Owner step', function () {
    it('should do owner step', function (done) {
      request(app)
        .post('/games/do_step')
        .set('accessToken', gamecreated.accessToken)
        .send({
          name: ownerName,
          row: 5,
          col: 2
        })
        .end(function (err, res) {
          expect(res.body.status).to.equal("error");
          expect(res.body.code).to.equal(19);
          done();
        });
    });
  });

  //success step
  describe('## Owner step 1', function () {
    it('should do owner step', function (done) {
      request(app)
        .post('/games/do_step')
        .set('accessToken', gamecreated.accessToken)
        .send({
          name: ownerName,
          row: 0,
          col: 2
        })
        .end(function (err, res) {
          expect(res.body.status).to.equal("ok");
          expect(res.body.code).to.equal(0);
          expect(res.body.message).to.equal("ok");
          done();
        });
    });
  });

  //check attempt double step
  describe('## Owner step', function () {
    it('should do owner step', function (done) {
      request(app)
        .post('/games/do_step')
        .set('accessToken', gamecreated.accessToken)
        .send({
          name: ownerName,
          row: 1,
          col: 1
        })
        .end(function (err, res) {
          expect(res.body.status).to.equal("error");
          expect(res.body.code).to.equal(18);
          done();
        });
    });
  });

  //check view mode
  describe('#GET /games/state', function () {
    it('should get game state', function (done) {
      request(app)
        .get('/games/state')
        .set('gameToken', gamecreated.gameToken)
        .end(function (err, res) {
          expect(res.body.status).to.equal("ok");
          expect(res.body.code).to.equal(0);
          expect(res.body.message).to.equal("ok");
          expect(res.body.field).to.be.an('array');
          expect(res.body.state).to.equal("playing");
          logger.log('info', '[Get view game state] state=%s', res.body);
          done();
        });
    });
  });

  describe('## Opponent step 2', function () {
    it('should do opponent step', function (done) {
      request(app)
        .post('/games/do_step')
        .set('accessToken', opponentjoined.accessToken)
        .send({
          name: opponentName,
          row: 1,
          col: 1
        })
        .end(function (err, res) {
          expect(res.body.status).to.equal("ok");
          expect(res.body.code).to.equal(0);
          expect(res.body.message).to.equal("ok");
          done();
        });
    });
  });

  describe('## Update owner\'s tokens', function () {
    it('should update owner\'s tokens', function (done) {
      request(app)
        .post('/games/update')
        .set('refreshToken', gamecreated.refreshToken)
        .send({
          name: ownerName
        })
        .end(function (err, res) {
          expect(res.body.status).to.equal("ok");
          expect(res.body.code).to.equal(0);
          expect(res.body.message).to.equal("ok");
          expect(res.body.accessToken).to.be.a('string').to.have.lengthOf(8);
          expect(res.body.refreshToken).to.be.a('string').to.have.lengthOf(8);
          gamecreated.accessToken = res.body.accessToken;
          gamecreated.refreshToken = res.body.refreshToken;
          done();
        });
    });
  });

  describe('## Owner step 2', function () {
    it('should do owner step', function (done) {
      request(app)
        .post('/games/do_step')
        .set('accessToken', gamecreated.accessToken)
        .send({
          name: ownerName,
          row: 1,
          col: 2
        })
        .end(function (err, res) {
          expect(res.body.status).to.equal("ok");
          expect(res.body.code).to.equal(0);
          expect(res.body.message).to.equal("ok");
          done();
        });
    });
  });

  describe('## Opponent step 3', function () {
    it('should do opponent step', function (done) {
      request(app)
        .post('/games/do_step')
        .set('accessToken', opponentjoined.accessToken)
        .send({
          name: opponentName,
          row: 2,
          col: 2
        })
        .end(function (err, res) {
          expect(res.body.status).to.equal("ok");
          expect(res.body.code).to.equal(0);
          expect(res.body.message).to.equal("ok");
          done();
        });
    });
  });

  // checking winner
  describe('#GET /games/state', function () {
    it('should get game state', function (done) {
      request(app)
        .get('/games/state')
        .set('gameToken', gamecreated.gameToken)
        .end(function (err, res) {
          expect(res.body.status).to.equal("ok");
          expect(res.body.code).to.equal(0);
          expect(res.body.message).to.equal("ok");
          expect(res.body.field).to.be.an('array');
          expect(res.body.winner).to.equal('opponent');
          expect(res.body.state).to.equal('done');
          logger.log('info', '[Get game state] state=%s', res.body);
          done();
        });
    });
  });
});