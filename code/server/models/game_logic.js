'use strict';

const
  promise = require('bluebird'),
  config = require("../../configs"),
  mongo = promise.promisifyAll(require('mongodb')).MongoClient;

function addUserToGame(logger, gameToken, name) {
  const criteria = { 'token': gameToken };
  var now = new Date();
  var expired = new Date();
  expired.setMinutes(now.getMinutes() + 5);
  const options = { $set: { opponent: name, current: "opponent", state: "playing", expired: expired } };
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').update(criteria, options);
    })
    .then(function (err, modified, status) {
      logger.log('error', 'addUserToGame err %s', err);
      logger.log('info', 'addUserToGame modified %s', modified);
      logger.log('info', 'addUserToGame modified %s', status);
      return { status: "success" };
    })
    .catch(function (err) {
      logger.log('error', 'addUserToGame error %s', err);
      return { status: "error", message: "Error while add user", code: -1 };
    });
}

function join(logger, gameToken, name) {
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').findOne({
        $and: [{ "token": gameToken }, { "expired": { "$gt": new Date() } }, { opponent: "" }]
      });
    })
    .then(function (data) {
      logger.log("info", "found game: %s", data);
      if (data === undefined || data=== null || typeof data === undefined ) {
        return { status: "error", code: 404, message: "There is no current ready games with this token" };
      } else {
        return addUserToGame(logger, gameToken, name);
      }
    });
}

function list(logger) {
  var now = new Date();
  var started = new Date();
  started.setMinutes((new Date()).getTime() - 5 * 60);

  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').find(
        { "started": { "$gte": started } }).toArray();
    })
    .then(function (result) {
      // var result = data.toArray();
      console.log(result);
      logger.log('info', 'game list result %s', result);
      return { status: "success", result: result };
    })
    .catch(function (err) {
      logger.log('error', 'game list error %s', err);
      return { status: "error", message: "Error while find games", code: -1 };
    });
}

function create(owner, size, logger) {

  var field = [];
  for (var i = 0; i < size; i++) {
    field[i] = [];
    for (var j = 0; j < size; j++) {
      field[i][j] = "?";
    }
  }

  var now = new Date();
  var expired = new Date();
  expired.setMinutes(now.getMinutes() + 5);

  var randtoken = require('rand-token');
  var token = randtoken.generate(8);

  const game = {
    token: token,
    size: size,
    field: field,
    owner: owner,
    opponent: "",
    current: "",
    state: "ready",
    result: "",
    started: now,
    expired: expired
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
      return { status: "error", message: "Error while creating game", code: -1 };
    });
}

module.exports = {
  create: create,
  list: list,
  join: join
};