'use strict';

let localConfig = {
    hostname: 'localhost',
    port: 8000,
    mongodburl : "mongodb://admin:admin123@ds225308.mlab.com:25308/ozxogame",
    logfile : "combined.log",
    loglevel : "info",
    expiredGameMinutes : 5,
    expiredUserMinutes : 10
};

module.exports = localConfig;
