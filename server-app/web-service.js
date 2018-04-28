
var sqlite3 = require('sqlite3').verbose();
const express = require('express');
var Promise = require('promise');

var db = new sqlite3.Database('database3.db');

db.run("CREATE TABLE IF NOT EXISTS ShowRssItem (EpisodeID INT, ShowID INT, ShowName VARCHAR(100), EpisodeName VARCHAR(100), Link TEXT, Date VARCHAR(30), RawTitle VARCHAR(255), Downloaded INT, PRIMARY KEY(EpisodeID, ShowID))");

const app = express();
const port = 3000;

app.set('view engine', 'pug')

app.get('/', async (request, response) => {

    var shows, episodes;

    db.all(
        "SELECT DISTINCT ShowID, ShowName FROM ShowRssItem ORDER BY ShowName",
        function (err, rows) { shows = rows });

    db.all(
        "SELECT EpisodeID, EpisodeName, ShowName, Date, Downloaded FROM ShowRssItem WHERE $showID IS NULL OR ShowID = $showID ORDER BY EpisodeID DESC",
        { $showID: request.query["showId"] },
        function (err, rows) { episodes = rows });

    setTimeout(() => response.render("index", { shows: shows, episodes: episodes }), 1000);
});

app.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }

    console.log(`server is listening on ${port}`)
});