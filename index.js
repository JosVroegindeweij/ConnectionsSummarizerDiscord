import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";

import { info, error } from "./utils/logger.js";
import { initCommands } from "./utils/commandHandler.js";
import { parseConnectionsResult } from "./utils/connectionsParser.js";
import { isChannelMonitored, addResult } from "./utils/databaseHandler.js";

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

client.on(Events.MessageCreate, async (message) => {
  // Ignore messages from bots (including ourselves)
  if (message.author.bot) return;

  // Skip if not in a guild (DM messages)
  if (!message.guild) return;

  try {
    // Check if this channel is being monitored
    const isMonitored = await isChannelMonitored(
      message.guild,
      message.channel,
    );
    if (!isMonitored) return;

    // Parse the message content to see if it's a valid connections result
    const { isResult, puzzleNumber, result } = parseConnectionsResult(
      message.content,
    );

    if (isResult) {
      // Add the result to the database
      await addResult(
        message.guild,
        message.channel,
        message.author,
        message.createdTimestamp,
        puzzleNumber,
        result,
      );

      // React with a checkmark to indicate we've processed this message
      await message.react("✅");

      info(
        `Automatically processed connections result from ${message.author.displayName} for puzzle ${puzzleNumber}`,
        message.guild.name,
      );
    }
  } catch (err) {
    error(
      `Error processing message in monitored channel: ${err}`,
      message.guild?.name || "Unknown Guild",
    );
  }
});

client.login(config.token);

initCommands(client);

process.on("unhandledRejection", (msg) => {
  error("Unhandled promise rejection:" + msg, "main");
});
