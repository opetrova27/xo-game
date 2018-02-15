'use strict';

const
  promise = require('bluebird'),
  config = require("../../configs"),
  mongo = promise.promisifyAll(require('mongodb')).MongoClient;

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
  //check horizontal
  for (var row = 0; row < size; row++) {
    if (checkLine(field[row]) != false) {
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
    if (checkLine(line) != false) {
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
  if (checkLine(diag1) != false) {
    logger.log('info', 'Found winner diag1');
    return winner;
  }
  if (checkLine(diag2) != false) {
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

function doStep(data, role, row, col) {
  var field = data.field;
  if (field[row][col] != "?") {
    return { status: "error", message: "Cannot move here", code: -1 };
  }
  field[row][col] = marker[role];
  var response = { status: "success", message: "OK", code: 0 };

  var expired = new Date();
  expired.setMinutes(expired.getMinutes() + 5);
  const options = {
    field: field,
    current: role === "owner" ? "opponent" : "owner",
    expired: expired
  };
  var winner = checkWin(field, size);
  if (winner != false) {
    options.state = "done";
    options.result = winner;
    logger.log('info', 'Finish winner %s field %s', winner, field);
  }

  const criteria = { token: data.gameToken };
  var expired = new Date();
  expired.setMinutes(expired.getMinutes() + 5);
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').update(criteria, { $set: options });
    })
    .then(function (updated) {
      logger.log('info', 'do step %s', updated);
      return response;
    })
    .catch(function (err) {
      logger.log('error', 'do step error %s', err);
      return { status: "error", message: "Error while doing step", code: -1 };
    });
}

function prepareStep(gameToken, role, row, col) {
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').findOne({
        $and: [{ expired: { $gt: new Date() } }, { gameToken: gameToken }]
      });
    })
    .then(function (data) {
      logger.log("info", "step %s", data);
      if (data === null) {
        logger.log("info", "not found ready game with token %s", accessToken, gameToken);
        return { status: "error", code: 404, message: "Not found users" };
      } else if (data.current != role) {
        return { status: "error", code: -1, message: "Now is " + data.current + "'s turn!!!" };
      } else {
        return doStep(data, role, row, col);
      }
    })
    .catch(function (err) {
      logger.log('error', 'step error %s', err);
      return { status: "error", message: "Error while doing step", code: -1 };
    });
}

function addUserToGame(logger, gameToken, name) {
  const criteria = { token: gameToken };
  var expired = new Date();
  expired.setMinutes(expired.getMinutes() + 5);
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
        $and: [{ token: gameToken }, { expired: { $gt: new Date() } }, { opponent: "" }]
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
  var started = new Date();
  started.setMinutes((new Date()).getTime() - 5 * 60);

  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').find(
        { started: { "$gte": started } }).toArray();
    })
    .then(function (result) {
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
  join: join,
  step: prepareStep
};