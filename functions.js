// functions.js
const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
// Если вы видите ошибку "Gamedig.query is not a function", 
// попробуйте вместо require("gamedig") использовать require("gamedig").default
const Gamedig = require("gamedig");

// Читаем из serverMessageId.txt
function loadServerMessageId() {
  try {
    const data = fs.readFileSync("serverMessageId.txt", "utf8");
    return data.trim();
  } catch (err) {
    console.error("Error loading server message ID:", err);
    return null;
  }
}

// Записываем в serverMessageId.txt
function saveServerMessageId(messageId) {
  try {
    fs.writeFileSync("serverMessageId.txt", messageId);
  } catch (err) {
    console.error("Error saving server message ID:", err);
  }
}

// Запрашиваем информацию о сервере Arma 3
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

// Определяем организацию игрока: если ник содержит mapping.tag — подходит.
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

/**
 * Создаёт Embed с информацией о сервере.
 * - В полях (название, карта, ... ) текст выводится в код-бэктиках `...`.
 * - Группы игроков выводятся в ```ansi ...``` с использованием ANSI-цветов.
 */
function createServerInfoEmbed(serverInfo, organizationMappings, config) {
  const embed = new EmbedBuilder();

  // Автор
  const authorName = config.AutorName || "Неизвестно";
  const authorAvatar = config.AutorURLavatar || "";
  embed.setAuthor({ name: authorName, iconURL: authorAvatar });

  // Заголовок
  embed.setTitle("Общая информация");

  // 1) Название сервера
  const serverName = serverInfo?.name || "Неизвестно";
  embed.addFields({
    name: "Название сервера Arma",
    value: `\`${serverName}\``,
    inline: true
  });

  // 2) Прямое подключение
  const connectInfo = serverInfo?.connect || "undefined:undefined";
  embed.addFields({
    name: "Прямое подключение",
    value: `\`${connectInfo}\``,
    inline: true
  });

  // 3) Адрес TS3
  const ts3Address = config.TS3adres || "shkilafon.ts3.re";
  embed.addFields({
    name: "Адрес [TS3]",
    value: `\`${ts3Address}\``,
    inline: true
  });

  // 4) Статус
  const playersCount = serverInfo?.players?.length || 0;
  const isOnline = playersCount > 0 ? "✅ Онлайн" : "❌ Сдох";
  embed.addFields({
    name: "Статус сервера",
    value: `\`${isOnline}\``,
    inline: true
  });

  // 5) Игроки онлайн
  const maxPlayers = serverInfo?.maxplayers || 0;
  embed.addFields({
    name: "Игроки онлайн",
    value: `\`${playersCount}/${maxPlayers}\``,
    inline: true
  });

  // 6) Карта
  const mapName = serverInfo?.map || "Неизвестно";
  embed.addFields({
    name: "Карта на сервере",
    value: `\`${mapName}\``,
    inline: true
  });

  // Цвет Embed и время
  embed.setColor("#00ff00");
  embed.setTimestamp();

  // 7) Если кто-то играет — группируем по организациям
  if (playersCount > 0) {
    // orgGroups будет: { "НАЗВАНИЕ_ГРУППЫ": [ {orgData, playerName}, ... ], ... }
    const orgGroups = {};

    for (const player of serverInfo.players) {
      const foundOrg = getPlayerOrganization(player.name, organizationMappings);
      // Если ничего не нашлось, создадим заглушку
      const orgName = foundOrg ? foundOrg.name : "Неизвестно";
      if (!orgGroups[orgName]) {
        orgGroups[orgName] = [];
      }
      // Сохраняем инфу об ansi-цвете, нике и т. д.
      orgGroups[orgName].push({
        ansiColor: foundOrg?.ansiColor || "0;37", // белый, если не указано
        playerName: player.name
      });
    }

    // Выводим каждую группу отдельным Embed-полем
    for (const orgName in orgGroups) {
      // Собираем всех игроков в один code-block
      // Пример: 
      // ```ansi
      // \u001b[0;31mPlayer1\u001b[0m
      // \u001b[0;31mPlayer2\u001b[0m
      // ```
      let blockLines = "";
      orgGroups[orgName].forEach(({ ansiColor, playerName }) => {
        blockLines += `\u001b[${ansiColor}m${playerName}\u001b[0m\n`;
      });

      const codeBlock = 
        "```ansi\n" +
        blockLines + 
        "```";

      embed.addFields({
        name: orgName,      // "Бойцы класса ARF" и т.п.
        value: codeBlock,
        inline: false
      });
    }
  }

  return embed;
}

/**
 * Если serverMessageId.txt пуст — создаём новое сообщение на канале и сохраняем ID.
 * Иначе — возвращаем уже сохранённое.
 */
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

/**
 * Редактируем (обновляем) существующее сообщение новым Embed
 */
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

// Экспортируем функции
module.exports = {
  getOrCreateServerMessage,
  updateServerMessage,
  getArma3ServerInfo
};
