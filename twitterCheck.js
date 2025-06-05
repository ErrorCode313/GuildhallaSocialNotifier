const RSSParser = require("rss-parser");
const parser = new RSSParser();

async function getLatestTweet(userId = "guildhallabh") {
    const tweets = await parser.parseURL(`https://rss.xcancel.com/${userId}/rss`)
    if (!tweets || !tweets.items || tweets.items.length === 0) {
        throw new Error("No tweets found for the user");
    }
    const tweet = tweets.items[0]; // 0 is the latest tweet, 1 is the second latest, etc.
    return tweet;
}

function getTweetEmbedUrl(url) {
    let tweetId = url.match(/status\/(\d+)/);
    if (!tweetId || tweetId.length < 2) {
        throw new Error("Invalid tweet URL");
    }
    tweetId = tweetId[1];
    const embedUrl = `https://fixupx.com/guildhallabh/status/${tweetId}`;
    return embedUrl;
}

getLatestTweet()
    .then(tweet => {
        const embedUrl = getTweetEmbedUrl(tweet.link);
    })
    .catch(err => {
        console.error(err);
    })
    .finally(() => {
        console.log("Twitter check completed.");
    });

function getLatestTweetEmbed(userId = "guildhallabh") {
    return getLatestTweet(userId)
        .then(tweet => {
            const embedUrl = getTweetEmbedUrl(tweet.link);
            return {
                url: tweet.link,
                embedUrl: embedUrl,
                date: tweet.pubDate
            };
        });
}

module.exports = {
    getLatestTweet,
    getTweetEmbedUrl,
    getLatestTweetEmbed
};