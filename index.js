const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const trackedChannels = new Map();

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const trackCommand = new SlashCommandBuilder()
        .setName('track')
        .setDescription('Sets the channel to monitor for automated malicious bot text.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to watch')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild);

    const requestDeletionCommand = new SlashCommandBuilder()
        .setName('requestdeletion')
        .setDescription('Send a bot-removal recommendation to the designated tracking channel.')
        .addStringOption(option =>
            option.setName('note')
                .setDescription('The personalized note from the bot owner.')
                .setRequired(true)
        );

    // Both commands are registered globally.
    // /requestdeletion can therefore be used from DMs as well as servers.
    await client.application.commands.set([trackCommand, requestDeletionCommand]);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'track') {
        const targetChannel = interaction.options.getChannel('channel');
        trackedChannels.set(interaction.guildId, targetChannel.id);

        await interaction.reply({
            content: `🛡️ Now tracking **${targetChannel.name}**. Any message sent here will trigger an immediate quarantine response.`,
            ephemeral: true
        });
        return;
    }

    if (interaction.commandName === 'requestdeletion') {
        const OWNER_ID = '1487565352815694015';
        const GUILD_ID = '1367616713335767152';
        const CHANNEL_ID = '1367616713335767155';

        // Only the bot owner can use this command.
        if (interaction.user.id !== OWNER_ID) {
            await interaction.reply({
                content: '❌ You are not authorized to use this command.',
                ephemeral: true
            });
            return;
        }

        const note = interaction.options.getString('note', true);

        // Fetch the designated channel.
        const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);

        if (!channel || channel.guildId !== GUILD_ID || !channel.isTextBased()) {
            await interaction.reply({
                content: '❌ The designated tracking channel could not be found or is not a text channel.',
                ephemeral: true
            });
            return;
        }

        const message =
            'The bot owner has recommended that this bot is removed from the server, aswell as the designated channel used for tracking. ' +
            'BOT OWNER NOTE: ' + note;

        try {
            await channel.send(message);

            await interaction.reply({
                content: '✅ The deletion request was sent to the designated tracking channel.',
                ephemeral: true
            });
        } catch (err) {
            console.error(`Failed to send deletion request: ${err.message}`);

            await interaction.reply({
                content: '❌ I could not send the deletion request to the designated channel.',
                ephemeral: true
            });
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const trackedChannelId = trackedChannels.get(message.guild.id);

    if (message.channel.id !== trackedChannelId) return;

    const member = message.member;
    const author = message.author;
    const guild = message.guild;

    try {
        await message.delete();
    } catch (err) {
        console.error(`Failed to delete trigger message: ${err.message}`);
    }

    if (!member) return;

    try {
        const invite = await message.channel.createInvite({
            maxAge: 86400,
            maxUses: 1
        });

        const dmEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Account Breach Detected')
            .setDescription(
                `Your account has been compromised or breached by a malicious bot posting links or pictures you shouldn't be having.\n\n` +
                `To secure your account, ensure you enable 2FA, change your passsord or change accounts and return to the community, please resolve the issue and join back using the link below:\n` +
                `👉 ${invite.url} If this does not work as intended, please contact the server owner or retrieve the invite through public sources.`
            );

        await author.send({ embeds: [dmEmbed] });
    } catch (err) {
        console.log(`Could not send DM to ${author.tag}`);
    }

    guild.channels.cache.forEach(async (channel) => {
        if (channel.type === ChannelType.GuildText) {
            try {
                const messages = await channel.messages.fetch({ limit: 50 });
                const userMessages = messages.filter(m => m.author.id === author.id);

                if (userMessages.size > 0) {
                    await channel.bulkDelete(userMessages, true);
                }
            } catch (err) {

            }
        }
    });

    try {
        if (member.kickable) {
            await member.kick(
                'Automated Bot Mitigation Sync: Triggered honeypot tracking channel.'
            );

            console.log(
                `Successfully kicked suspected bot account: ${author.tag}`
            );
        } else {
            console.log(
                `Cannot kick ${author.tag}: Missing Role Hierarchy permissions.`
            );
        }
    } catch (err) {
        console.error(`Failed to kick member: ${err.message}`);
    }
});

client.login(process.env.TOKEN);
