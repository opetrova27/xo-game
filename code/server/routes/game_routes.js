'use strict';

const
    express = require('express'),
    gameController = require('../controllers/game');

let router = express.Router();

router.use('/', gameController);

module.exports = router;
