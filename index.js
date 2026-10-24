
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
const OWNER_ID = "1234183450618232902";

const SPIRIT_GIF =
  "https://cdn.discordapp.com/attachments/1235588110885195838/1563683011877281902/27b0b9680165b2df371f972ea194eef7.gif?ex=6ade84c9&is=6add3349&hm=2d939aeebe98442a95e4461933c854c88a82afc5919d0eb4fce399dbfba13850&";

const RAVAROS_GIF =
  "https://cdn.discordapp.com/attachments/1235588110885195838/1563683974260457502/tvd-bonnie.gif?ex=6ade85af&is=6add342f&hm=7c05ae2036b396f256465a2c1f48b74bb8553e9f3f8021391d75f887ffa7a345&";

const MAGICAE_GIF =
  "https://cdn.discordapp.com/attachments/1235588110885195838/1563684049338236990/2c594ac0f2ce24de961c23570f2c3fd0.gif?ex=6ade85c1&is=6add3441&hm=e8bdf868044c047390813896ac204ee09241536bda90694e10b54c27ae46c563&";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Channeling is reset when the bot restarts.
const channelledUsers = new Set();

const SPELLS = [
  {
    name: "Silencio",
    effect: "Times out a target for 5 minutes.",
  },
  {
    name: "Pontem Praesido Anchora Immortalibus",
    effect: "Removes a timeout from a target.",
  },
  {
    name: "Phasmatos Somnus",
    effect: "Places a target in a 1-minute magical sleep.",
  },
  {
    name: "The Power of Three Will Set Us Free",
    effect: "Bans a target from the server.",
  },
  {
    name: "Phasmatos Redux Redismo Sus Terra",
    effect: "Kicks a target from the server.",
  },
  {
    name: "Phasmatos Ravaros",
    effect: "Deletes the message you are replying to.",
  },
  {
    name: "Phasmatos Devos Male",
    effect: "Deletes up to 5 recent messages from the replied-to user.",
  },
  {
    name: "Harae Tamae Kioku Yomigaerashi Tamae",
    effect: "Purges up to 50 recent messages from the current channel.",
  },
];

const OWNER_ONLY = new Set([
  "SPIRITUS IMMORTALITIS",
  "PHASMATOS MAGICAE",
  "PHASMATOS RAVAROS ON ANIMUM",
  "THE POWER OF THREE WILL SET US FREE",
  "PHASMATOS REDUX REDISMO SUS TERRA",
  "HARAE TAMAE KIOKU YOMIGAERASHI TAMAE",
  "PHASMATOS DEVOS MALE",
  "PHASMATOS RAVAROS",
  "PONTEM PRAESIDO ANCHORA IMMORTALIBUS",
]);

function normalize(text) {
  return text
    .toUpperCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
    allowedMentions: { repliedUser: false },
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
    return reply(message, "You cannot cast that spell on yourself or the bot.");
  }

  if (!target.moderatable) {
    return reply(
      message,
      "I cannot affect that user. Check my **Moderate Members** permission and role hierarchy."
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
      "The spell failed. Check my **Moderate Members** permission."
    );
  }
}

async function showGrimoire(message) {
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("📖 The Grimoire")
    .setDescription(
      "Mention the bot with an incantation to cast it. You must be channelled first."
    )
    .addFields(
      SPELLS.map((spell) => ({
        name: spell.name,
        value: spell.effect,
      }))
    )
    .addFields({
      name: "Channeling",
      value:
        "`Spiritus Immortalitis` — channel yourself.\n" +
        "`Phasmatos Magicae @user` — channel another user.\n" +
        "`Phasmatos Ravaros On Animum` — restore your own spell access.",
    })
    .setFooter({
      text: "Some Discord effects are custom adaptations of magical incantations.",
    });

  await message.channel.send({ embeds: [embed] });
}

client.once("ready", () => {
  console.log(`${client.user.tag} is ready.`);
});

client.on("messageCreate", async (message) => {
  try {
    if (!message.guild || message.author.bot) return;

    // Every spell must mention the bot.
    if (!message.mentions.has(client.user)) return;

    const spell = getSpellText(message);
    const isOwner = message.author.id === OWNER_ID;

    // Channeling commands are owner-only.
    if (
      [
        "SPIRITUS IMMORTALITIS",
        "PHASMATOS MAGICAE",
        "PHASMATOS RAVAROS ON ANIMUM",
      ].includes(spell) &&
      !isOwner
    ) {
      return reply(message, "Only the coven owner can channel users.");
    }

    if (OWNER_ONLY.has(spell) && !isOwner) {
      return reply(message, "Only the coven owner can cast that spell.");
    }

    // Channel yourself.
    if (spell === "SPIRITUS IMMORTALITIS") {
      channelledUsers.add(message.author.id);

      await sendSpellGif(
        message,
        "Spiritus Immortalitis",
        SPIRIT_GIF
      );

      return reply(message, "The spirits have answered. You are channelled.");
    }

    // Channel another user.
    if (spell === "PHASMATOS MAGICAE") {
      const target = await getTargetMember(message);

      if (!target) {
        return reply(message, "Mention the user you wish to channel.");
      }

      if (target.user.bot) {
        return reply(message, "You cannot channel a bot.");
      }

      channelledUsers.add(target.id);

      await sendSpellGif(
        message,
        "Phasmatos Magicae",
        MAGICAE_GIF
      );

      return reply(
        message,
        `✨ **${target.user.username}** has been channelled.`
      );
    }

    // Restore the owner's spell access.
    if (spell === "PHASMATOS RAVAROS ON ANIMUM") {
      channelledUsers.add(message.author.id);

      await sendSpellGif(
        message,
        "Phasmatos Ravaros On Animum",
        RAVAROS_GIF
      );

      return reply(message, "Your spell access has been restored.");
    }

    // Only channelled users can cast spells.
    if (!channelledUsers.has(message.author.id)) {
      return reply(
        message,
        "You have not been channelled. Ask the coven owner to channel you first."
      );
    }

    if (spell === "GRIMOIRE") {
      return showGrimoire(message);
    }

    // Silencio: 5-minute timeout.
    if (spell === "SILENCIO") {
      const target = await getTargetMember(message);

      return castTimeout(
        message,
        target,
        5 * 60 * 1000,
        "Silencio"
      );
    }

    // Custom spell: remove timeout.
    if (spell === "PONTEM PRAESIDO ANCHORA IMMORTALIBUS") {
      const target = await getTargetMember(message);

      if (!target) {
        return reply(message, "Mention a target or reply to their message.");
      }

      if (
        target.id === message.author.id ||
        target.id === client.user.id
      ) {
        return reply(message, "Choose another user as your target.");
      }

      if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return reply(
          message,
          "You need **Moderate Members** permission to remove timeouts."
        );
      }

      try {
        await target.timeout(null, "Pontem Praesido Anchora Immortalibus");

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

    // Phasmatos Somnus: 1-minute timeout.
    if (spell === "PHASMATOS SOMNUS") {
      const target = await getTargetMember(message);

      return castTimeout(
        message,
        target,
        60 * 1000,
        "Phasmatos Somnus"
      );
    }

    // The Power of Three: ban.
    if (spell === "THE POWER OF THREE WILL SET US FREE") {
      const target = await getTargetMember(message);

      if (!target) {
        return reply(message, "Mention a target or reply to their message.");
      }

      if (
        target.id === message.author.id ||
        target.id === client.user.id
      ) {
        return reply(message, "You cannot ban yourself or the bot.");
      }

      if (!target.bannable) {
        return reply(
          message,
          "I cannot ban that user. Check my **Ban Members** permission and role hierarchy."
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

        return reply(message, "The ban spell failed. Check my permissions.");
      }
    }

    // Phasmatos Redux Redismo Sus Terra: kick.
    if (spell === "PHASMATOS REDUX REDISMO SUS TERRA") {
      const target = await getTargetMember(message);

      if (!target) {
        return reply(message, "Mention a target or reply to their message.");
      }

      if (
        target.id === message.author.id ||
        target.id === client.user.id
      ) {
        return reply(message, "You cannot kick yourself or the bot.");
      }

      if (!target.kickable) {
        return reply(
          message,
          "I cannot kick that user. Check my **Kick Members** permission and role hierarchy."
        );
      }

      try {
        await target.kick("Phasmatos Redux Redismo Sus Terra");

        return reply(
          message,
          `✨ **${target.user.username}** has been banished from the server.`
        );
      } catch (error) {
        console.error("Kick spell failed:", error);

        return reply(message, "The kick spell failed. Check my permissions.");
      }
    }

    // Phasmatos Ravaros: delete the replied-to message.
    if (spell === "PHASMATOS RAVAROS") {
      const replied = await getRepliedMessage(message);

      if (!replied) {
        return reply(message, "Reply to a message when casting this spell.");
      }

      if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return reply(
          message,
          "You need **Manage Messages** permission to cast this spell."
        );
      }

      try {
        await replied.delete();

        return reply(message, "✨ The targeted message has been banished.");
      } catch (error) {
        console.error("Message deletion failed:", error);

        return reply(
          message,
          "I could not delete that message. Check my permissions."
        );
      }
    }

    // Phasmatos Devos Male: delete up to five recent messages
    // from the author of the message being replied to.
    if (spell === "PHASMATOS DEVOS MALE") {
      const replied = await getRepliedMessage(message);

      if (!replied) {
        return reply(message, "Reply to a user's message to cast this spell.");
      }

      if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return reply(
          message,
          "You need **Manage Messages** permission to cast this spell."
        );
      }

      try {
        const recent = await message.channel.messages.fetch({ limit: 50 });

        const toDelete = recent
          .filter(
            (msg) =>
              msg.author.id === replied.author.id &&
              !msg.pinned &&
              Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000
          )
          .first(5);

        if (toDelete.length === 0) {
          return reply(message, "No eligible messages were found.");
        }

        await message.channel.bulkDelete(toDelete, true);

        return reply(
          message,
          `✨ Removed ${toDelete.length} recent message(s) from **${replied.author.username}**.`
        );
      } catch (error) {
        console.error("Message cleanup failed:", error);

        return reply(message, "The spell failed. Check my permissions.");
      }
    }

    // Harae Tamae Kioku Yomigaerashi Tamae: purge up to 50 recent messages.
    if (spell === "HARAE TAMAE KIOKU YOMIGAERASHI TAMAE") {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return reply(
          message,
          "The bot owner must also have **Manage Messages** permission to purge messages."
        );
      }

      try {
        // Fetch the 50 messages before the command itself.
        const recent = await message.channel.messages.fetch({
          limit: 50,
          before: message.id,
        });

        if (recent.size === 0) {
          return reply(message, "There are no recent messages to purge.");
        }

        const deleted = await message.channel.bulkDelete(recent, true);

        return reply(
          message,
          `✨ The spell purged **${deleted.size}** recent message(s). Messages older than 14 days cannot be bulk-deleted.`
        );
      } catch (error) {
        console.error("Purge spell failed:", error);

        return reply(
          message,
          "The purge failed. Check my **Manage Messages** permission."
        );
      }
    }

    return reply(
      message,
      "That incantation is not in the Grimoire. Cast `Grimoire` to view the available spells."
    );
  } catch (error) {
    console.error("Spell handler error:", error);

    try {
      await reply(message, "The spell misfired. Check the bot console.");
    } catch {
      // The message may no longer be available.
    }
  }
});

if (!TOKEN) {
  console.error(
    "Missing bot token. Set DISCORD_TOKEN or TOKEN in your host environment."
  );
  process.exit(1);
}

client.login(TOKEN);
