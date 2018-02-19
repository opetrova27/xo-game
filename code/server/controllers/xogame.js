'use strict';

const
    express = require('express'),
    game = require('../models/game'),
    user = require('../models/user');

let router = express.Router();

router.post('/update', user.update);
router.post('/new', game.create);
router.get('/list', game.list);
router.post('/join', game.join);
router.post('/do_step', game.step);
router.get('/state', game.state);

module.exports = router;