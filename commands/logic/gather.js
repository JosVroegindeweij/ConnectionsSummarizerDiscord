import { SlashCommandBuilder } from "discord.js";
import { info } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("gather")
  .setDescription("Gathers the connections results from channel history!")
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("The channel to gather messages from")
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
  await interaction.reply("Gathering started!");

  const fromChannel = interaction.options.getChannel("channel");
  let fromMessageOn = interaction.options.getString("startingfrommessageid");

  info("Gathering connections results...", interaction.guild.name);
  let messages;
  let totalGathered = 0;
  let totalRelevant = 0;

  do {
    messages = await fromChannel.messages.fetch({
      after: fromMessageOn,
      limit: 5,
      cache: false,
    });
    totalGathered += messages.size;
    info(
      `Gathered ${messages.size} messages up to ${messages.first()?.id}. Relevant so far: ${totalRelevant}`,
      interaction.guild.name,
    );

    messages.forEach((msg) => {
      if (isRelevant(msg)) {
        console.log(msg.content);
        totalRelevant++;
      }
    });

    fromMessageOn = messages.first()?.id;
    if (totalGathered % 20 === 0) {
      await interaction.editReply(
        `Gathered ${totalGathered} messages so far. Found ${totalRelevant} relevant messages!`,
      );
    }
  } while (messages.size >= 5);

  info(`Total gathered messages: ${totalGathered}. Total relevant messages: ${totalRelevant}`, interaction.guild.name);
  await interaction.editReply(
    `Gathering complete! Gathered ${totalGathered} messages. Found ${totalRelevant} relevant messages!`,
  );
};

const isRelevant = (message) => {
  if (!message.content) return false;

  const lines = message.content.split("\n");
  let rowCount = 0;

  for (const line of lines) {
    const cleanLine = line.replace(/\s+/g, '');
    if (/[🟩🟨🟦🟪]{8}/.test(cleanLine)) {
      rowCount++;
    }
  }

  return rowCount >= 4 && rowCount <= 8;
};
