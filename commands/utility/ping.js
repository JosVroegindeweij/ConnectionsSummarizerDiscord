import { SlashCommandBuilder } from "discord.js";
import { info } from "../../utils/logger";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Replies with Pong!");

export const execute = async (interaction) => {
  await interaction.reply("Pong!");
  info("Ping command executed", interaction.guild.name);
};
