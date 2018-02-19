'use strict';

const
  userlogic = require("./logic/user");

function update(req, res) {
  // checking user refreshToken for repairing both tokens
  return userlogic.updateTokens(req.get("refreshToken"), req.body.name)
    .then(function (updated) {
      let response = { status: "ok", code: 0, message: "ok" };
      Object.assign(response, updated);
      res.json(response);
    });
}

module.exports = {
  update: update
};