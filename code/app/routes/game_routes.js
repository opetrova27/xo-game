'use strict';

const user = require('../models/user');
const game = require('../models/game');

module.exports = function (app, database) {

  var ObjectID = require('mongodb').ObjectID;

  app.put('/notes/:id', (req, res) => {
    const id = req.params.id;
    const details = { '_id': new ObjectID(id) };
    const note = { text: req.body.body, title: req.body.title };
    const xodb = database.db('ozxogame');
    xodb.collection('notes').update(details, note, (err, result) => {
      if (err) {
        res.send({ 'error': 'An error has occurred' });
      } else {
        res.send(note);
      }
    });
  });

  app.delete('/notes/:id', (req, res) => {
    const id = req.params.id;
    const details = { '_id': new ObjectID(id) };
    const xodb = database.db('ozxogame');
    xodb.collection('notes').remove(details, (err, item) => {
      if (err) {
        res.send({ 'error': 'An error has occurred' });
      } else {
        res.send('Note ' + id + ' deleted!');
      }
    });
  });

  app.get('/notes/:id', (req, res) => {
    const id = req.params.id;
    const details = { '_id': new ObjectID(id) };
    const xodb = database.db('ozxogame');
    xodb.collection('notes').findOne(details, (err, item) => {
      if (err) {
        res.send({ 'error': 'An error has occurred' });
      } else {
        res.send(item);
      }
    });
  });

  app.post('/notes', (req, res) => {
    const note = { text: req.body.body, title: req.body.title };
    const xodb = database.db('ozxogame');
    xodb.collection('notes').insert(note, (err, result) => {
      if (err) { 
        res.send({ 'error': 'An error has occurred' }); 
      } else {
        res.send(result.ops[0]);
      }
    });
  });

  app.post('/games/new', (req, res) => {

    console.log("new game");

   // const xodb = database.db('ozxogame');
    //var tokens = user.generateTokens(xodb, req.body.name);
   // var gameToken = game.generateGameToken(xodb, req.body.size, req.body.name);

    res.send( { status: "OK", code : 0/*, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, gameToken: gameToken*/ } );

  });
};