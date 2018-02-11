'use strict';

const
  config = require("../../configs"),
  promise = require('bluebird'),
  randtoken = require('rand-token'),
  mongo = promise.promisifyAll(require('mongodb')).MongoClient;

function create(name, logger) {
  const user_data = { name: name, accessToken: randtoken.generate(8), refreshToken: randtoken.generate(8) };

  logger.log('info', 'user create user_data %s', user_data);
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame');
    })
    .then(function (db) {
      return db.collection('users').insert(user_data)
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
  create: create
};