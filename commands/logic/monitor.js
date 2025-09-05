import { SlashCommandBuilder } from "discord.js";
import { info } from "../../utils/logger.js";
import {
  addMonitoredChannel,
  removeMonitoredChannel,
  isChannelMonitored,
  getMonitoredChannels,
} from "../../utils/databaseHandler.js";

export const data = new SlashCommandBuilder()
  .setName("monitor")
  .setDescription("Start or stop monitoring a channel for connections results")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("start")
      .setDescription("Start monitoring a channel for connections results")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The channel to monitor")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("stop")
      .setDescription("Stop monitoring a channel")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The channel to stop monitoring")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription("List all channels currently being monitored"),
  );

export const execute = async (interaction) => {
  if (interaction.user.id !== "257495886844657684")
    await interaction.reply("You do not have permission to use this command!");

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "start") {
    const channel = interaction.options.getChannel("channel");
    const isAlreadyMonitored = await isChannelMonitored(
      interaction.guild,
      channel,
    );

    if (isAlreadyMonitored) {
      await interaction.reply(
        `Channel ${channel.name} is already being monitored for connections results.`,
      );
      return;
    }

    await addMonitoredChannel(interaction.guild, channel);
    info(
      `Started monitoring channel ${channel.name} for connections results`,
      interaction.guild.name,
    );
    await interaction.reply(
      `✅ Started monitoring ${channel.name} for connections results! I'll add a ✅ reaction to each valid connections result I find.`,
    );
  } else if (subcommand === "stop") {
    const channel = interaction.options.getChannel("channel");
    const isMonitored = await isChannelMonitored(interaction.guild, channel);

    if (!isMonitored) {
      await interaction.reply(
        `Channel ${channel.name} is not currently being monitored.`,
      );
      return;
    }

    await removeMonitoredChannel(interaction.guild, channel);
    info(`Stopped monitoring channel ${channel.name}`, interaction.guild.name);
    await interaction.reply(
      `❌ Stopped monitoring ${channel.name} for connections results.`,
    );
  } else if (subcommand === "list") {
    const monitoredChannels = await getMonitoredChannels(interaction.guild);

    if (monitoredChannels.length === 0) {
      await interaction.reply(
        "No channels are currently being monitored for connections results.",
      );
      return;
    }

    const channelList = monitoredChannels
      .map((row) => `<#${row.channel_id}>`)
      .join("\n");

    await interaction.reply(`📋 **Monitored Channels:**\n${channelList}`);
  }
};
