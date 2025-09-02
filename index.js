import { Client, Events, GatewayIntentBits, REST, Routes } from "discord.js";

import { info, error } from "./utils/logger";
import { initCommands, onMessage } from "./utils/commandHandler";

import { TOKEN, CLIENT_ID } from "./secrets/config.json";

const rest = new REST({ version: "10" }).setToken(TOKEN);
const commands = [
  {
    name: "ping",
    description: "Replies with Pong!",
  },
];

try {
  info("Registering slash commands.");
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  info("Successfully registered slash commands.");
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

client.once("ready", () => {
  info("Bot launched!", "main");
});

client
  .login(token)
  .then((_) => info("Logged in", "main"))
  .catch((reason) => error(reason, "main"));

// initCommands(client);

// client.on("messageCreate", onMessage.bind(null, client));

process.on("unhandledRejection", (msg) => {
  error("Unhandled promise rejection:" + msg, "main");
});
