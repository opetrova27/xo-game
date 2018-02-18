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
  // regenerating tokens and update them in db
  const criteria = { $and: [{ name: name }, { refreshToken: refreshToken }] };
  let expired = new Date();
  expired.setMinutes(expired.getMinutes() + config.expiredUserMinutes);
  const tokens = generateTokens();
  const options = { $set: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expired: expired } };
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('users').update(criteria, options);
    })
    .then(function (updated) {
      logger.log('info', '[User][updateTokens] updated=%s', updated);
      let response = { status: "ok", code: 0, message: "ok" };
      Object.assign(response, tokens);
      res.json(response);
    })
    .catch(function (err) {
      logger.log('error', '[User][updateTokens] error=%s', err);
      res.json({ status: "error", message: "Error while updating tokens", code: 1 });
    });
}

function checkRefreshToken(req, res) {
  // checking user refreshToken for repairing both tokens
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('users').findOne({
        $and: [{ refreshToken: req.get("refreshToken") }, { name: req.body.name }]
      });
    })
    .then(function (data) {
      if (data === null) {
        logger.log("info", "[User][checkRefreshToken] not found: refreshToken=%s name=%s", req.get("refreshToken"), req.body.name);
        res.json({ status: "error", code: 2, message: "Not found user with this refresh token" });
      } else {
        logger.log("info", "[User][checkRefreshToken] data=%s", data);
        updateTokens(res, data.name, data.refreshToken);
      }
    })
    .catch(function (err) {
      logger.log('error', '[User][checkRefreshToken]  error=%s', err);
      res.json({ status: "error", message: "Error while checking refresh token", code: 2 });
    });
}

function checkUser(accessToken, name) {
  // checking user accessToken
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('users').findOne({
        $and: [{ accessToken: accessToken }, { expired: { $gt: new Date() } }, { name: name }]
      });
    })
    .then(function (data) {
      if (data === null) {
        logger.log("info", "[User][checkRefreshToken] not found: accessToken=%s name=%s", accessToken, name);
        return { status: "error", code: 5, message: "Not found users" };
      } else {
        logger.log("info", "[User][checkRefreshToken] data=%s", data);
        return { status: "ok", name: data.name, gameToken: data.gameToken, role: data.role };
      }
    })
    .catch(function (err) {
      logger.log('error', '[User][checkRefreshToken] error=%s', err);
      return { status: "error", message: "Error while checking user", code: 3 };
    });
}

function create(name, gameToken, role) {
  // user creates with two tokens:
  // - accessToken has expired date
  // - refreshToken - uses for regenerate both tokens
  // also if accessToken will be compromated - fake user can use it only until expired date
  // and veritable user can repair accessToken with help of refreshToken
  const tokens = generateTokens();
  let expired = new Date();
  expired.setMinutes(expired.getMinutes() + config.expiredUserMinutes);
  const user_data = { name: name, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, gameToken: gameToken, role: role, expired: expired };
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('users').insert(user_data)
    })
    .then(function (inserted) {
      logger.log('info', '[User][create] inserted=%s', inserted);
      let response = { status: "ok", message: "ok", code: 0 };
      Object.assign(response, inserted.ops[0]);
      return response;
    })
    .catch(function (err) {
      logger.log('error', '[User][create] error=%s', err);
      return { status: "error", message: "Error while creating user", code: 4 };
    });
}

function remove(gameTokenAray) {
  // removing users for expired games
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('users').remove({ gameToken: { $in: gameTokenAray } })
    })
    .then(function (removed) {
      logger.log('info', '[User][remove] removed=%s', removed);
      return { status: "ok" };
    })
    .catch(function (err) {
      logger.log('error', '[User][remove] error=%s', err);
      return { status: "error", message: "Error while removing outdated users", code: 22 };
    });
}

module.exports = {
  create: create,
  updateTokens: checkRefreshToken,
  checkUser: checkUser,
  remove: remove
};