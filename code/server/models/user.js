'use strict';

const
  userSchema = require("./user_schema"),
  config = require("../../configs"),
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

function generateTokens(name, gameToken) {
  return { accessToken: randtoken.generate(8), refreshToken: randtoken.generate(8) };
}

function updateTokens(name, refreshToken) {
  // regenerating tokens and update them in db
  const criteria = { $and: [{ name: name }, { refreshToken: refreshToken }] };
  let expired = new Date();
  expired.setMinutes(expired.getMinutes() + config.expiredUserMinutes);
  const tokens = generateTokens();
  const options = { $set: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expired: expired } };
  return userSchema.update(criteria, options)
    .then(function (response) {
      if (response.status == "ok") {
        return { status: "ok", accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
      } else {
        return response;
      }
    });
}

function checkRefreshToken(req, res) {
  // checking user refreshToken for repairing both tokens
  return userSchema.find({ $and: [{ refreshToken: req.get("refreshToken") }, { name: req.body.name }] })
    .then(function (response) {
      if (response.status == "ok") {
        if (response.data === null) {
          logger.log("info", "[User][checkRefreshToken] not found: refreshToken=%s name=%s", req.get("refreshToken"), req.body.name);
          res.json({ status: "error", code: 60, message: "Not found users" });
        } else {
          return updateTokens(response.data.name, response.data.refreshToken)
            .then(function (updated) {
              let response = { status: "ok", code: 0, message: "ok" };
              Object.assign(response, updated);
              res.json(response);
            });
        }
      } else {
        res.json(response);
      }
    });
}

function checkUser(accessToken, name) {
  return userSchema.find({ $and: [{ accessToken: accessToken }, { name: name }, { expired: { $gt: new Date() } }] })
    .then(function (response) {
      if (response.status == "ok") {
        if (response.data === null) {
          logger.log("info", "[User][checkRefreshToken] not found: accessToken=%s name=%s", accessToken, name);
          return { status: "error", code: 61, message: "Not found users" };
        } else {
          return { status: "ok", name: response.data.name, gameToken: response.data.gameToken, role: response.data.role };
        }
      } else {
        return response;
      }
    });
}

function create(name, gameToken, role) {
  // user creates with two tokens:
  // - accessToken has expired date
  // - refreshToken - uses for regenerate both tokens
  // also if accessToken will be compromated - fake user can use it only until expired date
  // and veritable user can repair accessToken with help of refreshToken
  const tokens = generateTokens();
  return userSchema.create(name, tokens.accessToken, tokens.refreshToken, gameToken, role);
}

// removing users for expired games
function remove(gameTokenAray) {
  return userSchema.remove(gameTokenAray);
}

module.exports = {
  create: create,
  updateTokens: checkRefreshToken,
  checkUser: checkUser,
  remove: remove
};