'use strict';

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    autoIncrement = require('mongoose-auto-increment');
const bodyParser = require('body-parser')
const dns = require('dns')

var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/ 
// mongoose.connect(process.env.MONGOLAB_URI);
let connection = mongoose.createConnection(process.env.MONGO_URI)
autoIncrement.initialize(connection)
app.use(cors());

let URL_Schema = new Schema({
  original_url: String
})
URL_Schema.plugin(autoIncrement.plugin, {model: 'URL', field: 'URL_ID'});

let URL_model = connection.model('URL', URL_Schema)

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
app.use('/', bodyParser.urlencoded({extended:true}))
app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});

function url_test(strippedURL){
  return new Promise((resolve) => {
    dns.lookup(strippedURL, (err) => resolve({strippedURL, exists:!err}))
  })
}

app.post("/api/shorturl/new", function (req, res){
  let url = req.body.url
  let strippedURL = url.replace(/(^\w+:|^)\/\//, '');
  url_test(strippedURL).then(function(obj){
    if(obj.exists){
      let record = new URL_model({original_url: url})
      let host = req.get('host');
      try{
          let existing_entry = URL_model.findOne({original_url: url})
          if(existing_entry){
            res.json({original_url: url,
                    short_url: host+"/api/shorturl/" + existing_entry.URL_ID})
          }
          else{
            let result = record.save();
            res.json({original_url: url,
                      short_url: host+"/api/shorturl/" + result.URL_ID})
          }
        }
      catch(err){
        if (err.name === 'MongoError' && err.code === 11000) {
          res.status(409).send(new Error('Duplicate key', [err.message]));
        }
        res.status(500).send(err);
      }
    }
    else{
      res.json({"error":"invalid URL"})
  }
  })
});
         
app.get("/api/shorturl/:shortened", async (req, res) => {
  let shortenedURL = req.params.shortened
  let result = await URL_model.findOne({URL_ID: shortenedURL})
  res.redirect(result.original_url)
})

app.listen(port, function () {
  console.log('Node.js listening ...');
});