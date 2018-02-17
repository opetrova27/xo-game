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
      if (gameCreated.status == "success") {
        user.create(req.body.name, gameCreated.gameToken, "owner")
          .then(function (userCreated) {
            if (userCreated.status == "success") {
              var response = { status: "OK", code: 0, message: "OK" };
              Object.assign(response, gameCreated);
              response.accessToken = userCreated.accessToken;
              response.refreshToken = userCreated.refreshToken;
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
      var response = { status: "OK", code: 0, message: "OK" };
      Object.assign(response, content);
      res.json(response);
      removeOutdated();
    });
};

function join(req, res) {
  // find game and check if opponent's place empty
  logic.join(req.body.gameToken, req.body.name)
    .then(function (joined) {
      if (joined.status == "success") {
        // if joined - create user tokens for this game
        user.create(req.body.name, req.body.gameToken, "opponent")
          .then(function (userCreated) {
            var response = { status: "OK", code: 0, message: "OK" };
            if (userCreated.status == "success") {
              response.accessToken = userCreated.accessToken;
              response.refreshToken = userCreated.refreshToken;
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
  var row = parseInt(req.body.row);
  var col = parseInt(req.body.col);
  if (Number.isInteger(row) && Number.isInteger(col)) {
    user.checkUser(req.get("accessToken"), req.body.name)
      .then(function (userChecked) {
        if (userChecked.status == "success") {
          logic.step(userChecked.gameToken, userChecked.role, row, col)
            .then(function (stepResponse) {
              res.json(stepResponse);
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
      if (userChecked.status == "success") {
        logic.state(userChecked.gameToken, userChecked.role)
          .then(function (state) {
            var response = { status: "OK", code: 0, message: "OK" };
            Object.assign(response, state);
            res.json(response);
            removeOutdated();
          });
      } else {
        res.json(userChecked);
      }
    });
};

function removeOutdated() {
  //outdated games removing runs after getting games list or any game status
  logic.getOutdated()
    .then(function (gettingOutdated) {
      if (gettingOutdated.status == "success" && gettingOutdated.gameTokenArray.length > 0) {
        user.remove(gettingOutdated.gameTokenArray)
          .then(function (removedOutdated) {
            if (removedOutdated.status == "success") {
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