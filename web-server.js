
var sqlite3 = require('sqlite3-promise').verbose();
const express = require('express');
var Promise = require('promise');
var moment = require('moment');

var db = new sqlite3.Database('database3.db');

db.run("CREATE TABLE IF NOT EXISTS ShowRssItem (EpisodeID INT, ShowID INT, ShowName VARCHAR(100), EpisodeName VARCHAR(100), Link TEXT, Date VARCHAR(30), RawTitle VARCHAR(255), Downloaded INT, PRIMARY KEY(EpisodeID, ShowID))");

const app = express();
const port = 3000;

app.set('view engine', 'pug');
app.use("/scripts", express.static('scripts'));

app.locals.moment = moment;

app.get('/', async (request, response) => {

    var shows = await db.allAsync("SELECT DISTINCT ShowID, ShowName FROM ShowRssItem ORDER BY ShowName");

    response.render("index", { shows: shows });
});

app.get('/episodes', async (request, response) => {

    var selectedShowId = request.query["showId"] || null;

    var episodes = await db.allAsync(
        "SELECT EpisodeID, EpisodeName, Date, Downloaded FROM ShowRssItem WHERE $showID IS NULL OR ShowID = $showID ORDER BY EpisodeID DESC",
        { $showID: selectedShowId });

    response.render("episodes", { episodes: episodes });
});

app.get('/download', async (request, response) => {

    await db.runAsync(
        "UPDATE ShowRssItem  SET Downloaded = $downloaded WHERE EpisodeID = $episodeID",
        {
            $episodeID: request.query.episodeId,
            $downloaded: request.query.downloaded,
        });

    response.send("Done");
});

app.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }

    console.log(`server is listening on ${port}`)
});