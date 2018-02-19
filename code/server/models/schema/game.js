'use strict';

const
  mongoose = require('mongoose'),
  config = require("../../../configs"),
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

var gameSchema = mongoose.Schema({
  gameToken: String,
  owner: String, // owner's name
  opponent: { // opponent's name
    type: String,
    default: ""
  },
  current: { // Who is next do step? opponent or owner
    type: String,
    default: ""
  },
  state: { // can be also "playing" or "done"
    type: String,
    default: "ready"
  },
  result: { // after finish match sets to "owner"/"opponent" or "draw"
    type: String,
    default: ""
  },
  size: Number,
  field: [[String]],
  started: {
    type: Date,
    default: Date.now
  },
  expired: {
    type: Date,
    default: Date.now
  }
}, { collection: 'games' });

var Game = mongoose.model('Game', gameSchema);

function create(gameToken, field, size, owner) {
  let expired = new Date();
  expired.setMinutes(expired.getMinutes() + config.expiredGameMinutes);

  return mongoose.connect(config.mongodburl)
    .then(function (connected) {
      var newGame = new Game({
        gameToken: gameToken,
        field: field,
        size: size,
        owner: owner,
        expired: expired
      });
      return newGame.save()
        .then(function (inserted) {
          logger.log('info', '[GameSchema][create] inserted=%s', inserted);
          return { status: "ok", gameToken: inserted.gameToken };
        })
        .catch(function (err) {
          if (err) {
            logger.log('error', '[GameSchema][create] error=%s', err);
            return { status: "error", message: "Error while creating game", code: 30 };
          }
        });
    })
    .catch(function (err) {
      logger.log('error', '[GameSchema][create] error=%s', err);
      return { status: "error", message: "Error while creating game", code: 31 };
    });
}

function list(criteria) {
  return mongoose.connect(config.mongodburl)
    .then(function (connected) {
      return Game.find(criteria)
        .then(function (foundGamesArray) {
          logger.log('info', '[GameSchema][list] foundGamesArray=%s', foundGamesArray);
          return { status: "ok", foundGamesArray: foundGamesArray };
        })
        .catch(function (err) {
          if (err) {
            logger.log('error', '[GameSchema][list] error=%s', err);
            return { status: "error", message: "Error while fetching games list", code: 32 };
          }
        });
    })
    .catch(function (err) {
      logger.log('error', '[GameSchema][list] error=%s', err);
      return { status: "error", message: "Error while getting games list", code: 33 };
    });
}

function find(gameToken) {
  return mongoose.connect(config.mongodburl)
    .then(function (connected) {
      return Game.findOne({ $and: [{ gameToken: gameToken }, { expired: { $gt: new Date() } }] })
        .then(function (data) {
          logger.log("info", "[GameSchema][find] found by gameToken=%s; data: %s", gameToken, data);
          return { status: "ok", data: data }
        })
        .catch(function (err) {
          if (err) {
            logger.log('error', '[GameSchema][find] error=%s', err);
            return { status: "error", message: "Error while find game", code: 34 };
          }
        });
    })
    .catch(function (err) {
      logger.log('error', '[GameSchema][find] error=%s', err);
      return { status: "error", message: "Error while find game", code: 35 };
    });
}

function update(gameToken, options) {
  return mongoose.connect(config.mongodburl)
    .then(function (connected) {
      return Game.update({ gameToken: gameToken }, { $set: options })
        .then(function (updated) {
          logger.log('info', '[GameSchema][update] updated=%s', updated);
          return { status: "ok" };
        })
        .catch(function (err) {
          if (err) {
            logger.log('error', '[GameSchema][update] error=%s', err);
            return { status: "error", message: "Error while update game", code: 36 };
          }
        });
    })
    .catch(function (err) {
      logger.log('error', '[GameSchema][update] error=%s', err);
      return { status: "error", message: "Error while update game", code: 37 };
    });
}

function remove(gameTokenAray) {
  return mongoose.connect(config.mongodburl)
    .then(function (connected) {
      return Game.remove({ gameToken: { $in: gameTokenAray } })
        .then(function (removed) {
          logger.log('info', '[GameSchema][remove] removed=%s', removed);
          return { status: "ok" };
        })
        .catch(function (err) {
          if (err) {
            logger.log('error', '[GameSchema][remove] error=%s', err);
            return { status: "error", message: "Error while remove expired games", code: 38 };
          }
        });
    })
    .catch(function (err) {
      logger.log('error', '[GameSchema][remove] error=%s', err);
      return { status: "error", message: "Error while remove expired games", code: 39 };
    });
}

module.exports = {
  create: create,
  list: list,
  find: find,
  update: update,
  remove: remove
}