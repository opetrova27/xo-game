'use strict';

const
  promise = require('bluebird'),
  config = require("../../configs"),
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

const marker = { owner: "O", opponent: "X" };

function checkLine(line) {
  if (line.every(v => v === marker.owner)) {
    return "owner";
  }
  if (line.every(v => v === marker.opponent)) {
    return "opponent";
  }
  return false;
}

function checkWin(field, size) {
  var winner = false;
  //check horizontal
  for (var row = 0; row < size; row++) {
    winner = checkLine(field[row]);
    if (winner !== false) {
      logger.log('info', 'Found winner row %s', row);
      return winner;
    }
  }
  //check vertical
  var line = [];
  for (var col = 0; col < size; col++) {
    line = [];
    for (var row = 0; row < size; row++) {
      line.push(field[row][col]);
    }
    winner = checkLine(line);
    if (winner !== false) {
      logger.log('info', 'Found winner col %s', col);
      return winner;
    }
  }
  //check diagonal
  var diag1 = [];
  var diag2 = [];
  for (var i = 0; i < size; i++) {
    diag1.push(field[i][i]);
    diag2.push(field[i][size - i - 1]);
  }
  winner = checkLine(diag1);
  if (winner !== false) {
    logger.log('info', 'Found winner diag1');
    return winner;
  }
  winner = checkLine(diag2);
  if (winner !== false) {
    logger.log('info', 'Found winner diag2');
    return winner;
  }
  //check draw
  var all = [];
  for (var row = 0; row < size; row++) {
    all = all.concat(field[row]);
  }
  var draw = all.find(k => k == '?') === undefined;
  return draw ? "draw" : false;
}

function doStep(res, data, role, row, col) {
  var field = data.field;

  // check if place already marked
  if (field[row][col] != "?") {
    res.json({ status: "error", message: "Cannot move here", code: -1 });
  }

  // update var field
  field[row][col] = marker[role];

  // prepare options for update db
  var expired = new Date();
  expired.setMinutes(expired.getMinutes() + config.expiredGameMinutes);
  var options = {
    field: field,
    current: role === "owner" ? "opponent" : "owner",
    expired: expired
  };

  // check win
  var winner = checkWin(field, data.size);
  if (winner !== false) {
    options.state = "done";
    options.result = winner;
    logger.log('info', 'Finish winner %s field %s', winner, field);
  }

  // update db
  const criteria = { gameToken: data.gameToken };
  logger.log('info', 'update db options %s', options);
  mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').update(criteria, { $set: options });
    })
    .then(function (updated) {
      logger.log('info', 'updated: do step %s', updated);
      res.json({ status: "success", message: "OK", code: 0 });
    })
    .catch(function (err) {
      logger.log('error', 'do step error %s', err);
      res.json({ status: "error", message: "Error while doing step", code: -1 });
    });
}

function prepareStep(res, gameToken, role, row, col) {
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').findOne({
        $and: [{ expired: { $gt: new Date() } }, { gameToken: gameToken }, { state: "playing" }]
      });
    })
    .then(function (data) {
      logger.log("info", "step %s role %s", data, role);
      if (data === null) {
        logger.log("info", "not found ready game with token %s", accessToken, gameToken);
        res.json({ status: "error", code: 404, message: "Not found users" });
      } else if (data.current != role) {
        res.json({ status: "error", code: -1, message: "Now is " + data.current + "'s turn!!!" });
      } else if (row < 0 || col < 0 || row >= data.size || col >= data.size) {
        res.json({ status: "error", code: -1, message: "Row or Col is out of range" });
      } else {
        doStep(res, data, role, row, col);
      }
    })
    .catch(function (err) {
      logger.log('error', 'step error %s', err);
      res.json({ status: "error", message: "Error while doing step", code: -1 });
    });
}

function state(res, gameToken, role) {
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').findOne({
        $and: [{ expired: { $gt: new Date() } }, { gameToken: gameToken }]
      });
    })
    .then(function (data) {
      logger.log("info", "state %s role %s", data, role);
      if (data === null) {
        logger.log("info", "not found ready game with token %s", accessToken, gameToken);
        res.json({ status: "error", code: 404, message: "Not found users" });
      } else {
        var response = {
          status: "success", message: "OK", code: 0,
          gameDuration: (new Date()).getTime() - (new Date(data.started)).getTime(),
          field: data.field
        };
        if (data.result != "") {
          response.winner = data.result;
        } else {
          response.youTurn = data.current === role;
        }
        res.json(response);
      }
    })
    .catch(function (err) {
      logger.log('error', 'state error %s', err);
      res.json({ status: "error", message: "Error while getting state", code: -1 });
    });
}

function addUserToGame(logger, gameToken, name) {
  const criteria = { gameToken: gameToken };
  var expired = new Date();
  expired.setMinutes(expired.getMinutes() + config.expiredGameMinutes);
  const options = { $set: { opponent: name, current: "opponent", state: "playing", expired: expired } };
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').update(criteria, options);
    })
    .then(function (added) {
      logger.log('info', 'addUserToGame %s', added);
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
        $and: [{ gameToken: gameToken }, { expired: { $gt: new Date() } }, { opponent: "" }]
      });
    })
    .then(function (data) {
      logger.log("info", "found game: %s", data);
      if (data === null) {
        return { status: "error", code: 404, message: "There is no current ready games with this token" };
      } else {
        return addUserToGame(logger, gameToken, name);
      }
    });
}

function list(logger) {
  var now = new Date();
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').find(
        { expired: { "$gte": now } }).toArray();
    })
    .then(function (result) {
      console.log(result);
      logger.log('info', 'game list result %s', result);
      var games = [];
      var gameDuration;
      for (var i = 0; i < result.length; i++) {
        games.push({
          gameToken: result[i].gameToken,
          gameDuration: (new Date()).getTime() - (new Date(result[i].started)).getTime(),
          owner: result[i].owner,
          opponent: result[i].opponent,
          size: result[i].size,
          state: result[i].state,
          gameResult: result[i].result
        });
      }
      return { status: "success", result: games };
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
  expired.setMinutes(now.getMinutes() + config.expiredGameMinutes);

  var randtoken = require('rand-token');
  var gameToken = randtoken.generate(8);

  const game = {
    gameToken: gameToken,
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
      return { status: "success", gameToken: result.ops[0].gameToken };
    })
    .catch(function (err) {
      logger.log('error', 'game insert error');
      return { status: "error", message: "Error while creating game", code: -1 };
    });
}

module.exports = {
  create: create,
  list: list,
  join: join,
  step: prepareStep,
  state: state
};