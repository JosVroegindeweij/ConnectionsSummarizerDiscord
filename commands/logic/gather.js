import { SlashCommandBuilder } from "discord.js";
import { info } from "../../utils/logger.js";
import {
  addResult,
  setLastGatheredMessageId,
} from "../../utils/databaseHandler.js";
import { parseConnectionsResult } from "../../utils/connectionsParser.js";

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
      const { isResult, puzzleNumber, result } = parseConnectionsResult(msg.content);
      if (isResult) {
        totalRelevant++;
        addResult(
          msg.guild,
          msg.channel,
          msg.author,
          msg.createdTimestamp,
          puzzleNumber,
          result,
        );
      }
    });

    const lastMessage = messages.first();
    if (lastMessage) {
      fromMessageOn = lastMessage.id;
      setLastGatheredMessageId(
        lastMessage.guild,
        lastMessage.channel,
        fromMessageOn,
      );
    }

    if (totalGathered % 20 === 0) {
      await interaction.editReply(
        `Gathered ${totalGathered} messages so far. Found ${totalRelevant} relevant messages!`,
      );
    }
  } while (messages.size >= 5);

  info(
    `Total gathered messages: ${totalGathered}. Total relevant messages: ${totalRelevant}`,
    interaction.guild.name,
  );
  await interaction.editReply(
    `Gathering complete! Gathered ${totalGathered} messages. Found ${totalRelevant} relevant messages!`,
  );
};
