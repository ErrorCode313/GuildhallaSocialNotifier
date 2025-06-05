const RSSParser = require("rss-parser");
const parser = new RSSParser();

async function getLatestTweet(userId = "guildhallabh") {
    console.log(`Fetching latest tweet for user: ${userId}`);
    const tweets = await parser.parseURL(`https://rss.xcancel.com/${userId}/rss`)
    if (!tweets || !tweets.items || tweets.items.length === 0) {
        throw new Error("No tweets found for the user");
    }
    const tweet = tweets.items[0]; // 0 is the latest tweet, 1 is the second latest, etc.
    return tweet;
}

function getTweetEmbedUrl(url) {
    let tweetId = url.match(/status\/(\d+)/);
    console.log(url);
    if (!tweetId) {
        console.warn("Invalid tweet URL");
        return null;
    }
    tweetId = tweetId[1];
    const embedUrl = `https://fixupx.com/guildhallabh/status/${tweetId}`;
    return embedUrl;
}

async function getLatestTweetEmbed(userId = "guildhallabh") {
    return await getLatestTweet(userId)
        .then(tweet => {
            if (!tweet) {
                throw new Error("Invalid tweet data");
            }
            console.log(tweet);
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