// bot.js
const fs = require("fs");
const {
  Client,
  GatewayIntentBits
} = require("discord.js");
const {
  getOrCreateServerMessage,
  updateServerMessage,
  getArma3ServerInfo
} = require("./functions");

let config = null;
try {
  const data = fs.readFileSync("config.json", "utf8");
  config = JSON.parse(data);
} catch (err) {
  console.error("Error reading config file:", err);
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  try {
    const savedMessageId = await getOrCreateServerMessage(client, config);

    // Интервал обновления — 20 секунд
    setInterval(async () => {
      try {
        const serverInfo = await getArma3ServerInfo(config);
        if (!serverInfo) return;
        await updateServerMessage(client, config, savedMessageId);
      } catch (intervalErr) {
        console.error("Error in updateServerMessage:", intervalErr);
      }
    }, 20 * 1000);
  } catch (err) {
    console.error("Error initializing bot:", err);
  }
});

client.login(config.BotToken);
