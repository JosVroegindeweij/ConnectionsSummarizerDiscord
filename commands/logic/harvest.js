import { SlashCommandBuilder } from "discord.js";
import { info } from "../../utils/logger";

export const data = new SlashCommandBuilder()
  .setName("harvest")
  .setDescription("Harvests the connections results from channel history!")
  .addChannelOption((option) =>
    option
      .setName("fromChannel")
      .setDescription("The channel to harvest messages from")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("fromMessageOn")
      .setDescription("Start looking after this message")
      .setRequired(true),
  );

export const execute = async (interaction) => {
  await interaction.reply("Harvesting started!");

  const fromChannel = interaction.options.getChannel("fromChannel");
  let fromMessageOn = interaction.options.getString("fromMessageOn");

  info("Harvesting connections results...", interaction.guild.name);
  let messages = await fromChannel.messages.fetch({
    after: fromMessageOn,
    limit: 5,
    cache: false,
  });
  let totalHarvested = 5;
  info("Harvested 5 messages", interaction.guild.name);

  fromMessageOn = messages.last().id;

  while (messages.size >= 5) {
    // Harvesting more messages
    messages = await fromChannel.messages.fetch({
      limit: 5,
      after: fromMessageOn,
      cache: false,
    });
    totalHarvested += messages.size;
    info(`Harvested ${messages.size} messages`, interaction.guild.name);
  }

  await interaction.reply(
    `Harvesting complete! Harvested ${totalHarvested} messages.`,
  );
};
