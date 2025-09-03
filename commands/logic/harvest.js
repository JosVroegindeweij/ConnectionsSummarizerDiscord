import { SlashCommandBuilder } from "discord.js";
import { info } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("harvest")
  .setDescription("Harvests the connections results from channel history!")
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("The channel to harvest messages from")
      .setRequired(true),
  )
  .addStringOption(
    (option) =>
      option
        .setName("startingfrommessageid")
        .setDescription("Start looking after this message")
        .setRequired(true), // Later false when this gets retrieved from the db
  );

export const execute = async (interaction) => {
  await interaction.reply("Harvesting started!");

  const fromChannel = interaction.options.getChannel("channel");
  let fromMessageOn = interaction.options.getString("startingfrommessageid");

  info("Harvesting connections results...", interaction.guild.name);
  let messages;
  let totalHarvested = 0;

  do {
    messages = await fromChannel.messages.fetch({
      after: fromMessageOn,
      limit: 5,
      cache: false,
    });
    totalHarvested += messages.size;
    info(
      `Harvested ${messages.size} messages up to ${messages.first()?.id}`,
      interaction.guild.name,
    );
    fromMessageOn = messages.first()?.id;
    if (totalHarvested % 20 === 0) {
      await interaction.editReply(
        `Harvested ${totalHarvested} messages so far...`,
      );
    }
  } while (messages.size >= 5);

  info(`Total harvested messages: ${totalHarvested}`, interaction.guild.name);
  await interaction.editReply(
    `Harvesting complete! Harvested ${totalHarvested} messages.`,
  );
};
