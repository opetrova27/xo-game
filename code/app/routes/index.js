'use strict';

const gameRoutes = require('./game_routes');

module.exports = function(app, db) {
  gameRoutes(app, db);
  
};