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
  user.create(req.body.name, logger).then(function (user_data) {
    var response = { status: "OK", code: 0, message: "OK" };
    if (user_data.status == "success") {
      response.accessToken = user_data.accessToken;
      response.refreshToken = user_data.refreshToken;      
      logic.create(user_data.name, req.body.size, logger).then(function (new_game) {
        Object.assign(response, new_game);
        res.json(response);
      });
    } else {
      res.json(user_data);
    }
  });
};

function list(req, res) {

};

function join(req, res) {

};

function step(req, res) {

};

function state(req, res) {

};

module.exports = {
  create: create,
  list: list,
  join: join,
  step: step,
  state: state,
};