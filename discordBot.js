const { Client, GatewayIntentBits, REST, Routes, ChannelType, MessageFlags } = require('discord.js');
require('dotenv').config();
const { setValue } = require('./simpledb');
const { startSocialLoop, socialLoop } = require('./index');
const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

client.once('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);

    const commands = [
        {
            name: 'setsocialfeed',
            description: 'Set feed channel (and optional ping role)',
            options: [
                {
                    name: 'channel',
                    description: 'Text channel to post in',
                    type: 7, // CHANNEL
                    required: true,
                },
                {
                    name: 'role',
                    description: 'Role to ping when posting',
                    type: 8, // ROLE
                    required: false,
                },
            ],
        },
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const appId = (await client.application.fetch()).id;

    await rest.put(Routes.applicationCommands(appId), { body: commands });
    console.log('✅ Slash command registered');

    startSocialLoop(client);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'setsocialfeed') return;

    const member = interaction.member;
    if (!member.permissions.has('ManageGuild')) {
        return interaction.reply({
            content: '❌ You do not have permission to use this command.',
            ephemeral: true,
        });
    }

    const channel = interaction.options.getChannel('channel');
    const role = interaction.options.getRole('role');
    if (!channel || channel.type !== ChannelType.GuildText) {
        return interaction.reply({ content: '❌ Invalid channel.', ephemeral: true });
    }

    await setValue(interaction.guild.id, {
        channelId: channel.id,
        roleId: role?.id ?? "",
    });

    socialLoop(client);

    return interaction.reply({
        content: `✅ Set social feed to <#${channel.id}>${role ? ` and ping <@&${role.id}>` : ''}`,
        flags: MessageFlags.Ephemeral,
    });
});

client.login(process.env.DISCORD_TOKEN);
