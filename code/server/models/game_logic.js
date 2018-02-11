'use strict';

const
  promise = require('bluebird'),
  config = require("../../configs"),
  mongo = promise.promisifyAll(require('mongodb')).MongoClient;

function create(owner, size, logger) {

  var state = [];
  for (var i = 0; i < size; i++) {
    state[i] = [];
    for (var j = 0; j < size; j++) {
      state[i][j] = "?";
    }
  }

  var now = new Date();
  var expired = new Date();
  expired.setMinutes(now.getMinutes() + 20);

  var randtoken = require('rand-token');
  var token = randtoken.generate(8);

  const game = {
    token: token,
    size: size,
    state: state,
    owner: owner,
    opponent: "",
    current: "",
    gameResult: "",
    gameStarted: now,
    gameExpired: expired
  };

  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame');
    })
    .then(function (db) {
      return db.collection('games').insert(game)
    })
    .then(function (result) {
      logger.log('info', 'game insert result %s', result);
      return { status: "success", gameToken: result.ops[0].token };
    })
    .catch(function (err) {
      logger.log('error', 'game insert error');
      return { status: "error", message: "Error while creating user", code: -1 };
    });
}

module.exports = {
  create: create
};