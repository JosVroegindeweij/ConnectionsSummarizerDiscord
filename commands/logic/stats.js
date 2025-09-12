import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { info, error } from "../../utils/logger.js";
import { getGlobalStats, getUserStats } from "../../utils/databaseHandler.js";

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("Display statistics")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("Get stats for a specific user")
      .setRequired(false),
  );

export async function execute(interaction) {
  const targetUser = interaction.options.getUser("user");

  info(
    `Stats command invoked by ${interaction.user.tag} in guild ${interaction.guild.name}${
      targetUser ? ` for user ${targetUser.tag}` : ""
    }`,
  );

  if (targetUser) {
    // User-specific stats
    await displayUserStats(interaction, targetUser);
  } else {
    // Global stats
    await displayGlobalStats(interaction);
  }
}

async function displayGlobalStats(interaction) {
  try {
    const stats = await getGlobalStats(interaction.guild);

    if (!stats) {
      const embed = new EmbedBuilder()
        .setTitle("📊 Global statistics")
        .setColor(0xff0000)
        .setDescription(
          "❌ Error retrieving global statistics. Please try again later.",
        )
        .setTimestamp()
        .setFooter({
          text: "Global statistics",
          iconURL: interaction.client.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("📊 Global statistics")
      .setColor(0x0099ff)
      .setTimestamp()
      .setFooter({
        text: "Global statistics",
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    if (stats.totalResults === 0) {
      embed.setDescription(
        "📊 No Connections results have been shared in this server yet!\n\nStart sharing your daily Connections results to see statistics here.",
      );
      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Build the description with basic stats
    let description = `**📈 Server-wide Connections statistics**\n\n`;
    description += `🎯 **Total results shared:** ${stats.totalResults}\n`;
    description += `👥 **Unique players:** ${stats.uniquePlayers}`;

    embed.setDescription(description);

    if (stats.topActivePlayers && stats.topActivePlayers.length > 0) {
      embed.addFields({
        name: "🏃‍♂️ Most active players",
        value: formatRankingList(
          stats.topActivePlayers,
          (player) => `<@${player.userId}> - ${player.count} results`,
        ),
        inline: true,
      });
    }

    if (stats.topWinners && stats.topWinners.length > 0) {
      embed.addFields({
        name: "🎖️ Top winners",
        value: formatRankingList(
          stats.topWinners,
          (player) => `<@${player.userId}> - ${player.wins} wins`,
        ),
        inline: true,
      });
    }

    // Add invisible field for spacing (creates a new row)
    embed.addFields({ name: "\u200B", value: "\u200B", inline: false });

    if (stats.topWinRates && stats.topWinRates.length > 0) {
      embed.addFields({
        name: "📈 Best win rates",
        value: formatRankingList(
          stats.topWinRates,
          (player) =>
            `<@${player.userId}> - ${(player.winRate * 100).toFixed(1)}% (${player.totalGames} games)`,
        ),
        inline: true,
      });
    }

    if (stats.worstWinRates && stats.worstWinRates.length > 0) {
      embed.addFields({
        name: "📉 Worst win rates",
        value: formatRankingList(
          stats.worstWinRates,
          (player) =>
            `<@${player.userId}> - ${(player.winRate * 100).toFixed(1)}% (${player.totalGames} games)`,
        ),
        inline: true,
      });
    }

    // Add invisible field for spacing (creates a new row)
    embed.addFields({ name: "\u200B", value: "\u200B", inline: false });

    if (stats.topUnfailing && stats.topUnfailing.length > 0) {
      embed.addFields({
        name: "🏆 The unfailing",
        value: formatRankingList(
          stats.topUnfailing,
          (player) =>
            `<@${player.userId}> - ${(player.unfailingRate * 100).toFixed(1)}% (${player.unfailingGames} games)`,
        ),
        inline: true,
      });
    }

    if (stats.topWinStreaks && stats.topWinStreaks.length > 0) {
      embed.addFields({
        name: "🔥 Longest win streaks",
        value: formatRankingList(
          stats.topWinStreaks,
          (player) =>
            `<@${player.userId}> - ${player.winStreak} (cur: ${player.currentStreak})`,
        ),
        inline: true,
      });
    }

    // Add invisible field for spacing (creates a new row)
    embed.addFields({ name: "\u200B", value: "\u200B", inline: false });

    if (stats.topColorsGuessed && stats.topColorsGuessed.length > 0) {
      embed.addFields({
        name: "🧩 Easiest colors (by guess rate)",
        value: formatRankingList(
          stats.topColorsGuessed,
          (color) => `${color.color} - ${color.successRate} guessed`,
        ),
        inline: true,
      });
    }

    if (stats.topColorsDifficulty && stats.topColorsDifficulty.length > 0) {
      embed.addFields({
        name: "🧩 Easiest colors (by average position)",
        value: formatRankingList(
          stats.topColorsDifficulty,
          (color) => `${color.color} - ${color.averageScore}th guess`,
        ),
        inline: true,
      });
    }

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    error(
      `Error displaying global stats: ${err}`,
      interaction.guild?.name || "Unknown",
    );

    const embed = new EmbedBuilder()
      .setTitle("📊 Global Statistics")
      .setColor(0xff0000)
      .setDescription(
        "❌ An error occurred while retrieving statistics. Please try again later.",
      )
      .setTimestamp()
      .setFooter({
        text: "Global Statistics",
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    await interaction.reply({ embeds: [embed] });
  }
}

async function displayUserStats(interaction, targetUser) {
  try {
    const stats = await getUserStats(interaction.guild, targetUser.id);

    if (!stats) {
      const embed = new EmbedBuilder()
        .setTitle(`📊 User Statistics for ${targetUser.displayName}`)
        .setColor(0xff0000)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setDescription(
          "❌ No Connections results found for this user in this server.",
        )
        .setTimestamp()
        .setFooter({
          text: "User Statistics",
          iconURL: interaction.client.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📊 User Statistics for ${targetUser.displayName}`)
      .setColor(0x0099ff)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp()
      .setFooter({
        text: "User Statistics",
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    // Build the description with basic stats
    let description = `**Results shared by <@${targetUser.id}>: ${stats.totalResults} results**\n\n`;
    embed.setDescription(description);

    // Helper function to format ranking position with neighbors
    const formatRankingPosition = (rankingData, valueFormatter) => {
      if (!rankingData) return "No data available";

      const { userRank, user, previous, next } = rankingData;
      let result = `**#${userRank}** ${valueFormatter(user)}\n`;

      if (previous) {
        result = `#${userRank - 1} ${valueFormatter(previous)}\n` + result;
      }

      if (next) {
        result += `#${userRank + 1} ${valueFormatter(next)}`;
      }

      return result;
    };

    // Activity ranking
    if (stats.activityRanking) {
      embed.addFields({
        name: "🏃‍♂️ Activity",
        value: formatRankingPosition(
          stats.activityRanking,
          (player) => `<@${player.userId}> - ${player.gamesPlayed} games`,
        ),
        inline: true,
      });
    }

    // Winner ranking
    if (stats.winnerRanking) {
      embed.addFields({
        name: "🎖️ Winner",
        value: formatRankingPosition(
          stats.winnerRanking,
          (player) => `<@${player.userId}> - ${player.wins} wins`,
        ),
        inline: true,
      });
    }

    // Add invisible field for spacing (creates a new row)
    embed.addFields({ name: "\u200B", value: "\u200B", inline: false });

    // Win rate ranking
    if (stats.winRateRanking) {
      embed.addFields({
        name: "📈 Winrate",
        value: formatRankingPosition(
          stats.winRateRanking,
          (player) =>
            `<@${player.userId}> - ${(player.winRate * 100).toFixed(1)}% (${player.totalGames} games)`,
        ),
        inline: true,
      });
    }

    // Unfailing ranking
    if (stats.unfailingRanking) {
      embed.addFields({
        name: "🏆 Unfailing",
        value: formatRankingPosition(
          stats.unfailingRanking,
          (player) =>
            `<@${player.userId}> - ${(player.unfailingRate * 100).toFixed(1)}% (${player.unfailingGames} games)`,
        ),
        inline: true,
      });
    }

    // Add invisible field for spacing (creates a new row)
    embed.addFields({ name: "\u200B", value: "\u200B", inline: false });

    // Streaker ranking (2 columns wide)
    if (stats.streakRanking) {
      embed.addFields({
        name: "🔥 Streaker",
        value: formatRankingPosition(
          stats.streakRanking,
          (player) =>
            `<@${player.userId}> - ${player.winStreak} (cur: ${player.currentStreak})`,
        ),
        inline: false, // Full width
      });
    }

    // Add invisible field for spacing (creates a new row)
    embed.addFields({ name: "\u200B", value: "\u200B", inline: false });

    // Color stats
    if (stats.colorStats) {
      // Easiest colors by guess rate
      if (
        stats.colorStats.byGuessRate &&
        stats.colorStats.byGuessRate.length > 0
      ) {
        embed.addFields({
          name: "🧩 Easiest colors (by guess rate)",
          value: formatRankingList(
            stats.colorStats.byGuessRate,
            (color) => `${color.color} - ${color.successRate} guessed`,
          ),
          inline: true,
        });
      }

      // Easiest colors by average position
      if (
        stats.colorStats.byAvgPosition &&
        stats.colorStats.byAvgPosition.length > 0
      ) {
        embed.addFields({
          name: "🧩 Easiest colors (by average position)",
          value: formatRankingList(
            stats.colorStats.byAvgPosition,
            (color) => `${color.color} - ${color.averageScore}th guess`,
          ),
          inline: true,
        });
      }
    }

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    error(
      `Error displaying user stats: ${err}`,
      interaction.guild?.name || "Unknown",
    );

    const embed = new EmbedBuilder()
      .setTitle(`📊 User Statistics for ${targetUser.displayName}`)
      .setColor(0xff0000)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setDescription(
        "❌ An error occurred while retrieving user statistics. Please try again later.",
      )
      .setTimestamp()
      .setFooter({
        text: "User Statistics",
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    await interaction.reply({ embeds: [embed] });
  }
}

const medals = ["🥇", "🥈", "🥉", "🏅"];

// Helper function to format ranking list
const formatRankingList = (
  items,
  formatter = (item) => `<@${item.userId || item}>`,
) => {
  return (
    items
      .map((item, index) => `${medals[index]} ${formatter(item)}`)
      .join("\n") || "No data available"
  );
};
