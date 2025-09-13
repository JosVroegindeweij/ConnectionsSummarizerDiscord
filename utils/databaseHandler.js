import { info, error } from "./logger.js";
import knexConstructor from "knex";
import config from "../secrets/config.json" with { type: "json" };
import _ from "lodash";
import { colors } from "./connectionsParser.js";

const knex = knexConstructor({
  client: "pg",
  connection: {
    host: config.db_host,
    user: config.db_username,
    password: config.db_password,
    database: config.db_name,
  },
  debug: false,
  asyncStackTraces: true,
});

const connectionsCellDefCache = new Map();

export const setLastGatheredMessageId = async (guild, channel, messageId) => {
  await knex("gatherstate")
    .insert({
      guild_id: guild.id,
      channel_id: channel.id,
      last_message_id: messageId,
      timestamp: Date.now(),
    })
    .onConflict(["channel_id"])
    .merge();
};

export const addResult = async (
  guild,
  channel,
  user,
  timestamp,
  puzzleNumber,
  result,
) => {
  info(
    `Adding result for user ${user.displayName} and puzzle ${puzzleNumber}`,
    guild.name,
  );

  const [resultIdObj] = await knex("connectionsresult")
    .insert({
      guild_id: guild.id,
      channel_id: channel.id,
      user_id: user.id,
      timestamp,
      puzzle_number: puzzleNumber,
    })
    .onConflict(["user_id", "puzzle_number"])
    .ignore()
    .returning("id");
  if (!resultIdObj) {
    info(
      `Result for user ${user.displayName} and puzzle ${puzzleNumber} already exists, skipping.`,
      guild.name,
    );
    return;
  }
  const resultId = resultIdObj.id;

  for (let rowIndex = 0; rowIndex < result.length; rowIndex++) {
    const row = result[rowIndex];
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const color = row[colIndex];

      const cacheKey = `${rowIndex}-${colIndex}-${color}`;
      let cellId = connectionsCellDefCache.get(cacheKey);

      if (!cellId) {
        const existingCell = await knex("connectionscelldef")
          .where({ row: rowIndex, col: colIndex, color })
          .first("id");
        cellId = existingCell?.id;

        if (cellId) {
          connectionsCellDefCache.set(cacheKey, cellId);
        }
      }

      if (!cellId) {
        const [cellIdObj] = await knex("connectionscelldef")
          .insert({ row: rowIndex, col: colIndex, color })
          .onConflict(["row", "col", "color"])
          .ignore()
          .returning("id");

        if (cellIdObj) {
          cellId = cellIdObj.id;
        } else {
          const existingCell = await knex("connectionscelldef")
            .where({ row: rowIndex, col: colIndex, color })
            .first("id");
          cellId = existingCell?.id;
        }
        connectionsCellDefCache.set(cacheKey, cellId);
      }

      // Link the cell to the result
      await knex("connectionsresultcell").insert({
        result_id: resultId,
        cell_id: cellId,
      });
    }
  }
};

export const addMonitoredChannel = async (guild, channel) => {
  try {
    await knex("monitoredchannels")
      .insert({
        guild_id: guild.id,
        channel_id: channel.id,
        created_at: Date.now(),
      })
      .onConflict(["channel_id"])
      .ignore();
  } catch (err) {
    error(`Error adding monitored channel: ${err}`, guild.name);
    throw err;
  }
};

export const removeMonitoredChannel = async (guild, channel) => {
  try {
    await knex("monitoredchannels")
      .where({
        guild_id: guild.id,
        channel_id: channel.id,
      })
      .del();
  } catch (err) {
    error(`Error removing monitored channel: ${err}`, guild.name);
    throw err;
  }
};

export const getMonitoredChannels = async (guild) => {
  try {
    return await knex("monitoredchannels")
      .where({ guild_id: guild.id })
      .select("channel_id");
  } catch (err) {
    error(`Error getting monitored channels: ${err}`, guild.name);
    throw err;
  }
};

export const isChannelMonitored = async (guild, channel) => {
  try {
    const result = await knex("monitoredchannels")
      .where({
        guild_id: guild.id,
        channel_id: channel.id,
      })
      .first();
    return !!result;
  } catch (err) {
    error(`Error checking if channel is monitored: ${err}`, guild.name);
    return false; // Fail safely - don't monitor if we can't check
  }
};

// Stats query functions
export const getUserStats = async (guild, userId) => {
  try {
    info(`Getting user stats for user ${userId} in guild ${guild.name}`);

    // Total connection results shared by this user
    const totalResults = await knex("connectionsresult")
      .where("guild_id", guild.id)
      .where("user_id", userId)
      .count("* as count")
      .first();

    if (!totalResults?.count || totalResults.count === 0) {
      return null; // User has no results
    }

    const resultsPerPuzzlePerUser = await getAllResults(guild);
    const userResults = resultsPerPuzzlePerUser[userId] || {};

    const winsPerPuzzlePerUser = _.mapValues(
      resultsPerPuzzlePerUser,
      (resultByPuzzle) =>
        _.mapValues(
          resultByPuzzle,
          (result) => _.uniq(result[result.length - 1]).length === 1,
        ),
    );

    // Get all rankings to find user's position
    const allWinners = getAllWinners(winsPerPuzzlePerUser);
    const allWinRates = getAllWinRates(winsPerPuzzlePerUser);
    const allWinStreaks = getAllWinStreaks(winsPerPuzzlePerUser);
    const allUnfailing = getAllUnfailing(resultsPerPuzzlePerUser);
    const allActivePlayers = _(resultsPerPuzzlePerUser)
      .mapValues((byPuzzle) => _.values(byPuzzle).length)
      .toPairs()
      .orderBy([1], ["desc"])
      .map(([userId, gamesPlayed]) => ({ userId, gamesPlayed }))
      .value();

    // Find user's rank and adjacent players for each category
    const getUserRankingWithNeighbors = (rankings, userIdField = "userId") => {
      const userIndex = rankings.findIndex(
        (item) => item[userIdField] === userId,
      );
      if (userIndex === -1) return null;

      return {
        userRank: userIndex + 1,
        user: rankings[userIndex],
        previous: userIndex > 0 ? rankings[userIndex - 1] : null,
        next: userIndex < rankings.length - 1 ? rankings[userIndex + 1] : null,
      };
    };

    const activityRanking = getUserRankingWithNeighbors(allActivePlayers);
    const winnerRanking = getUserRankingWithNeighbors(allWinners);
    const winRateRanking = getUserRankingWithNeighbors(allWinRates);
    const unfailingRanking = getUserRankingWithNeighbors(allUnfailing);
    const streakRanking = getUserRankingWithNeighbors(allWinStreaks);

    // Calculate color stats for this user only
    const userColorStats = getUserColorStats(userResults);

    return {
      totalResults: parseInt(totalResults.count),
      activityRanking,
      winnerRanking,
      winRateRanking,
      unfailingRanking,
      streakRanking,
      colorStats: userColorStats,
    };
  } catch (err) {
    error(`Error getting user stats: ${err}`, guild.name);
    return null;
  }
};

export const getGlobalStats = async (guild) => {
  try {
    info(`Getting global stats for guild ${guild.name}`);

    // Total connection results shared
    const totalResults = await knex("connectionsresult")
      .where("guild_id", guild.id)
      .count("* as count")
      .first();

    // Total different players that shared a result
    const uniquePlayers = await knex("connectionsresult")
      .where("guild_id", guild.id)
      .countDistinct("user_id as count")
      .first();

    // Player with the most results shared
    const mostActivePlayers = await knex("connectionsresult")
      .where("guild_id", guild.id)
      .select("user_id")
      .count("* as count")
      .groupBy("user_id")
      .orderBy("count", "desc")
      .limit(3);

    const resultsPerPuzzlePerUser = await getAllResults(guild);

    const topActivePlayers = _.map(mostActivePlayers, (p) => ({
      userId: p.user_id,
      count: parseInt(p.count),
    }));

    const winsPerPuzzlePerUser = _.mapValues(
      resultsPerPuzzlePerUser,
      (resultByPuzzle) =>
        _.mapValues(
          resultByPuzzle,
          (result) => _.uniq(result[result.length - 1]).length === 1,
        ),
    );
    const topWinners = getTopWinners(winsPerPuzzlePerUser);
    const topWinRates = getTopWinRates(winsPerPuzzlePerUser);
    const topWinStreaks = getTopWinStreaks(winsPerPuzzlePerUser);
    const worstWinRates = getWorstWinRates(winsPerPuzzlePerUser);
    const topUnfailing = getTopUnfailing(resultsPerPuzzlePerUser);
    const topColors = getTopColors(resultsPerPuzzlePerUser);
    const topColorsGuessed = topColors.sort(
      (a, b) => a.successRate - b.successRate,
    );
    const topColorsDifficulty = topColors.sort(
      (a, b) => a.averageScore - b.averageScore,
    );

    return {
      totalResults: totalResults?.count,
      uniquePlayers: uniquePlayers?.count,
      topActivePlayers,
      topWinners,
      topWinRates,
      topWinStreaks,
      worstWinRates,
      topUnfailing,
      topColorsGuessed,
      topColorsDifficulty,
    };
  } catch (err) {
    error(`Error getting global stats: ${err}`, guild.name);
    return null;
  }
};

export const getLeaderboard = async (guild, type) => {
  try {
    info(`Getting leaderboard for type ${type} in guild ${guild.name}`);

    const resultsPerPuzzlePerUser = await getAllResults(guild);

    const winsPerPuzzlePerUser = _.mapValues(
      resultsPerPuzzlePerUser,
      (resultByPuzzle) =>
        _.mapValues(
          resultByPuzzle,
          (result) => _.uniq(result[result.length - 1]).length === 1,
        ),
    );

    switch (type) {
      case "winrate":
        return getAllWinRates(winsPerPuzzlePerUser);

      case "played":
        // Calculate total games played by each user
        return _(resultsPerPuzzlePerUser)
          .mapValues((byPuzzle) => _.values(byPuzzle).length)
          .toPairs()
          .orderBy([1], ["desc"])
          .map(([userId, gamesPlayed]) => ({ userId, gamesPlayed }))
          .value();

      case "winner":
        return getAllWinners(winsPerPuzzlePerUser);

      case "unfailing":
        return getAllUnfailing(resultsPerPuzzlePerUser);

      case "winstreaks":
        return getAllWinStreaks(winsPerPuzzlePerUser);

      default:
        throw new Error(`Unknown leaderboard type: ${type}`);
    }
  } catch (err) {
    error(`Error getting leaderboard: ${err}`, guild.name);
    return null;
  }
};

const getAllWinners = (winsByPuzzle) => {
  return _(winsByPuzzle)
    .mapValues((byPuzzle) => _.filter(byPuzzle, Boolean).length)
    .toPairs()
    .orderBy([1], ["desc"])
    .map(([userId, wins]) => ({ userId, wins }))
    .value();
};

const getTopWinners = (winsByPuzzle) => {
  return getAllWinners(winsByPuzzle).slice(0, 3);
};

const getAllWinRates = (winsByPuzzle) => {
  return _(winsByPuzzle)
    .mapValues((byPuzzle) => {
      const values = _.values(byPuzzle);
      const totalGames = values.length;
      return {
        totalGames,
        winRate: _.filter(values, Boolean).length / totalGames,
      };
    })
    .toPairs()
    .filter(([, stats]) => stats.totalGames >= 10)
    .orderBy(([, stats]) => stats.winRate, ["desc"])
    .map(([userId, stats]) => ({
      userId,
      winRate: stats.winRate,
      totalGames: stats.totalGames,
    }))
    .value();
};

const getTopWinRates = (winsByPuzzle) => {
  return getAllWinRates(winsByPuzzle).slice(0, 3);
};

const getWorstWinRates = (winsByPuzzle) => {
  return _.reverse(getAllWinRates(winsByPuzzle).slice(-3));
};

const getAllWinStreaks = (winsByPuzzle) => {
  const winStreaks = _.mapValues(winsByPuzzle, getLongestWinStreak);
  return _(winStreaks)
    .toPairs()
    .orderBy(([, streakData]) => streakData.longestStreak, ["desc"])
    .map(([userId, streakData]) => ({
      userId,
      winStreak: streakData.longestStreak,
      currentStreak: streakData.currentStreak,
      longestStreakEndPuzzle: streakData.longestStreakEndPuzzle,
    }))
    .value();
};

const getTopWinStreaks = (winsByPuzzle) => {
  return getAllWinStreaks(winsByPuzzle).slice(0, 3);
};

const getLongestWinStreak = (puzzles) => {
  const puzzleNumbers = _(puzzles)
    .keys()
    .map((n) => parseInt(n, 10))
    .sortBy()
    .value();

  return _.reduce(
    puzzleNumbers,
    (acc, puzzleNum) => {
      const isWin = puzzles[puzzleNum];
      if (isWin) {
        acc.currentStreak++;
        if (acc.currentStreak > acc.longestStreak) {
          acc.longestStreak = acc.currentStreak;
          // Store the puzzle number where the longest streak would end if broken
          acc.longestStreakEndPuzzle = puzzleNum;
        }
      } else {
        // If we had a streak and it just broke, update the end date
        if (acc.currentStreak > 0 && acc.currentStreak === acc.longestStreak) {
          acc.longestStreakEndPuzzle = puzzleNum;
        }
        acc.currentStreak = 0;
      }
      return acc;
    },
    { longestStreak: 0, currentStreak: 0, longestStreakEndPuzzle: null },
  );
};

const getAllUnfailing = (resultsPerPuzzlePerUser) => {
  return _(resultsPerPuzzlePerUser)
    .mapValues((byPuzzle) => {
      const values = _.values(byPuzzle);
      const totalGames = values.length;
      const unfailingGames = _.filter(
        values,
        (result) => result.length === 4 && _.uniq(result[3]).length === 1,
      ).length;
      return {
        totalGames,
        unfailingGames,
        unfailingRate: unfailingGames / totalGames,
      };
    })
    .toPairs()
    .filter(([, stats]) => stats.totalGames >= 10)
    .orderBy(([, stats]) => stats.unfailingRate, ["desc"])
    .map(([userId, stats]) => ({
      userId,
      unfailingRate: stats.unfailingRate,
      unfailingGames: stats.unfailingGames,
    }))
    .value();
};

const getTopUnfailing = (resultsPerPuzzlePerUser) => {
  return getAllUnfailing(resultsPerPuzzlePerUser).slice(0, 3);
};

const invertedColors = _.invert(colors);

const getTopColors = (resultsPerPuzzlePerUser) => {
  const colorScores = {};
  let totalGames = 0;
  const UNSOLVED_PENALTY = 8; // Score for colors never guessed correctly

  for (const byPuzzle of Object.values(resultsPerPuzzlePerUser)) {
    for (const result of Object.values(byPuzzle)) {
      totalGames++;

      // Track which colors were successfully guessed and at what position
      const solvedColors = new Map(); // color -> attempt number (1-based)

      for (let attempt = 0; attempt < result.length; attempt++) {
        const row = result[attempt];

        // Check if this row represents a successful guess (all same color)
        if (_.uniq(row).length === 1) {
          solvedColors.set(row[0], attempt + 1); // Store 1-based attempt number
        }
      }

      // For each color (0-3), assign a difficulty score for this game
      for (let color = 0; color < 4; color++) {
        if (!colorScores[color]) {
          colorScores[color] = {
            totalScore: 0,
            games: 0,
            solvedCount: 0,
          };
        }

        colorScores[color].games++;

        if (solvedColors.has(color)) {
          // Color was solved - score is the attempt number
          colorScores[color].totalScore += solvedColors.get(color);
          colorScores[color].solvedCount++;
        } else {
          // Color was never solved - apply penalty
          colorScores[color].totalScore += UNSOLVED_PENALTY;
        }
      }
    }
  }

  // Calculate average scores and convert to relative difficulty percentages
  const avgScores = Object.entries(colorScores).map(([colorNum, stats]) => ({
    color: parseInt(colorNum),
    averageScore: stats.totalScore / stats.games,
    successRate: stats.solvedCount / stats.games,
  }));

  return avgScores.map(({ color, averageScore, successRate }) => ({
    color: invertedColors[color],
    averageScore: averageScore.toFixed(2),
    successRate: (successRate * 100).toFixed(1) + "%",
  }));
};

const getUserColorStats = (userResults) => {
  const colorScores = {};
  let totalGames = 0;
  const UNSOLVED_PENALTY = 8; // Score for colors never guessed correctly

  for (const result of Object.values(userResults)) {
    totalGames++;

    // Track which colors were successfully guessed and at what position
    const solvedColors = new Map(); // color -> attempt number (1-based)

    for (let attempt = 0; attempt < result.length; attempt++) {
      const row = result[attempt];

      // Check if this row represents a successful guess (all same color)
      if (_.uniq(row).length === 1) {
        solvedColors.set(row[0], attempt + 1); // Store 1-based attempt number
      }
    }

    // For each color (0-3), assign a difficulty score for this game
    for (let color = 0; color < 4; color++) {
      if (!colorScores[color]) {
        colorScores[color] = {
          totalScore: 0,
          games: 0,
          solvedCount: 0,
        };
      }

      colorScores[color].games++;

      if (solvedColors.has(color)) {
        // Color was solved - score is the attempt number
        colorScores[color].totalScore += solvedColors.get(color);
        colorScores[color].solvedCount++;
      } else {
        // Color was never solved - apply penalty
        colorScores[color].totalScore += UNSOLVED_PENALTY;
      }
    }
  }

  // Calculate average scores and convert to relative difficulty percentages
  const avgScores = Object.entries(colorScores).map(([colorNum, stats]) => ({
    color: parseInt(colorNum),
    averageScore: stats.totalScore / stats.games,
    successRate: stats.solvedCount / stats.games,
  }));

  const colorsByGuessRate = avgScores
    .map(({ color, averageScore, successRate }) => ({
      color: invertedColors[color],
      averageScore: averageScore.toFixed(2),
      successRate: (successRate * 100).toFixed(1) + "%",
    }))
    .sort((a, b) => parseFloat(b.successRate) - parseFloat(a.successRate));

  const colorsByAvgPosition = avgScores
    .map(({ color, averageScore, successRate }) => ({
      color: invertedColors[color],
      averageScore: averageScore.toFixed(2),
      successRate: (successRate * 100).toFixed(1) + "%",
    }))
    .sort((a, b) => parseFloat(a.averageScore) - parseFloat(b.averageScore));

  return {
    byGuessRate: colorsByGuessRate,
    byAvgPosition: colorsByAvgPosition,
  };
};

const getAllResults = async (guild) => {
  try {
    // Get all results with their cell data, properly ordered
    const rawResults = await knex("connectionsresult as cr")
      .where("cr.guild_id", guild.id)
      .leftJoin("connectionsresultcell as crc", "cr.id", "crc.result_id")
      .leftJoin("connectionscelldef as ccd", "crc.cell_id", "ccd.id")
      .select(
        "cr.user_id",
        "cr.id as result_id",
        "cr.puzzle_number",
        "cr.timestamp",
        "ccd.row",
        "ccd.col",
        "ccd.color",
      )
      .orderBy(["cr.user_id", "cr.timestamp", "ccd.row", "ccd.col"]);

    return _(rawResults)
      .groupBy("user_id")
      .mapValues((userResults) =>
        _(userResults)
          .groupBy("puzzle_number")
          .mapValues((puzzleResults) => {
            const grid = [];
            _.forEach(puzzleResults, ({ row, col, color }) => {
              if (!grid[row]) grid[row] = new Array(4).fill(null);
              grid[row][col] = color;
            });
            return grid;
          })
          .value(),
      )
      .value();
  } catch (err) {
    error(`Error getting all results: ${err}`, guild.name);
    return {};
  }
};
