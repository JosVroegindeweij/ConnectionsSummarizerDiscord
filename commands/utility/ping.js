import { SlashCommandBuilder } from "discord.js";

const setup = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),
  execute: async (interaction) => {
    await interaction.reply("Pong!");
  },
};

export default setup;
