'use strict';

const
  gameRoutes = require('./game_routes');

function init(server) {
  server.use('/games', gameRoutes);
  // you can add here another section - books, for example
}

module.exports = {
  init: init
};