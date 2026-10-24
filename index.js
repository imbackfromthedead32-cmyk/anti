
const {
  Client,
  GatewayIntentBits,
  Partials,
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
const OWNER_ID = '1234183450618232902';

const REVIVE_GIF =
  'https://cdn.discordapp.com/attachments/1235588110885195838/1563683011877281902/27b0b9680165b2df371f972ea194eef7.gif?ex=6ade84c9&is=6add3349&hm=2d939aeebe98442a95e4461933c854c88a82afc5919d0eb4fce399dbfba13850&';

const CHANNEL_GIF =
  'https://cdn.discordapp.com/attachments/1235588110885195838/1563684049338236990/2c594ac0f2ce24de961c23570f2c3fd0.gif?ex=6ade85c1&is=6add3441&hm=e8bdf868044c047390813896ac204ee09241536bda90694e10b54c27ae46c563&';

if (!TOKEN) {
  console.error('Missing bot token. Set DISCORD_TOKEN or TOKEN in your host environment.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

let revived = false;
const whitelist = new Set([OWNER_ID]);

function hasBotMention(message) {
  return message.mentions.users.has(client.user.id);
}

function getSpellText(message) {
  return message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

client.once('ready', () => {
  console.log(`Spell bot online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot || !hasBotMention(message)) {
    return;
  }

  const spell = getSpellText(message);
  const isOwner = message.author.id === OWNER_ID;

  if (spell === 'phasmatos ravaros on animum') {
    if (!isOwner) {
      await message.reply('You do not have power to use this spell.');
      return;
    }

    revived = true;
    whitelist.add(OWNER_ID);

    await message.channel.send({
      content: 'Phasmatos Ravaros On Animum',
      files: [REVIVE_GIF],
    });

    await message.channel.send(
      'The bot has been resurrected from the dead, it is now usable.'
    );
    return;
  }

  if (spell === 'phasmatos magicae') {
    if (!isOwner) {
      await message.reply('You do not have power to use this spell.');
      return;
    }

    const targets = [...message.mentions.users.values()].filter(
      (user) => user.id !== client.user.id && !user.bot
    );

    if (targets.length === 0) {
      await message.reply(
        'Mention one or more people as well as the bot to channel them.'
      );
      return;
    }

    for (const target of targets) {
      whitelist.add(target.id);
    }

    for (const target of targets) {
      await message.channel.send({
        content: `${message.author} has channeled ${target}, you now have access to powerful spells.. Use it wisely.`,
        files: [CHANNEL_GIF],
      });
    }

    return;
  }

  if (spell === 'spiritus immortalitis') {
    if (!isOwner) {
      await message.reply('You do not have power to use this spell.');
      return;
    }

    whitelist.add(OWNER_ID);

    await message.channel.send({
      content: `${message.author} has channeled the spirits! They now have access to powerful commands and spells.`,
      files: [CHANNEL_GIF],
    });

    return;
  }
});

client.login(TOKEN);
