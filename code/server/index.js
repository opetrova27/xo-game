'use strict';

const
    express = require('express'),
    helmet = require('helmet'),
    bodyParser = require('body-parser');


module.exports = function () {
    let server = express(),
        connection,
        create,
        start;

    create = function (config) {
        let routes = require('./routes');

        server.set('env', config.env);
        server.set('port', config.port);
        server.set('hostname', config.hostname);

        server.use(bodyParser.urlencoded({ extended: true }));
        server.use(bodyParser.json());

        //use helmet for secure app
        server.use(helmet());
        server.use(helmet.noCache())
        server.use(helmet.frameguard())

        routes.init(server);
        return server;
    };

    start = function () {
        let hostname = server.get('hostname'),
            port = server.get('port');

        return server.listen(port, function () {
            console.log('Express server listening on - http://' + hostname + ':' + port);
        });
    };

    return {
        create: create,
        start: start
    };
};