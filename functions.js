const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const Gamedig = require("gamedig");

function loadServerMessageId() {
  try {
    const data = fs.readFileSync("serverMessageId.txt", "utf8");
    return data.trim();
  } catch (err) {
    console.error("Error loading server message ID:", err);
    return null;
  }
}

function saveServerMessageId(messageId) {
  try {
    fs.writeFileSync("serverMessageId.txt", messageId);
  } catch (err) {
    console.error("Error saving server message ID:", err);
  }
}

async function getArma3ServerInfo(config) {
  console.log("Getting Arma 3 server info...");
  try {
    const result = await Gamedig.query({
      type: "arma3",
      host: config.ServerAdress,
      port: config.ServerGamePort
    });
    console.log("Got Arma 3 server info:", result);
    return result;
  } catch (err) {
    console.error("Error getting Arma 3 server info:", err);
    return null;
  }
}

function getPlayerOrganization(playerName, mappings) {
  let bestMatch = null;
  for (const mapping of mappings) {
    if (playerName.includes(mapping.tag)) {
      if (!bestMatch || mapping.priority > bestMatch.priority) {
        bestMatch = mapping;
      }
    }
  }
  return bestMatch;
}

function createServerInfoEmbed(serverInfo, organizationMappings, config) {
  const embed = new EmbedBuilder();

  const authorName = config.AutorName || "Неизвестно";
  const authorAvatar = config.AutorURLavatar || "";
  embed.setAuthor({ name: authorName, iconURL: authorAvatar });

  embed.setTitle("Общая информация");

  const serverName = serverInfo?.name || "Неизвестно";
  embed.addFields({
    name: "Название сервера Arma",
    value: `\`${serverName}\``,
    inline: true
  });

  const connectInfo = serverInfo?.connect || "undefined:undefined";
  embed.addFields({
    name: "Прямое подключение",
    value: `\`${connectInfo}\``,
    inline: true
  });

  const ts3Address = config.TS3adres || "shkilafon.ts3.re";
  embed.addFields({
    name: "Адрес [TS3]",
    value: `\`${ts3Address}\``,
    inline: true
  });

  const playersCount = serverInfo?.players?.length || 0;
  const isOnline = playersCount > 0 ? "✅ Онлайн" : "✅ Онлайн";
  embed.addFields({
    name: "Статус сервера",
    value: `\`${isOnline}\``,
    inline: true
  });

  const maxPlayers = serverInfo?.maxplayers || 0;
  embed.addFields({
    name: "Игроки онлайн",
    value: `\`${playersCount}/${maxPlayers}\``,
    inline: true
  });

  const mapName = serverInfo?.map || "Неизвестно";
  embed.addFields({
    name: "Карта на сервере",
    value: `\`${mapName}\``,
    inline: true
  });

  embed.setColor("#00ff00");
  embed.setTimestamp();

  if (playersCount > 0) {
    const orgGroups = {};

    for (const player of serverInfo.players) {
      const foundOrg = getPlayerOrganization(player.name, organizationMappings);
      const orgName = foundOrg ? foundOrg.name : "Неизвестно";
      if (!orgGroups[orgName]) {
        orgGroups[orgName] = [];
      }
      orgGroups[orgName].push({
        ansiColor: foundOrg?.ansiColor || "0;37",
        playerName: player.name
      });
    }

    for (const orgName in orgGroups) {`
      let blockLines = "";
      orgGroups[orgName].forEach(({ ansiColor, playerName }) => {
        blockLines += `\u001b[${ansiColor}m${playerName}\u001b[0m\n`;
      });

      const codeBlock = 
        "```ansi\n" +
        blockLines + 
        "```";

      embed.addFields({
        name: orgName,
        value: codeBlock,
        inline: false
      });
    }
  }

  return embed;
}

async function getOrCreateServerMessage(client, config) {
  console.log("Attempting to get or create server message...");

  const channel = await client.channels.fetch(config.YourChannelId);
  let messageId = loadServerMessageId();

  if (!messageId) {
    console.log("Creating a new server message...");
    const serverInfo = await getArma3ServerInfo(config);
    const embed = createServerInfoEmbed(serverInfo, config.PlayerOrganizationMappings, config);
    const msg = await channel.send({ embeds: [embed] });
    messageId = msg.id;
    saveServerMessageId(messageId);
    console.log("Server message created:", messageId);
  } else {
    console.log("Found existing server message:", messageId);
  }

  return messageId;
}

async function updateServerMessage(client, config, messageId) {
  console.log("Updating server message...");
  try {
    const serverInfo = await getArma3ServerInfo(config);
    if (!serverInfo) return;

    const embed = createServerInfoEmbed(serverInfo, config.PlayerOrganizationMappings, config);
    const channel = await client.channels.fetch(config.YourChannelId);
    const msg = await channel.messages.fetch(messageId);

    await msg.edit({ embeds: [embed] });
    console.log("Server message updated successfully.");
  } catch (err) {
    console.error("Error updating server message:", err);
  }
}

module.exports = {
  getOrCreateServerMessage,
  updateServerMessage,
  getArma3ServerInfo
};
