const YouTube = require("youtube-sr").default;
const RSSParser = require("rss-parser");
const parser = new RSSParser();
const guildhallaChannelId = "UCQcs2WoYkuj2GxhhLaY7Aig";

async function getChannelId(nameOrLink) {
    return new Promise((resolve, reject) => {
        YouTube.searchOne(nameOrLink, "channel").catch((err) => {
            reject(err);
        }).then((channel) => {
            if (!channel || !channel.id) {
                reject(new Error("Channel not found"));
            } else {
                resolve(channel.id);
            }
        });
    })
}

async function getRSS(channelId) {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    let parsedResult = await parser.parseURL(rssUrl);
    return parsedResult;
}

async function getLatestVideo(channelId = guildhallaChannelId) {
    const rss = await getRSS(channelId);
    if (!rss || !rss.items || rss.items.length === 0) {
        throw new Error("No videos found in the channel");
    }
    return rss.items[0];
}


getLatestVideo().then((video) => {
    console.log(video);
}).catch((err) => {
    console.error("Error fetching latest video:", err.message);
}).finally(() => {
    console.log("YouTube check completed.");
});

module.exports = {
    getLatestVideo
}