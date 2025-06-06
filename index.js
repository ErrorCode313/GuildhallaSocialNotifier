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

function cleanRoleName(name) { // Cleans up role names by removing region
    name = name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // normalize accents
    name = name.replace(/[^\x20-\x7E]/g, ""); // keeps ASCII characters only
    const index = name.indexOf('[');
    if (index !== -1) {
        return name.slice(0, index).trim();
    }
    return name.trim();
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

const stringSimilarity = require('string-similarity');

function generateNGrams(words, maxLength = 4) {
    const ngrams = [];
    for (let i = 0; i < words.length; i++) {
        for (let j = i + 1; j <= Math.min(i + maxLength, words.length); j++) {
            const phrase = words.slice(i, j).join(' ').toLowerCase();
            ngrams.push(phrase);
        }
    }
    return ngrams;
}

const SIMILARITY_THRESHOLD = 0.9; 

function findRolesInTitleByNGram(title, roles) {
    title = title.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // normalize accents
    title = title.replace(/[\u00A0-\u00FF]/g, ""); // remove special characters
    title = title.replace(/[^\x20-\x7E]/g, ""); // keeps ASCII characters only
    const words = title.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9]/gi, '')); // strip punctuation
    const ngrams = generateNGrams(words);

    const matches = [];
    for (let role of roles) {
        for (const phrase of ngrams) {
            const compactPhrase = phrase.replace(/\s+/g, '');
            const score = stringSimilarity.compareTwoStrings(compactPhrase, role.name.toLowerCase());
            if (score >= SIMILARITY_THRESHOLD) { // tweak threshold
                matches.push({ id: role.id, name: role.name, score });
                break; // no need to keep testing this role
            }
        }
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, 3); // return top 3 matches
}

async function socialLoop(client) {
    const guilds = client.guilds.cache;
    const video = (await getLatestVideo());
    const tweetEmbed = (await getLatestTweetEmbed()).embedUrl;

    for (const [guildId, guild] of guilds) {
        try {
            const configRaw = await getValue(guildId);
            if (!configRaw) {
                console.warn(`[socialLoop] No social feed configured for guild ${guildId}`);
                continue;
            }

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

            if (video && !postHistory[guildId].includes(video.link)) {
                const roles = guild.roles.cache.map((role) => { return { id: role.id, name: cleanRoleName(role.name) } }); // Get all roles in the guild
                const videoTitle = video.title;
                let rolesInVideoTitle = findRolesInTitleByNGram(videoTitle, roles);
                toSend.push({
                    url: video.link,
                    roles: rolesInVideoTitle.map(role => role.id),
                });
                postHistory[guildId].push(video.link);
            }

            if (tweetEmbed && !postHistory[guildId].includes(tweetEmbed)) {
                toSend.push(tweetEmbed);
                postHistory[guildId].push(tweetEmbed);
            }

            if (toSend.length > 0) {
                for (const item of toSend) {
                    let messageContent = '';
                    if (typeof item === 'object' && item.url) {
                        messageContent = item.url;
                    } else if (typeof item === 'string') {
                        messageContent = item;
                    }
                    if (item.roles && item.roles.length > 0) {
                        messageContent = `<@&${item.roles.join('> <@&')}>\n${messageContent}`;
                    }
                    await channel.send(`${roleId ? `<@&${roleId}>\n` : ''}${messageContent}`);
                    //await channel.send(`${roleId ? `<@&${roleId}>\n` : ''}${item}`);
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
    cron.schedule('* * * * *', () => socialLoop(client)); //every minute
    console.log('✅ Social feed loop scheduled (every minute)');
}

module.exports = { startSocialLoop, socialLoop };
