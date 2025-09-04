import { info, error } from "./logger.js";
import knexConstructor from "knex";
import config from "../secrets/config.json" with { type: "json" };

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
