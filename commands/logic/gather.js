import { SlashCommandBuilder } from "discord.js";
import { info } from "../../utils/logger.js";
import {
  addResult,
  setLastGatheredMessageId,
} from "../../utils/databaseHandler.js";

const colors = {
  "🟩": 0,
  "🟨": 1,
  "🟦": 2,
  "🟪": 3,
};

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
      const { isResult, puzzleNumber, result } = parseResult(msg.content);
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

    fromMessageOn = messages.first()?.id;
    setLastGatheredMessageId(msg.guild, msg.channel, fromMessageOn);
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

const parseResult = (messageContent) => {
  if (!messageContent) return false;

  const lines = messageContent.split("\n");
  let rowCount = 0;

  let puzzleNumber;
  const result = [];

  for (const line of lines) {
    if (line.startsWith("Puzzle #")) {
      const match = line.match(/Puzzle #(\d+)/);
      if (match) {
        puzzleNumber = parseInt(match[1], 10);
      }
    }

    const cleanLine = line.replace(/\s+/g, "");
    if (/[🟩🟨🟦🟪]{8}/.test(cleanLine)) {
      result.push(Array.from(cleanLine).map((char) => colors[char]));
      rowCount++;
    }
  }

  return { isResult: rowCount >= 4 && rowCount <= 8, puzzleNumber, result };
};
