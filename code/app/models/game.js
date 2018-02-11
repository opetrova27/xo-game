'use strict';

module.exports = function () {
  generateGameToken = function (xodb, size, owner) {

    var state = [];
    for (var i = 0; i < size; i++) {
      state[i] = [];
      for (var j = 0; j < size; j++) {
        state[i][j] = -1;
      }
    }
    console.log("state: " + state);

    var now = new Date();
    var expired = new Date();
    expired.setMinutes(now.getMinutes() + 20);

    var randtoken = require('rand-token');
    var token = randtoken.generate(8);

    const game = {
      token: token,
      text: size,
      state: state,
      owner: owner,
      opponent: "",
      current: "",
      winner: "",
      gameResult: "",
      gameStarted: now,
      gameExpired: expired
    };
    console.log("game: " + game);

    var result = null;
    var error = null;
    xodb.collection('games').insert(game, (err, result) => {
      if (err) {
        error = result;
      } else {
        result = result;
        //res.send(result.ops[0]);
      }
    });

    return token;
  }
};