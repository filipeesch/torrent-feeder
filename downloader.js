
var request = require("request");
var xml2js = require('xml2js');
var sqlite3 = require('sqlite3').verbose();
var Promise = require('promise');
var config = require("./config")

var db = new sqlite3.Database('database3.db');

db.run("CREATE TABLE IF NOT EXISTS ShowRssItem (EpisodeID INT, ShowID INT, ShowName VARCHAR(100), EpisodeName VARCHAR(100), Link TEXT, Date VARCHAR(30), RawTitle VARCHAR(255), Downloaded INT, PRIMARY KEY(EpisodeID, ShowID))");

var insertItem = function (item) {

    var episodeID = item["tv:episode_id"][0];
    var showID = item["tv:show_id"][0];
    var episodeName = item["title"][0];

    console.log("Found: " + episodeName);

    db.each(
        "SELECT COUNT(*) AS count FROM ShowRssItem WHERE EpisodeID = ? AND ShowID = ?",
        [episodeID, showID],
        function (err, row) {

            if (+row.count > 0) {
                console.log("Marked as downloaded: " + episodeName);
                return;
            }


            console.log("Queueing: " + episodeName);

            db.run("INSERT INTO ShowRssItem (EpisodeID, ShowID, ShowName, EpisodeName, Link, Date, RawTitle, Downloaded) VALUES ($EpisodeID, $ShowID, $ShowName, $EpisodeName, $Link, $Date, $RawTitle, $Downloaded)", {
                $EpisodeID: episodeID,
                $ShowID: showID,
                $ShowName: item["tv:show_name"][0],
                $EpisodeName: episodeName,
                $Link: item["link"][0],
                $Date: item["pubDate"][0],
                $RawTitle: item["tv:raw_title"][0],
                $Downloaded: 0
            });
        });
};

var transmissionSessionId = "";


var requestTransmission = function (data) {

    return new Promise(function (resolve, reject) {

        request.post({
            url: config.transmissionUrl,
            "content-type": "application/json",
            body: JSON.stringify(data),
            headers: { "x-transmission-session-id": transmissionSessionId }
        },
            function (error, response, body) {
                try {
                    if (response.statusCode === 200)
                        resolve(JSON.parse(body));

                    else if (response.statusCode === 409) {
                        transmissionSessionId = response.headers["x-transmission-session-id"];

                        requestTransmission(data).then(resolve, reject);
                    }
                }
                catch (ex) {
                    reject(ex);
                }
            });
    });
};



var downloadItem = function (item) {

    return new Promise(function (resolve, reject) {

        console.log("Sending to Download: " + item.EpisodeName);

        requestTransmission({
            method: "torrent-add",
            arguments: {
                "download-dir": config.downloadTvShowsDir + item.ShowName,
                filename: item.Link
            }
        })
            .then(function (response) {
                if (response.result = "success")
                    resolve();
                else
                    reject(response);
            });
    });
};


var downloadPendingItems = function () {

    db.each("SELECT EpisodeID, ShowID, ShowName, EpisodeName, Link FROM ShowRssItem WHERE Downloaded = 0", function (err, row) {

        downloadItem(row).then(function () {
            db.run("UPDATE ShowRssItem  SET Downloaded = 1 WHERE EpisodeID = $EpisodeID AND ShowID = $ShowID", {
                $EpisodeID: row.EpisodeID,
                $ShowID: row.ShowID,
            });
        });
    });
};


var getTransmissionItems = function () {

    return new Promise(function (resolve, reject) {
        requestTransmission({
            method: "torrent-get",
            arguments: {
                fields: ["id", "name", "status", "magnetLink"]
            }
        })
            .then(function (response) {

                if (response.result == "success")
                    resolve(response.arguments.torrents)
                else
                    reject(response);

            }, reject);
    });
};


var removeCompleted = function (torrents) {

    if (torrents.length === 0)
        return;

    requestTransmission({
        method: "torrent-remove",
        arguments: { ids: torrents.map(t => t.id) }
    });
};


var updateSeeding = function (torrents) {

    if (torrents.length === 0)
        return;

    var updateLibrary = false;

    db.each("SELECT EpisodeID, ShowID, ShowName, EpisodeName, Link FROM ShowRssItem WHERE Downloaded = 1", function (err, row) {

        if (torrents.filter(t => t.magnetLink === row.Link).length > 0) {

            updateLibrary = true;

            console.log("Download completed: " + row.EpisodeName);

            db.run("UPDATE ShowRssItem  SET Downloaded = 2 WHERE EpisodeID = $EpisodeID AND ShowID = $ShowID", {
                $EpisodeID: row.EpisodeID,
                $ShowID: row.ShowID,
            });
        }
    });


    setTimeout(function () {
        if (updateLibrary) {
            console.log("Updating library...");
            request(config.updateOsmcLibraryUrl);
        }
    }, 2000);
};


var updateCompleted = function () {

    return new Promise(function (resolve, reject) {

        getTransmissionItems().then(function (torrents) {

            if (!torrents || torrents.length === 0)
                return;

            updateSeeding(torrents.filter(t => t.status == 6));

            removeCompleted(torrents.filter(t => t.status == 0));
        });
    });
};


var requestItems = function () {

    console.log("Requesting items...")

    request(config.showRssFeedUrl, function (error, response, body) {

        var xmlParser = new xml2js.Parser();

        xmlParser.parseString(body, function (err, result) {
            var items = result.rss.channel[0].item;

            for (var i = 0; i < items.length; i++)
                insertItem(items[i]);

            downloadPendingItems();
        });
    });

    updateCompleted();
};

requestItems();
