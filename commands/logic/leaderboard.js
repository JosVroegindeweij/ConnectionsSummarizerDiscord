import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { info, error } from "../../utils/logger.js";
import { getLeaderboard } from "../../utils/databaseHandler.js";
import { puzzleNumberToDate } from "../../utils/connectionsUtils.js";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Display leaderboards for different statistics")
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("The type of leaderboard to display")
      .setRequired(true)
      .addChoices(
        { name: "Win rate", value: "winrate" },
        { name: "Games played", value: "played" },
        { name: "Total wins", value: "winner" },
        { name: "Unfailing rate", value: "unfailing" },
        { name: "Win streaks", value: "winstreaks" },
      ),
  );

export async function execute(interaction) {
  const leaderboardType = interaction.options.getString("type");

  info(
    `Leaderboard command invoked by ${interaction.user.tag} in guild ${interaction.guild.name} for type ${leaderboardType}`,
  );

  await displayLeaderboard(interaction, leaderboardType);
}

async function displayLeaderboard(interaction, type) {
  try {
    const leaderboardData = await getLeaderboard(interaction.guild, type);

    if (!leaderboardData) {
      const embed = new EmbedBuilder()
        .setTitle("📊 Leaderboard")
        .setColor(0xff0000)
        .setDescription(
          "❌ Error retrieving leaderboard data. Please try again later.",
        )
        .setTimestamp()
        .setFooter({
          text: "Leaderboard",
          iconURL: interaction.client.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (leaderboardData.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle("📊 Leaderboard")
        .setColor(0x0099ff)
        .setDescription(
          "📊 No data available for this leaderboard yet!\n\nStart sharing your daily Connections results to see rankings here.",
        )
        .setTimestamp()
        .setFooter({
          text: "Leaderboard",
          iconURL: interaction.client.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Build the embed based on the leaderboard type
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTimestamp()
      .setFooter({
        text: "Leaderboard",
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    let title, description;

    switch (type) {
      case "winrate":
        title = "📈 Win Rate Leaderboard";
        description = formatLeaderboard(leaderboardData, (player, rank) => {
          return `#${rank + 1} <@${player.userId}> - ${(player.winRate * 100).toFixed(1)}% (${player.totalGames} games)`;
        });
        break;

      case "played":
        title = "🎯 Games Played Leaderboard";
        description = formatLeaderboard(leaderboardData, (player, rank) => {
          return `#${rank + 1} <@${player.userId}> - ${player.gamesPlayed} games`;
        });
        break;

      case "winner":
        title = "🎖️ Total Wins Leaderboard";
        description = formatLeaderboard(leaderboardData, (player, rank) => {
          return `#${rank + 1} <@${player.userId}> - ${player.wins} wins`;
        });
        break;

      case "unfailing":
        title = "🏆 Unfailing Rate Leaderboard";
        description = formatLeaderboard(leaderboardData, (player, rank) => {
          return `#${rank + 1} <@${player.userId}> - ${(player.unfailingRate * 100).toFixed(1)}% (${player.unfailingGames} perfect games)`;
        });
        break;

      case "winstreaks":
        title = "🔥 Win Streaks Leaderboard";
        description = formatLeaderboard(leaderboardData, (player, rank) => {
          let streakText = `#${rank + 1} <@${player.userId}> - ${player.winStreak} (current: ${player.currentStreak})`;
          if (
            player.longestStreakEndPuzzle &&
            player.winStreak > 0 &&
            player.currentStreak < player.winStreak
          ) {
            const endDate = puzzleNumberToDate(player.longestStreakEndPuzzle);
            streakText += ` (ended: ${endDate})`;
          }
          return streakText;
        });
        break;

      default:
        throw new Error(`Unknown leaderboard type: ${type}`);
    }

    embed.setTitle(title);
    embed.setDescription(description);

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    error(
      `Error displaying leaderboard: ${err}`,
      interaction.guild?.name || "Unknown",
    );

    const embed = new EmbedBuilder()
      .setTitle("📊 Leaderboard")
      .setColor(0xff0000)
      .setDescription(
        "❌ An error occurred while retrieving the leaderboard. Please try again later.",
      )
      .setTimestamp()
      .setFooter({
        text: "Leaderboard",
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    await interaction.reply({ embeds: [embed] });
  }
}

function formatLeaderboard(data, formatter) {
  return (
    data.map((item, index) => formatter(item, index)).join("\n") ||
    "No data available"
  );
}
