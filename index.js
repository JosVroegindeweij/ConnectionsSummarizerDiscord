import { Client, Events, GatewayIntentBits, REST, Routes } from "discord.js";

import { info, error } from "./utils/logger.js";
// import { initCommands, onMessage } from "./utils/commandHandler.js";

import config from "./secrets/config.json" with { type: "json" };

const rest = new REST({ version: "10" }).setToken(config.token);
const commands = [
  {
    name: "ping",
    description: "Replies with Pong!",
  },
];

try {
  info("Registering slash commands.", "main");
  await rest.put(Routes.applicationCommands(config.client_id), { body: commands });
  info("Successfully registered slash commands.", "main");
} catch (msg) {
  error(msg);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on(Events.ClientReady, (readyClient) => {
  info(`Logged in as ${readyClient.user.tag}`, "main");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply("Pong!");
  }
});

client.login(config.token);

// initCommands(client);

// client.on("messageCreate", onMessage.bind(null, client));

process.on("unhandledRejection", (msg) => {
  error("Unhandled promise rejection:" + msg, "main");
});
