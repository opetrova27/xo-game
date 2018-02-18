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

const marker = { owner: "X", opponent: "O" };

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
  let winner = false;
  //check horizontal
  for (let row = 0; row < size; row++) {
    winner = checkLine(field[row]);
    if (winner !== false) {
      logger.log('info', '[Game][checkWin] Found row=%s winner=%s', row, winner);
      return winner;
    }
  }
  //check vertical
  let line = [];
  for (let col = 0; col < size; col++) {
    line = [];
    for (let row = 0; row < size; row++) {
      line.push(field[row][col]);
    }
    winner = checkLine(line);
    if (winner !== false) {
      logger.log('info', '[Game][checkWin] Found col=%s winner=%s', col, winner);
      return winner;
    }
  }
  //check diagonal
  let diag1 = [];
  let diag2 = [];
  for (let i = 0; i < size; i++) {
    diag1.push(field[i][i]);
    diag2.push(field[i][size - i - 1]);
  }
  winner = checkLine(diag1);
  if (winner !== false) {
    logger.log('info', '[Game][checkWin] Found diag1 winner=%s', winner);
    return winner;
  }
  winner = checkLine(diag2);
  if (winner !== false) {
    logger.log('info', '[Game][checkWin] Found diag2 winner=%s', winner);
    return winner;
  }
  //check draw
  let all = [];
  for (let row = 0; row < size; row++) {
    all = all.concat(field[row]);
  }
  let draw = all.find(k => k == '?') === undefined;
  return draw ? "draw" : false;
}

function doStep(data, role, row, col) {
  let field = data.field;

  // check if place already marked
  if (field[row][col] != "?") {
    return { status: "error", message: "Cannot move here", code: 20 };
  }

  // update let field
  field[row][col] = marker[role];

  // prepare options for update db
  let expired = new Date();
  expired.setMinutes(expired.getMinutes() + config.expiredGameMinutes);
  let options = {
    field: field,
    current: role === "owner" ? "opponent" : "owner",
    expired: expired
  };

  // check win
  let winner = checkWin(field, data.size);
  if (winner !== false) {
    options.state = "done";
    options.result = winner;
    logger.log('info', '[Game][doStep] Finish winner=%s field=%s', winner, field);
  }

  // update db
  const criteria = { gameToken: data.gameToken };
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').update(criteria, { $set: options });
    })
    .then(function (updated) {
      logger.log('info', '[Game][doStep] updated=%s', updated);
      return { status: "ok", message: "ok", code: 0 };
    })
    .catch(function (err) {
      logger.log('error', '[Game][doStep] error=%s', err);
      return { status: "error", message: "Error while doing step", code: 21 };
    });
}

function prepareStep(gameToken, role, row, col) {
  // find game by token
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').findOne({
        $and: [{ expired: { $gt: new Date() } }, { gameToken: gameToken }, { state: "playing" }]
      });
    })
    .then(function (data) {
      logger.log("info", "[Game][prepareStep] data= %s", data);
      if (data == null) {
        logger.log("info", "[Game][prepareStep] not found ready game with token %s", accessToken, gameToken);
        return { status: "error", code: 17, message: "Not found users" };
      } else if (data.current != role) { // check if user's turn now
        return { status: "error", code: 18, message: "Now is " + data.current + "'s turn!!!" };
      } else if (row < 0 || col < 0 || row >= data.size || col >= data.size) { // validate row and col
        return { status: "error", code: 19, message: "Row or Col is out of range" };
      } else {
        logger.log("info", "[Game][prepareStep] data=%s role=%s", data, role);
        return doStep(data, role, row, col);
      }
    })
    .catch(function (err) {
      logger.log('error', '[Game][prepareStep] error=%s', err);
      res.json({ status: "error", message: "Error while doing step", code: 16 });
    });
}

function state(gameToken, role) {
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').findOne({
        $and: [{ expired: { $gt: new Date() } }, { gameToken: gameToken }]
      });
    })
    .then(function (data) {
      if (data === null) {
        logger.log("info", "[Game][state] not found: gameToken=%s", gameToken);
        return { status: "error", code: 15, message: "Not found users" };
      } else {
        logger.log("info", "[Game][state] data=%s role=%s", data, role);
        let state = {
          gameDuration: (new Date()).getTime() - (new Date(data.started)).getTime(),
          field: data.field
        };
        if (data.result != "") {
          // if game already done
          state.winner = data.result;
        } else if (role != "view") {
          state.youTurn = data.current === role;
        }
        if (role == "view") {
          // for viewer
          state.owner = data.owner;
          state.opponent = data.opponent;
          state.current = data.current;
          state.state = data.state;
        }
        return state;
      }
    })
    .catch(function (err) {
      logger.log('error', '[Game][state] error=%s', err);
      return { status: "error", message: "Error while getting state", code: 14 };
    });
}

function addUserToGame(gameToken, name) {
  const criteria = { gameToken: gameToken };
  let expired = new Date();
  expired.setMinutes(expired.getMinutes() + config.expiredGameMinutes);
  const options = { $set: { opponent: name, current: "opponent", state: "playing", expired: expired } };
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').update(criteria, options);
    })
    .then(function (added) {
      logger.log('info', '[Game][addUserToGame] added=%s', added);
      return { status: "ok" };
    })
    .catch(function (err) {
      logger.log('error', '[Game][addUserToGame] error=%s', err);
      return { status: "error", message: "Error while adding user", code: 13 };
    });
}

function join(gameToken, name) {
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').findOne({
        $and: [{ gameToken: gameToken }, { expired: { $gt: new Date() } }, { opponent: "" }]
      });
    })
    .then(function (data) {
      logger.log("info", "[Game][join] found by gameToken=%s name=%s game: %s", gameToken, name, data);
      if (data === null) {
        return { status: "error", code: 13, message: "There is no current ready games with this token" };
      } else {
        return addUserToGame(gameToken, name);
      }
    })
    .catch(function (err) {
      logger.log('error', '[Game][join] error=%s', err);
      return { status: "error", message: "Error while joining to game", code: 12 };
    });
}

function list() {
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').find(
        { expired: { $gte: new Date() } }).toArray();
    })
    .then(function (foundGamesArray) {
      logger.log('info', '[Game][list] foundGamesArray=%s', foundGamesArray);
      let games = [];
      let gameDuration;
      for (let i = 0; i < foundGamesArray.length; i++) {
        games.push({
          gameToken: foundGamesArray[i].gameToken,
          gameDuration: (new Date()).getTime() - (new Date(foundGamesArray[i].started)).getTime(),
          owner: foundGamesArray[i].owner,
          opponent: foundGamesArray[i].opponent,
          size: foundGamesArray[i].size,
          state: foundGamesArray[i].state,
          gameResult: foundGamesArray[i].result
        });
      }
      return { status: "ok", games: games };
    })
    .catch(function (err) {
      logger.log('error', '[Game][list] error=%s', err);
      return { status: "error", message: "Error while find games", code: 11 };
    });
}

function create(owner, size) {
  let field = [];
  for (let i = 0; i < size; i++) {
    field[i] = [];
    for (let j = 0; j < size; j++) {
      field[i][j] = "?";
    }
  }

  let now = new Date();
  let expired = new Date();
  expired.setMinutes(now.getMinutes() + config.expiredGameMinutes);

  let randtoken = require('rand-token');
  let gameToken = randtoken.generate(8);

  const game = {
    gameToken: gameToken,
    size: size,
    field: field,
    owner: owner,   // owner's name
    opponent: "",   // opponent's name
    current: "",    // Who is next do step? opponent or owner
    state: "ready", // can be also "playing" or "done"
    result: "",     // after finish match sets to "owner"/"opponent" or "draw"
    started: now,
    expired: expired
  };

  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').insert(game)
    })
    .then(function (inserted) {
      logger.log('info', '[Game][create] inserted=%s', inserted);
      return { status: "ok", gameToken: inserted.ops[0].gameToken };
    })
    .catch(function (err) {
      logger.log('error', '[Game][create] error=%s', err);
      return { status: "error", message: "Error while creating game", code: 10 };
    });
}

function getOutdated() {
  //getting outdated game tokens
  return mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').find(
        { expired: { $lt: new Date() } }).toArray();
    })
    .then(function (foundGamesArray) {
      logger.log('info', '[Game][getOutdated] foundGamesArray=%s', foundGamesArray);
      let gameTokenArray = [];
      for (let i = 0; i < foundGamesArray.length; i++) {
        gameTokenArray.push(foundGamesArray[i].gameToken);
      }
      return { status: "ok", gameTokenArray: gameTokenArray };
    })
    .catch(function (err) {
      logger.log('error', '[Game][getOutdated] error=%s', err);
      return { status: "error", message: "Error while find outdated games", code: 11 };
    });
}

function removeOutdated(gameTokenAray) {
  //removing outdated games by game tokens
  mongo.connectAsync(config.mongodburl)
    .then(function (db) {
      return db.db('ozxogame').collection('games').remove({ gameToken: { $in: gameTokenAray } })
    })
    .then(function (removed) {
      logger.log('info', '[Game][removeOutdated] removed=%s', removed);
      return { status: "ok" };
    })
    .catch(function (err) {
      logger.log('error', '[Game][removeOutdated] error=%s', err);
      return { status: "error", message: "Error while removing outdated games", code: 22 };
    });
}

module.exports = {
  create: create,
  list: list,
  join: join,
  step: prepareStep,
  state: state,
  getOutdated: getOutdated,
  removeOutdated: removeOutdated
};