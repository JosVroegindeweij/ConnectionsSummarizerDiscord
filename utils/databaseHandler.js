import { info, error } from "./logger.js";
import knexConstructor from "knex";
import config from "../secrets/config.json" with { type: "json" };
import _ from "lodash";

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
          (result) =>
            result.length < 7 ||
            result[6].some((cell) => cell.color !== result[6][0].color),
        ),
    );
    const topWinners = getTopWinners(winsPerPuzzlePerUser);
    const topWinRates = getTopWinRates(winsPerPuzzlePerUser);
    const topWinStreaks = getTopWinStreaks(winsPerPuzzlePerUser);
    const worstWinRates = getWorstWinRates(winsPerPuzzlePerUser);
    const topWinRatesMinGames = getTopWinRatesMinGames(winsPerPuzzlePerUser, 10);

    return {
      totalResults: totalResults?.count,
      uniquePlayers: uniquePlayers?.count,
      topActivePlayers,
      topWinners,
      topWinRates,
      topWinStreaks,
      worstWinRates,
      topWinRatesMinGames,
    };
  } catch (err) {
    error(`Error getting global stats: ${err}`, guild.name);
    return null;
  }
};

const getTopWinners = (winsByPuzzle) => {
  return _(winsByPuzzle)
    .mapValues((byPuzzle) => _.filter(byPuzzle, Boolean).length)
    .toPairs()
    .orderBy([1], ["desc"])
    .take(3)
    .map(([userId, wins]) => ({ userId, wins }))
    .value();
};

const getTopWinRates = (winsByPuzzle) => {
  return _(winsByPuzzle)
    .mapValues((byPuzzle) => {
      const values = _.values(byPuzzle);
      return _.filter(values, Boolean).length / values.length;
    })
    .toPairs()
    .orderBy([1], ["desc"])
    .take(3)
    .map(([userId, winRate]) => ({ userId, winRate }))
    .value();
};

const getTopWinStreaks = (winsByPuzzle) => {
  const winStreaks = _.mapValues(winsByPuzzle, getLongestWinStreak);
  return _(winStreaks)
    .toPairs()
    .orderBy([1], ["desc"])
    .take(3)
    .map(([userId, winStreak]) => ({ userId, winStreak }))
    .value();
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
        acc.longestStreak = Math.max(acc.longestStreak, acc.currentStreak);
      } else {
        acc.currentStreak = 0;
      }
      return acc;
    },
    { longestStreak: 0, currentStreak: 0 },
  ).longestStreak;
};

const getWorstWinRates = (winsByPuzzle) => {
  return _(winsByPuzzle)
    .mapValues((byPuzzle) => {
      const values = _.values(byPuzzle);
      return _.filter(values, Boolean).length / values.length;
    })
    .toPairs()
    .orderBy([1], ["asc"]) // ascending order for worst rates
    .take(3)
    .map(([userId, winRate]) => ({ userId, winRate }))
    .value();
};

const getTopWinRatesMinGames = (winsByPuzzle, minGames = 10) => {
  return _(winsByPuzzle)
    .mapValues((byPuzzle) => {
      const values = _.values(byPuzzle);
      const totalGames = values.length;
      const winRate = _.filter(values, Boolean).length / totalGames;
      return { winRate, totalGames };
    })
    .toPairs()
    .filter(([userId, stats]) => stats.totalGames >= minGames)
    .orderBy([1, 'winRate'], ["desc"])
    .take(3)
    .map(([userId, stats]) => ({ userId, winRate: stats.winRate, totalGames: stats.totalGames }))
    .value();
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
