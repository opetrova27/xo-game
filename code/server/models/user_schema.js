'use strict';

const
  mongoose = require('mongoose'),
  config = require("../../configs"),
  winston = require('winston'),
  logger = require('winston').createLogger({
    transports: [
      new winston.transports.Console({ level: 'error' }),
      new winston.transports.File({
        filename: config.logfile,
        level: config.loglevel
      })
    ]
  });

var userSchema = mongoose.Schema({
  name: String,
  accessToken: String,
  refreshToken: String,
  gameToken: String,
  role: String,
  expired: {
    type: Date,
    default: Date.now
  }
}, { collection: 'users' });

var User = mongoose.model('User', userSchema);

function create(name, accessToken, refreshToken, gameToken, role) {
  return mongoose.connect(config.mongodburl)
    .then(function (connected) {
      let expired = new Date();
      expired.setMinutes(expired.getMinutes() + config.expiredGameMinutes);
      var newUser = new User({
        name: name,
        gameToken: gameToken,
        role: role,
        accessToken: accessToken,
        refreshToken: refreshToken,
        expired: expired
      });
      return newUser.save()
        .then(function (inserted) {
          logger.log('info', '[UserSchema][create] inserted=%s', inserted);
          return { status: "ok", data: inserted };
        })
        .catch(function (err) {
          if (err) {
            logger.log('error', '[UserSchema][create] error=%s', err);
            return { status: "error", message: "Error while creating user", code: 50 };
          }
        });
    })
    .catch(function (err) {
      logger.log('error', '[UserSchema][create] error=%s', err);
      return { status: "error", message: "Error while creating user", code: 51 };
    });
}

function find(criteria) {
  return mongoose.connect(config.mongodburl)
    .then(function (connected) {
      return User.findOne(criteria)
        .then(function (data) {
          logger.log("info", "[UserSchema][find] data: %s", data);
          return { status: "ok", data: data }
        })
        .catch(function (err) {
          if (err) {
            logger.log('error', '[UserSchema][find] error=%s', err);
            return { status: "error", message: "Error while find user", code: 52 };
          }
        });
    })
    .catch(function (err) {
      logger.log('error', '[UserSchema][find] error=%s', err);
      return { status: "error", message: "Error while find user", code: 53 };
    });
}

function update(criteria, options) {
  return mongoose.connect(config.mongodburl)
    .then(function (connected) {
      return User.update(criteria, options)
        .then(function (updated) {
          logger.log('info', '[UserSchema][update] updated=%s', updated);
          return { status: "ok" };
        })
        .catch(function (err) {
          if (err) {
            logger.log('error', '[UserSchema][update] error=%s', err);
            return { status: "error", message: "Error while update user", code: 54 };
          }
        });
    })
    .catch(function (err) {
      logger.log('error', '[UserSchema][update] error=%s', err);
      return { status: "error", message: "Error while update user", code: 55 };
    });
}

function remove(gameTokenAray) {
  return mongoose.connect(config.mongodburl)
    .then(function (connected) {
      return User.remove({ gameToken: { $in: gameTokenAray } })
        .then(function (removed) {
          logger.log('info', '[UserSchema][remove] removed=%s', removed);
          return { status: "ok" };
        })
        .catch(function (err) {
          if (err) {
            logger.log('error', '[UserSchema][remove] error=%s', err);
            return { status: "error", message: "Error while remove expired users", code: 56 };
          }
        });
    })
    .catch(function (err) {
      logger.log('error', '[UserSchema][remove] error=%s', err);
      return { status: "error", message: "Error while remove expired users", code: 57 };
    });
}

module.exports = {
  create: create,
  find: find,
  update: update,
  remove: remove
}