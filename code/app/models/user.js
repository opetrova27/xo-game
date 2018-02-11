'use strict';

module.exports = function () {
  generateTokens = function (name, xodb){
      
    var randtoken = require('rand-token');
    var accessToken = randtoken.generate(8);
    var refreshToken = randtoken.generate(8);

    var tokens = { accessToken: accessToken, refreshToken: refreshToken };
    const game = { name: name, accessToken: accessToken, refreshToken: refreshToken };

    var result = null;
    var error = null;

    xodb.collection('users').insert(game, (err, result) => {
      if (err) { 
        error = result;
        res.send({ 'error': 'An error has occurred' }); 
      } else {
        result= result;
        res.send(result.ops[0]);
      }
    });
    if (result != null){
      return tokens;
    }
  }
};