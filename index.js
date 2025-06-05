const cron = require('node-cron');
const { getValue } = require('./simpledb');
const { getLatestVideo } = require('./ytCheck');
const { getLatestTweetEmbed } = require('./twitterCheck');

const postHistory = {}; // In-memory post history (per guild)
const cacheTimestamps = {}; // Cache timestamps for rate limiting

function extractUrlsFromMessage(msg) {
    const urls = [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    if (msg.content) {
        const matches = msg.content.match(urlRegex);
        if (matches) urls.push(...matches);
    }

    if (msg.embeds?.length) {
        for (const embed of msg.embeds) {
            if (embed.url) urls.push(embed.url);
        }
    }

    return urls;
}

async function loadRecentHistory(channel, guildId) {
    try {
        const messages = await channel.messages.fetch({ limit: 50 });
        const urls = [];

        messages.forEach(msg => {
            urls.push(...extractUrlsFromMessage(msg));
        });

        postHistory[guildId] = [...new Set(urls)]; // unique only
    } catch (err) {
        console.error(`[socialLoop] Failed to load history for ${guildId}:`, err.message);
        postHistory[guildId] = [];
    }
}

async function socialLoop(client) {
    const guilds = client.guilds.cache;
    const video = (await getLatestVideo()).link;
    const tweetEmbed = (await getLatestTweetEmbed()).embedUrl;

    for (const [guildId, guild] of guilds) {
        try {
            const configRaw = await getValue(guildId);
            if (!configRaw) {
                console.warn(`[socialLoop] No social feed configured for guild ${guildId}`);
                continue;
            }

            console.log(configRaw);
            const { channelId, roleId } = JSON.parse(Buffer.from(configRaw, 'base64').toString('utf8'));
            const channel = await guild.channels.fetch(channelId);
            if (!channel) {
                console.warn(`[socialLoop] Channel ${channelId} not found for guild ${guildId}`);
                continue;
            }

            // Load history from channel if it's the first time
            if (!postHistory[guildId] || Date.now() - cacheTimestamps[guildId] > 0 * 60 * 1000) { // 5 minutes cache
                await loadRecentHistory(channel, guildId);
                cacheTimestamps[guildId] = Date.now();
            }

            const toSend = [];

            if (video && !postHistory[guildId].includes(video)) {
                toSend.push(video);
                postHistory[guildId].push(video);
            }

            if (tweetEmbed && !postHistory[guildId].includes(tweetEmbed)) {
                toSend.push(tweetEmbed);
                postHistory[guildId].push(tweetEmbed);
            }

            if (toSend.length > 0) {
                for (const item of toSend) {
                    await channel.send(`${roleId ? `<@&${roleId}>\n` : ''}${item}`);
                }
                postHistory[guildId] = postHistory[guildId].slice(-50); // Keep only recent 50
            }
        } catch (err) {
            console.error(`[socialLoop] Error in guild ${guildId}:`, err.message);
        }
    }

    console.log('✅ Social feeds updated.');
}

function startSocialLoop(client) {
    socialLoop(client);
    cron.schedule('* * * * *', () => socialLoop(client));
    console.log('✅ Social feed loop scheduled (every minute)');
}

module.exports = { startSocialLoop, socialLoop };
