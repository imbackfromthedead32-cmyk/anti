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

    await client.application.commands.set([trackCommand]);
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
        const invite = await message.channel.createInvite({ maxAge: 86400, maxUses: 1 });
        
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
            await member.kick('Automated Bot Mitigation Sync: Triggered honeypot tracking channel.');
            console.log(`Successfully kicked suspected bot account: ${author.tag}`);
        } else {
            console.log(`Cannot kick ${author.tag}: Missing Role Hierarchy permissions.`);
        }
    } catch (err) {
        console.error(`Failed to kick member: ${err.message}`);
    }
});

client.login(process.env.TOKEN);
