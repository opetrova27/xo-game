'use strict';

const
    express = require('express'),
    xogameController = require('../controllers/xogame');

let router = express.Router();

router.use('/', xogameController);
// you can add here another games - just rename route in previous row to "/xo"

module.exports = router;
