'use strict';

const
  gameRoutes = require('./game_routes');

function init(server) {
  /*server.get('*', function (req, res, next) {
      console.log('Request was made to: ' + req.originalUrl);
      return next();
  });*/

  /*server.get('/', function (req, res) {
      res.redirect('/home');
  });*/

  server.use('/games', gameRoutes);
}

module.exports = {
  init: init
};