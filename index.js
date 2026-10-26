
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
  MessageFlags,
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
const OWNER_ID = "1234183450618232902";

const SPIRIT_GIF =
  "https://cdn.discordapp.com/attachments/1235588110885195838/1563683011877281902/27b0b9680165b2df371f972ea194eef7.gif?ex=6ade84c9&is=6add3349&hm=2d939aeebe98442a95e4461933c854c88a82afc5919d0eb4fce399dbfba13850&";

const RAVAROS_GIF =
  "https://cdn.discordapp.com/attachments/1235588110885195838/1563683974260457502/tvd-bonnie.gif?ex=6ade85af&is=6add342f&hm=7c05ae2036b396f256465a2c1f48b74bb8553e9f3f8021391d75f887ffa7a345&";

const MAGICAE_GIF =
  "https://cdn.discordapp.com/attachments/1235588110885195838/1563684049338236990/2c594ac0f2ce24de961c23570f2c3fd0.gif?ex=6ade85c1&is=6add3441&hm=e8bdf868044c047390813896ac204ee09241536bda90694e10b54c27ae46c563&";

const LEADER_USERNAMES = new Set([
  "miranda00946",
  "maisieisbored",
  "clovilla",
]);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

const channelledWitches = new Map();
const linkedWitches = new Map();

function normalize(text) {
  return text
    .toUpperCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLeader(user) {
  return (
    user.id === OWNER_ID ||
    LEADER_USERNAMES.has(user.username.toLowerCase())
  );
}

function witchRank(user) {
  if (isLeader(user)) return "Witch Leader";
  if (linkedWitches.has(user.id)) return "Linked Witch";
  if (channelledWitches.has(user.id)) return "Channeled Witch";
  return null;
}

function canCast(user) {
  return (
    isLeader(user) ||
    linkedWitches.has(user.id) ||
    channelledWitches.has(user.id)
  );
}

function canManageWitches(user) {
  return isLeader(user) || linkedWitches.has(user.id);
}

function getSpellText(message) {
  return normalize(
    message.content
      .replace(/<@!?\d+>/g, "")
      .replace(/<@&\d+>/g, "")
      .replace(/<#\d+>/g, "")
  );
}

async function getTargetMember(message) {
  if (!message.guild) return null;

  const mentioned = message.mentions.members.first();
  if (mentioned) return mentioned;

  if (message.reference) {
    try {
      const replied = await message.fetchReference();
      return await message.guild.members.fetch(replied.author.id);
    } catch {
      return null;
    }
  }

  return null;
}

async function getRepliedMessage(message) {
  if (!message.reference) return null;

  try {
    return await message.fetchReference();
  } catch {
    return null;
  }
}

async function reply(message, content) {
  return message.reply({
    content,
    allowedMentions: {
      parse: [],
      repliedUser: false,
    },
  });
}

async function sendSpellGif(message, title, gif) {
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(title)
    .setImage(gif);

  await message.channel.send({ embeds: [embed] });
}

async function castTimeout(message, target, duration, reason) {
  if (!target) {
    return reply(
      message,
      "Mention a target or reply to their message."
    );
  }

  if (
    target.id === message.author.id ||
    target.id === client.user.id
  ) {
    return reply(
      message,
      "You cannot cast that spell on yourself or the bot."
    );
  }

  if (!target.moderatable) {
    return reply(
      message,
      "I cannot affect that user. Check my Moderate Members permission and role hierarchy."
    );
  }

  try {
    await target.timeout(duration, reason);

    return reply(
      message,
      `✨ **${target.user.username}** has been affected by the spell.`
    );
  } catch (error) {
    console.error("Timeout spell failed:", error);

    return reply(
      message,
      "The spell failed. Check my permissions."
    );
  }
}

function addChannelled(member) {
  channelledWitches.set(member.id, {
    id: member.id,
    name: member.user.username,
  });

  linkedWitches.delete(member.id);
}

function addLinked(member) {
  linkedWitches.set(member.id, {
    id: member.id,
    name: member.user.username,
  });

  channelledWitches.delete(member.id);
}

function removeWitch(member) {
  channelledWitches.delete(member.id);
  linkedWitches.delete(member.id);
}

function hierarchyList(title, entries) {
  const names = [...entries.values()].map(
    (witch) => `• ${witch.name}`
  );

  return names.length
    ? `**${title}**\n${names.join("\n")}`
    : `**${title}**\n*None currently recorded.*`;
}

async function showGrimoire(message) {
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("📖 The Grimoire")
    .setDescription(
      "Mention the bot and use an exact incantation. You must have witch access to cast spells."
    )
    .addFields(
      {
        name: "Silencio",
        value: "Times out a target for 5 minutes.",
      },
      {
        name: "Pontem Praesido Anchora Immortalibus",
        value: "Removes a target's timeout.",
      },
      {
        name: "Phasmatos Somnus",
        value: "Places a target in a 1-minute magical sleep.",
      },
      {
        name: "The Power of Three Will Set Us Free",
        value: "Bans a target from the server. Linked Witches and Witch Leaders only.",
      },
      {
        name: "Phasmatos Redux Redismo Sus Terra",
        value: "Kicks a target from the server. Linked Witches and Witch Leaders only.",
      },
      {
        name: "Phasmatos Ravaros",
        value: "Deletes the message you are replying to. Linked Witches and Witch Leaders only.",
      },
      {
        name: "Phasmatos Devos Male",
        value: "Unchannels a target and removes their witch access. Linked Witches can unchannel Channeled Witches; Witch Leaders can unchannel both ranks.",
      },
      {
        name: "Harae Tamae Kioku Yomigaerashi Tamae",
        value: "Purges up to 50 recent messages from this channel. Linked Witches and Witch Leaders only.",
      },
      {
        name: "Spiritus Immortalitis",
        value: "Witch Leaders channel themselves.",
      },
      {
        name: "Phasmatos Magicae @user",
        value: "Channels a user as a Channeled Witch. Linked Witches and Witch Leaders only.",
      },
      {
        name: "Med Dette Suglet Cuem Saluta Novissium @user",
        value: "Elevates a user to Linked Witch. Witch Leaders only.",
      },
      {
        name: "Phasmatos Ravaros On Animum",
        value: "Restores a Witch Leader's spell access.",
      }
    );

  await message.channel.send({ embeds: [embed] });
}

async function showHierarchy(message) {
  const leaders = [...LEADER_USERNAMES].map(
    (name) => `• ${name}`
  );

  leaders.unshift("• Bot owner");

  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("♛ Coven Hierarchy")
    .setDescription(
      "**1. Witch Leaders**\n" +
        leaders.join("\n") +
        "\n\n" +
        hierarchyList("2. Linked Witches", linkedWitches) +
        "\n\n" +
        hierarchyList("3. Channeled Witches", channelledWitches)
    )
    .setFooter({
      text: "Witch access is stored in memory and resets when the bot restarts.",
    });

  await message.channel.send({ embeds: [embed] });
}

async function registerSayCommand() {
  const sayCommand = new SlashCommandBuilder()
    .setName("say")
    .setDescription("Speak through the coven bot without pinging.")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("What should the bot say?")
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to send the message to.")
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement
        )
        .setRequired(false)
    );

  const sayPingCommand = new SlashCommandBuilder()
    .setName("sayping")
    .setDescription("Send a message that can ping users and roles.")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("What should the bot say?")
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to send the message to.")
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement
        )
        .setRequired(false)
    );

  const commands = await client.application.commands.fetch();

  for (const command of [sayCommand, sayPingCommand]) {
    const existing = commands.find(
      (cmd) => cmd.name === command.name
    );

    if (existing) {
      await existing.edit(command.toJSON());
    } else {
      await client.application.commands.create(
        command.toJSON()
      );
    }
  }

  console.log("/say and /sayping commands registered.");
}

client.once("ready", async () => {
  console.log(`${client.user.tag} is ready.`);

  try {
    await registerSayCommand();
  } catch (error) {
    console.error("Failed to register slash commands:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (
    interaction.commandName !== "say" &&
    interaction.commandName !== "sayping"
  ) {
    return;
  }

  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({
      content: "You are not authorised to use this command.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const isSayPing = interaction.commandName === "sayping";
  const text = interaction.options.getString("message", true);

  const channel =
    interaction.options.getChannel("channel") ||
    interaction.channel;

  if (
    !channel ||
    !channel.isTextBased() ||
    typeof channel.send !== "function"
  ) {
    return interaction.reply({
      content: "That channel cannot receive messages.",
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    await channel.send({
      content: text,
      allowedMentions: isSayPing
        ? {
            parse: ["users", "roles", "everyone"],
          }
        : {
            parse: [],
            repliedUser: false,
          },
    });

    await interaction.reply({
      content: `✨ Your message has been sent to <#${channel.id}>.`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: {
        parse: [],
      },
    });
  } catch (error) {
    console.error(`/${interaction.commandName} failed:`, error);

    const response = {
      content: "The spell failed. Check my channel permissions.",
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(response);
    }

    return interaction.reply(response);
  }
});

client.on("messageCreate", async (message) => {
  try {
    if (!message.guild || message.author.bot) return;
    if (!message.mentions.has(client.user)) return;

    const spell = getSpellText(message);
    const author = message.author;
    const leader = isLeader(author);
    const rank = witchRank(author);

    const recognizedSpells = new Set([
      "GRIMOIRE",
      "HIERARCHY",
      "COVEN HIERARCHY",
      "SILENCIO",
      "PONTEM PRAESIDO ANCHORA IMMORTALIBUS",
      "PHASMATOS SOMNUS",
      "THE POWER OF THREE WILL SET US FREE",
      "PHASMATOS REDUX REDISMO SUS TERRA",
      "PHASMATOS RAVAROS",
      "PHASMATOS DEVOS MALE",
      "HARAE TAMAE KIOKU YOMIGAERASHI TAMAE",
      "SPIRITUS IMMORTALITIS",
      "PHASMATOS MAGICAE",
      "MED DETTE SUGLET CUEM SALUTA NOVISSIUM",
      "PHASMATOS RAVAROS ON ANIMUM",
    ]);

    if (!recognizedSpells.has(spell)) return;

    const channelingSpell = [
      "SPIRITUS IMMORTALITIS",
      "PHASMATOS MAGICAE",
      "MED DETTE SUGLET CUEM SALUTA NOVISSIUM",
      "PHASMATOS RAVAROS ON ANIMUM",
    ].includes(spell);

    if (!rank && !channelingSpell) return;

    if (spell === "GRIMOIRE") {
      if (!canCast(author)) return;
      return showGrimoire(message);
    }

    if (
      spell === "HIERARCHY" ||
      spell === "COVEN HIERARCHY"
    ) {
      if (!canCast(author)) return;
      return showHierarchy(message);
    }

    if (spell === "SPIRITUS IMMORTALITIS") {
      if (!leader) return;

      addLinked({
        id: author.id,
        user: { username: author.username },
      });

      await sendSpellGif(
        message,
        "Spiritus Immortalitis",
        SPIRIT_GIF
      );

      return reply(
        message,
        "The spirits have answered. You are a Linked Witch."
      );
    }

    if (spell === "PHASMATOS MAGICAE") {
      if (!canManageWitches(author)) return;

      const target = await getTargetMember(message);

      if (!target || target.user.bot) {
        return reply(message, "Mention a valid user to channel.");
      }

      if (isLeader(target.user)) {
        return reply(message, "Witch Leaders cannot be downgraded.");
      }

      addChannelled(target);

      await sendSpellGif(
        message,
        "Phasmatos Magicae",
        MAGICAE_GIF
      );

      return reply(
        message,
        `✨ **${target.user.username}** is now a Channeled Witch.`
      );
    }

    if (spell === "MED DETTE SUGLET CUEM SALUTA NOVISSIUM") {
      if (!leader) return;

      const target = await getTargetMember(message);

      if (!target || target.user.bot) {
        return reply(message, "Mention a valid user to link.");
      }

      if (isLeader(target.user)) {
        return reply(message, "That user is already a Witch Leader.");
      }

      addLinked(target);

      await sendSpellGif(
        message,
        "Med Dette Suglet Cuem Saluta Novissium",
        MAGICAE_GIF
      );

      return reply(
        message,
        `✨ **${target.user.username}** has been elevated to **Linked Witch**. They can now channel other users and use advanced spells.`
      );
    }

    if (spell === "PHASMATOS RAVAROS ON ANIMUM") {
      if (!leader) return;

      addLinked({
        id: author.id,
        user: { username: author.username },
      });

      await sendSpellGif(
        message,
        "Phasmatos Ravaros On Animum",
        RAVAROS_GIF
      );

      return reply(
        message,
        "Your spell access has been restored."
      );
    }

    if (!canCast(author)) return;

    const linkedOnly = new Set([
      "THE POWER OF THREE WILL SET US FREE",
      "PHASMATOS REDUX REDISMO SUS TERRA",
      "PHASMATOS RAVAROS",
      "PHASMATOS DEVOS MALE",
      "HARAE TAMAE KIOKU YOMIGAERASHI TAMAE",
      "PONTEM PRAESIDO ANCHORA IMMORTALIBUS",
    ]);

    if (
      linkedOnly.has(spell) &&
      !canManageWitches(author)
    ) {
      return reply(
        message,
        "You need to be a Linked Witch or Witch Leader to cast this spell."
      );
    }

    if (spell === "SILENCIO") {
      const target = await getTargetMember(message);

      return castTimeout(
        message,
        target,
        5 * 60 * 1000,
        "Silencio"
      );
    }

    if (spell === "PONTEM PRAESIDO ANCHORA IMMORTALIBUS") {
      const target = await getTargetMember(message);

      if (!target) {
        return reply(
          message,
          "Mention a target or reply to their message."
        );
      }

      if (
        target.id === author.id ||
        target.id === client.user.id
      ) {
        return reply(message, "Choose another user as your target.");
      }

      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ModerateMembers
        )
      ) {
        return reply(
          message,
          "You need Moderate Members permission."
        );
      }

      try {
        await target.timeout(
          null,
          "Pontem Praesido Anchora Immortalibus"
        );

        return reply(
          message,
          `✨ The timeout on **${target.user.username}** has been lifted.`
        );
      } catch (error) {
        console.error("Timeout removal failed:", error);

        return reply(
          message,
          "The spell failed. Check my permissions and role hierarchy."
        );
      }
    }

    if (spell === "PHASMATOS SOMNUS") {
      const target = await getTargetMember(message);

      return castTimeout(
        message,
        target,
        60 * 1000,
        "Phasmatos Somnus"
      );
    }

    if (spell === "THE POWER OF THREE WILL SET US FREE") {
      const target = await getTargetMember(message);

      if (!target) {
        return reply(
          message,
          "Mention a target or reply to their message."
        );
      }

      if (
        target.id === author.id ||
        target.id === client.user.id
      ) {
        return reply(message, "You cannot ban yourself or the bot.");
      }

      if (!target.bannable) {
        return reply(
          message,
          "I cannot ban that user. Check my Ban Members permission and role hierarchy."
        );
      }

      try {
        await target.ban({
          reason: "The Power of Three Will Set Us Free",
        });

        return reply(
          message,
          `✨ **${target.user.username}** has been banished by the Power of Three.`
        );
      } catch (error) {
        console.error("Ban spell failed:", error);

        return reply(
          message,
          "The spell failed. Check my permissions."
        );
      }
    }

    if (spell === "PHASMATOS REDUX REDISMO SUS TERRA") {
      const target = await getTargetMember(message);

      if (!target) {
        return reply(
          message,
          "Mention a target or reply to their message."
        );
      }

      if (
        target.id === author.id ||
        target.id === client.user.id
      ) {
        return reply(message, "You cannot kick yourself or the bot.");
      }

      if (!target.kickable) {
        return reply(
          message,
          "I cannot kick that user. Check my Kick Members permission and role hierarchy."
        );
      }

      try {
        await target.kick(
          "Phasmatos Redux Redismo Sus Terra"
        );

        return reply(
          message,
          `✨ **${target.user.username}** has been banished from the server.`
        );
      } catch (error) {
        console.error("Kick spell failed:", error);

        return reply(
          message,
          "The spell failed. Check my permissions."
        );
      }
    }

    if (spell === "PHASMATOS RAVAROS") {
      const replied = await getRepliedMessage(message);

      if (!replied) {
        return reply(
          message,
          "Reply to a message to cast this spell."
        );
      }

      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageMessages
        )
      ) {
        return reply(
          message,
          "You need Manage Messages permission."
        );
      }

      await replied.delete();

      return reply(
        message,
        "✨ The targeted message has been banished."
      );
    }

    if (spell === "PHASMATOS DEVOS MALE") {
      const target = await getTargetMember(message);

      if (!target) {
        return reply(
          message,
          "Mention a witch or reply to their message."
        );
      }

      if (isLeader(target.user)) {
        return reply(
          message,
          "Witch Leaders cannot be unchannelled."
        );
      }

      if (
        !channelledWitches.has(target.id) &&
        !linkedWitches.has(target.id)
      ) {
        return reply(
          message,
          "That user does not currently have witch access."
        );
      }

      if (
        linkedWitches.has(target.id) &&
        !leader
      ) {
        return reply(
          message,
          "Only Witch Leaders can unchannel a Linked Witch."
        );
      }

      removeWitch(target);

      return reply(
        message,
        `✨ **${target.user.username}** has been unchannelled and removed from the whitelist.`
      );
    }

    if (spell === "HARAE TAMAE KIOKU YOMIGAERASHI TAMAE") {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageMessages
        )
      ) {
        return reply(
          message,
          "You need Manage Messages permission to purge this channel."
        );
      }

      const recent = await message.channel.messages.fetch({
        limit: 50,
        before: message.id,
      });

      if (recent.size === 0) {
        return reply(
          message,
          "There are no recent messages to purge."
        );
      }

      const deleted = await message.channel.bulkDelete(
        recent,
        true
      );

      return reply(
        message,
        `✨ The spell purged **${deleted.size}** recent message(s). Messages older than 14 days cannot be bulk-deleted.`
      );
    }
  } catch (error) {
    console.error("Spell handler error:", error);

    try {
      await reply(
        message,
        "The spell failed. Check the bot console and permissions."
      );
    } catch {}
  }
});

if (!TOKEN) {
  console.error(
    "Missing bot token. Set DISCORD_TOKEN or TOKEN in your host environment."
  );

  process.exit(1);
}

client.login(TOKEN);
