import { Client, Events, GatewayIntentBits } from "discord.js";

import { info, error } from "./utils/logger.js";
// import { initCommands, onMessage } from "./utils/commandHandler.js";

import config from "./secrets/config.json" with { type: "json" };

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

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    error(
      `No command matching ${interaction.commandName} was found.`,
      interaction.guild.name,
    );
    return;
  }

  try {
    await command.execute(interaction);
  } catch (msg) {
    error(msg);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

client.login(config.token);

// initCommands(client);

// client.on("messageCreate", onMessage.bind(null, client));

process.on("unhandledRejection", (msg) => {
  error("Unhandled promise rejection:" + msg, "main");
});
