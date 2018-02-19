'use strict';

const
  gameSchema = require("../schema/game"),
  config = require("../../../configs"),
  randtoken = require('rand-token'),
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
  return gameSchema.create(randtoken.generate(8), field, size, owner);
}

function list() {
  return gameSchema.list({ expired: { $gte: new Date() } })
    .then(function (response) {
      let games = [];
      if (response.status == "ok") {
        const foundGamesArray = response.foundGamesArray;
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
      }
      return { status: "ok", games: games };
    });
}

function join(gameToken, name) {
  return gameSchema.find(gameToken)
    .then(function (response) {
      if (response.status == 'ok') {
        if (response.data === null) {
          return { status: "error", code: 10, message: "There is no current ready games with this token" };
        } else if (response.data.opponent != "") {
          return { status: "error", code: 11, message: "Opponent's place already busy" };
        } else {
          let expired = new Date();
          expired.setMinutes(expired.getMinutes() + config.expiredGameMinutes);
          return gameSchema.update(gameToken, { opponent: name, current: "opponent", state: "playing", expired: expired });
        }
      } else {
        return response;
      }
    });
}

function prepareStep(gameToken, role, row, col) {
  return gameSchema.find(gameToken)
    .then(function (response) {
      if (response.status == 'ok') {
        if (response.data === null) {
          return { status: "error", code: 12, message: "There is no current ready games with this token" };

          // check if game over
        } else if (response.data.state == "done") {
          return { status: "error", code: 13, message: "Game over" };

          // check if there is no opponent
        } else if (response.data.state == "ready") {
          return { status: "error", code: 14, message: "Need joined opponent" };

          // check if user's turn now
        } else if (response.data.current != role) {
          return { status: "error", code: 15, message: "Now is " + response.data.current + "'s turn!!!" };

          // validate row and col
        } else if (row < 0 || col < 0 || row >= response.data.size || col >= response.data.size) {
          return { status: "error", code: 16, message: "Row or Col is out of range" };

        } else {
          logger.log("info", "[Game][prepareStep] data=%s role=%s", response.data, role);
          return doStep(response.data, role, row, col);
        }
      } else {
        return response;
      }
    });
}

function doStep(data, role, row, col) {
  let field = data.field;

  // check if place already marked
  if (field[row][col] != "?") {
    return { status: "error", message: "Cannot move here", code: 17 };
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

  return gameSchema.update(data.gameToken, options);
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

function checkLine(line) {
  if (line.every(v => v === marker.owner)) {
    logger.log('info', '[Game][checkLine] Found line=%s', line);
    return "owner";
  }
  if (line.every(v => v === marker.opponent)) {
    return "opponent";
  }
  return false;
}

function state(gameToken, role) {
  return gameSchema.find(gameToken)
    .then(function (response) {
      if (response.status == 'ok') {
        if (response.data === null) {
          logger.log("info", "[Game][state] not found: gameToken=%s", gameToken);
          return { status: "error", code: 18, message: "Not found users" };
        } else {
          logger.log("info", "[Game][state] data=%s role=%s", response.data, role);
          let state = {
            gameDuration: (new Date()).getTime() - (new Date(response.data.started)).getTime(),
            field: response.data.field
          };
          // if game already done
          if (response.data.result != "") {
            state.winner = response.data.result;
            // for player
          } else if (role != "view") {
            state.youTurn = response.data.current === role;
          }
          // for viewer
          if (role == "view") {
            state.owner = response.data.owner;
            state.opponent = response.data.opponent;
            state.current = response.data.current;
            state.state = response.data.state;
          }
          return state;
        }
      } else {
        return response;
      }
    });
}

//getting outdated game tokens
function getOutdated() {
  return gameSchema.list({ expired: { $lt: new Date() } })
    .then(function (response) {
      if (response.status == "ok") {
        let gameTokenArray = [];
        for (let i = 0; i < response.foundGamesArray.length; i++) {
          gameTokenArray.push(response.foundGamesArray[i].gameToken);
        }
        return { status: "ok", gameTokenArray: gameTokenArray };
      } else {
        return response;
      }
    });
}

//removing outdated games by game tokens
function removeOutdated(gameTokenAray) {
  return gameSchema.remove(gameTokenAray);
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