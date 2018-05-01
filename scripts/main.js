
window.scripts = function () {

    var loadEpisodes = () => {

        let showId = $("#shows").val();

        $("#episodes").load(
            "/episodes?showId=" + (showId || ""),
            () => $("#all-episodes").change(evt => $("input[name=episode]").prop("checked", evt.target.checked)));
    };

    var changeDonwloadState = state => {
        var tasks = $("input[name=episode]:checked").map(
            (index, item) => $.get("/download", { episodeId: $(item).data("id"), downloaded: state }));

        $.when(tasks).done(loadEpisodes);
    };

    $("#shows").change(loadEpisodes);
    $("#markAsDownloaded").click(() => changeDonwloadState(1));
    $("#downloadAgain").click(() => changeDonwloadState(0));

    loadEpisodes();
};

window.scripts();