'use strict';

const
  config = require("../../configs"),
  promise = require('bluebird'),
  randtoken = require('rand-token'),
  mongo = promise.promisifyAll(require('mongodb')).MongoClient,
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

function generateTokens(name, gameToken) {
  return { accessToken: randtoken.generate(8), refreshToken: randtoken.generate(8) };
}

function updateTokens(res, name, refreshToken) {
  var response = { status: "OK", code: 0, message: "OK" };
  const tokens = generateTokens();
  const criteria = { $and: [{ name: name }, { refreshToken: refreshToken }] };
  var expired = new Date();
  expired.setMinutes(expired.getMinutes() + 5);
  const options = { $set: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expired: expired } };
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('users').update(criteria, options);
    })
    .then(function (updated) {
      logger.log('info', 'updateUserTokens %s', updated);
      Object.assign(response, tokens);
      res.json(response);
    })
    .catch(function (err) {
      logger.log('error', 'updateUserTokens error %s', err);
      res.json({ status: "error", message: "Error while updateTokens", code: -1 });
    });
}

function checkRefreshToken(req, res) {
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('users').findOne({
        $and: [{ refreshToken: req.body.refreshToken }, { name: req.body.name }]
      });
    })
    .then(function (data) {
      logger.log("info", "checkRefreshToken %s", data);
      if (data === null) {
        logger.log("info", "not found user for refresh with token %s for user %s", req.body.refreshToken, req.body.name);
        res.json({ status: "error", code: 404, message: "Not found users" });
      } else {
        logger.log("info", "found user for refresh: %s", data);
        updateTokens(res, data.name, data.refreshToken);
      }
    })
    .catch(function (err) {
      logger.log('error', 'checkRefreshToken error %s', err);
      res.json({ status: "error", message: "Error while checkRefreshToken", code: -1 });
    });
}

function checkUser(accessToken, name) {
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('users').findOne({
        $and: [{ accessToken: accessToken }, { expired: { $gt: new Date() } }, { name: name }]
      });
    })
    .then(function (data) {
      logger.log("info", "checkUser %s", data);
      if (data === null) {
        logger.log("info", "not found user for access with token %s for user %s", accessToken, name);
        return { status: "error", code: 404, message: "Not found users" };
      } else {
        logger.log("info", "found user for access: %s", data);
        return { status: "success", name: data.name, gameToken: data.gameToken, role: data.role };
      }
    })
    .catch(function (err) {
      logger.log('error', 'checkUser error %s', err);
      return { status: "error", message: "Error while checkUser", code: -1 };
    });
}

function create(name, gameToken, role) {
  const tokens = generateTokens();
  var expired = new Date();
  expired.setMinutes(expired.getMinutes() + 5);
  const user_data = { name: name, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, gameToken: gameToken, role: role, expired: expired };

  logger.log('info', 'user create user_data %s', user_data);
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('users').insert(user_data)
    })
    .then(function (result) {
      logger.log('info', 'user insert result %s', result);
      var resp = { status: "success" };
      Object.assign(resp, result.ops[0]);
      return resp;
    })
    .catch(function (err) {
      logger.log('error', 'user insert err %s', err);
      return { status: "error", message: "Error while creating user", code: -1 };
    });
}

module.exports = {
  create: create,
  updateTokens: checkRefreshToken,
  checkUser: checkUser
};