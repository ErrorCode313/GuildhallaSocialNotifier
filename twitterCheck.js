const RSSParser = require("rss-parser");
const parser = new RSSParser();

const cheerio = require('cheerio');

async function getLatestTweet(userId = "guildhallabh") {
    const res = await fetch(`https://nitter.net/${userId}`, {
        "headers": {
            "sec-ch-ua": "\"Google Chrome\";v=\"137\", \"Chromium\";v=\"137\", \"Not/A)Brand\";v=\"24\"",
        },
        "referrerPolicy": "no-referrer",
        "body": null,
        "method": "GET"
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    const tweets = $(".timeline-item").slice(0, 2); // fetch up to 2 tweets
    if (tweets.length === 0) throw new Error("No tweets found");

    const extractTweetInfo = (tweetElem) => {
        const link = $(tweetElem).find(".tweet-link").attr("href");
        const dateStrRaw = $(tweetElem).find(".tweet-date a").attr("title");

        if (!link || !dateStrRaw) throw new Error("Tweet format unexpected");

        const dateStr = dateStrRaw.replace(/\s*·\s*/g, ' ');
        const date = new Date(dateStr);

        if (isNaN(date)) throw new Error(`Could not parse date: ${dateStr}`);

        return {
            link: `https://nitter.net${link}`,
            date
        };
    };

    const tweet1 = extractTweetInfo(tweets[0]);

    if (tweets.length === 1) {
        console.log("Only one tweet found:", tweet1.link);
        return tweet1;
    }

    const tweet2 = extractTweetInfo(tweets[1]);
    const mostRecent = tweet1.date > tweet2.date ? tweet1 : tweet2;

    return mostRecent;
}

getLatestTweet().catch(console.error);


function getTweetEmbedUrl(url) {
    return "https://fixupx.com" + url.slice(url.indexOf('/', 8)); // to skip http protocol, and trailing #m
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