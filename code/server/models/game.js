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
  logic.create(req.body.name, req.body.size, logger).then(function (new_game) {
    var response = { status: "OK", code: 0, message: "OK" };
    if (new_game.status == "success") {
      user.create(req.body.name, new_game.gameToken, "owner").then(function (user_data) {
        var response = { status: "OK", code: 0, message: "OK" };
        if (user_data.status == "success") {
          Object.assign(response, new_game);
          response.accessToken = user_data.accessToken;
          response.refreshToken = user_data.refreshToken;
          res.json(response);
        } else {
          res.json(user_data);
        }
      });
    } else {
      res.json(new_game);
    }
  });


};

function list(req, res) {
  var response = { status: "OK", code: 0, message: "OK" };
  logic.list(logger).then(function (content) {
    Object.assign(response, content);
    res.json(response);
  });
};

function join(req, res) {
  var response = { status: "OK", code: 0, message: "OK" };
  logic.join(logger, req.body.gameToken, req.body.name).then(
    function (joined) {
      if (joined.status == "success") {
        user.create(req.body.name, req.body.gameToken, "opponent").then(function (user_data) {
          var response = { status: "OK", code: 0, message: "OK" };
          if (user_data.status == "success") {
            response.accessToken = user_data.accessToken;
            response.refreshToken = user_data.refreshToken;
            res.json(response);
          } else {
            res.json(user_data);
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
    var response = { status: "OK", code: 0, message: "OK" };
    user.checkUser(req.get("accessToken"), req.body.name)
      .then(function (result) {
        if (result.status == "success") {
          logic.step(res, result.gameToken, result.role, row, col);
        } else {
          res.json(result);
        }
      });
  } else {
    res.json({ status: "error", code: -1, message: "Wrong row or col" });
  }
};

function state(req, res) {
  var response = { status: "OK", code: 0, message: "OK" };
  user.checkUser(req.get("accessToken"), req.get("name"))
    .then(function (result) {
      if (result.status == "success") {
        logic.state(res, result.gameToken, result.role);
      } else {
        res.json(result);
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