import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { info, error } from "../../utils/logger.js";
import { getGlobalStats } from "../../utils/databaseHandler.js";

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

const medals = ["🥇", "🥈", "🥉"];

async function displayGlobalStats(interaction) {
  try {
    const stats = await getGlobalStats(interaction.guild);

    if (!stats) {
      const embed = new EmbedBuilder()
        .setTitle("📊 Global Statistics")
        .setColor(0xff0000)
        .setDescription(
          "❌ Error retrieving global statistics. Please try again later.",
        )
        .setTimestamp()
        .setFooter({
          text: "Global Statistics",
          iconURL: interaction.client.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("📊 Global Statistics")
      .setColor(0x0099ff)
      .setTimestamp()
      .setFooter({
        text: "Global Statistics",
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
    let description = `**📈 Server-wide Connections Statistics**\n\n`;
    description += `🎯 **Total Results Shared:** ${stats.totalResults}\n`;
    description += `👥 **Unique Players:** ${stats.uniquePlayers}`;

    embed.setDescription(description);

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

    if (stats.topActivePlayers && stats.topActivePlayers.length > 0) {
      embed.addFields({
        name: "🏆 Most Active Players",
        value: formatRankingList(
          stats.topActivePlayers,
          (player) => `<@${player.userId}> - ${player.count} results`,
        ),
        inline: true,
      });
    }

    if (stats.topWinRates && stats.topWinRates.length > 0) {
      embed.addFields({
        name: "📈 Best Win Rates",
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
        name: "📉 Worst Win Rates",
        value: formatRankingList(
          stats.worstWinRates,
          (player) =>
            `<@${player.userId}> - ${(player.winRate * 100).toFixed(1)}%`,
        ),
        inline: true,
      });
    }

    // Add invisible field for spacing (creates a new row)
    embed.addFields({ name: "\u200B", value: "\u200B", inline: false });

    if (stats.topWinners && stats.topWinners.length > 0) {
      embed.addFields({
        name: "🎖️ Top Winners",
        value: formatRankingList(
          stats.topWinners,
          (player) => `<@${player.userId}> - ${player.wins} wins`,
        ),
        inline: true,
      });
    }

    if (stats.topWinStreaks && stats.topWinStreaks.length > 0) {
      embed.addFields({
        name: "🔥 Longest Win Streaks",
        value: formatRankingList(
          stats.topWinStreaks,
          (player) => `<@${player.userId}> - ${player.winStreak} streak`,
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
  const embed = new EmbedBuilder()
    .setTitle(`📊 User Statistics for ${targetUser.displayName}`)
    .setColor(0x0099ff)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .setDescription("User-specific stats will be implemented here.")
    .setTimestamp()
    .setFooter({
      text: "User Statistics",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

  await interaction.reply({ embeds: [embed] });
}
