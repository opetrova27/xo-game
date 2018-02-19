'use strict';

const
  user = require("./user"),
  logic = require("./game_logic"),
  config = require("../../configs"),
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

function create(req, res) {
  //create game
  logic.create(req.body.name, req.body.size)
    .then(function (gameCreated) {
      //create user
      if (gameCreated.status == "ok") {
        user.create(req.body.name, gameCreated.gameToken, "owner")
          .then(function (userCreated) {
            if (userCreated.status == "ok") {
              let response = { status: "ok", code: 0, message: "ok" };
              Object.assign(response, gameCreated);
              response.accessToken = userCreated.data.accessToken;
              response.refreshToken = userCreated.data.refreshToken;
              res.json(response);
            } else {
              res.json(userCreated);
            }
          });
      } else {
        res.json(gameCreated);
      }
    });
};

function list(req, res) {
  logic.list()
    .then(function (content) {
      let response = { status: "ok", code: 0, message: "ok" };
      Object.assign(response, content);
      res.json(response);
      removeOutdated();
    });
};

function join(req, res) {
  // find game and check if opponent's place empty
  logic.join(req.body.gameToken, req.body.name)
    .then(function (joined) {
      if (joined.status == "ok") {
        // if joined - create user tokens for this game
        user.create(req.body.name, req.body.gameToken, "opponent")
          .then(function (userCreated) {
            let response = { status: "ok", code: 0, message: "ok" };
            if (userCreated.status == "ok") {
              response.accessToken = userCreated.data.accessToken;
              response.refreshToken = userCreated.data.refreshToken;
              res.json(response);
            } else {
              res.json(userCreated);
            }
          });
      } else {
        res.json(joined);
      }
    }
    );
};

function step(req, res) {
  let row = parseInt(req.body.row);
  let col = parseInt(req.body.col);
  if (Number.isInteger(row) && Number.isInteger(col)) {
    user.checkUser(req.get("accessToken"), req.body.name)
      .then(function (userChecked) {
        if (userChecked.status == "ok") {
          logic.step(userChecked.gameToken, userChecked.role, row, col)
            .then(function (stepResponse) {
              let response = { status: "ok", code: 0, message: "ok" };
              Object.assign(response, stepResponse);
              res.json(response);
            });
        } else {
          res.json(userChecked);
        }
      });
  } else {
    res.json({ status: "error", code: 50, message: "Wrong row or col" });
  }
};

function state(req, res) {
  user.checkUser(req.get("accessToken"), req.get("name"))
    .then(function (userChecked) {
      if (userChecked.status == "ok") {
        logic.state(userChecked.gameToken, userChecked.role)
          .then(function (state) {
            let response = { status: "ok", code: 0, message: "ok" };
            Object.assign(response, state);
            res.json(response);
            removeOutdated();
          });
      } else {
        logic.state(req.get("gameToken"), "view")
          .then(function (state) {
            let response = { status: "ok", code: 0, message: "ok" };
            Object.assign(response, state);
            res.json(response);
            removeOutdated();
          });
      }
    });
};

function removeOutdated() {
  //outdated games removing runs after getting games list or any game status
  logic.getOutdated()
    .then(function (gettingOutdated) {
      if (gettingOutdated.status == "ok" && gettingOutdated.gameTokenArray.length > 0) {
        user.remove(gettingOutdated.gameTokenArray)
          .then(function (removedOutdated) {
            if (removedOutdated.status == "ok") {
              logic.removeOutdated(gettingOutdated.gameTokenArray);
              //result of removing is not showing to users
            }
          })
      }
    });
};

module.exports = {
  create: create,
  list: list,
  join: join,
  step: step,
  state: state
};