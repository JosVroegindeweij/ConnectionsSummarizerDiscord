import { info, error } from "./logger.js";
import knexConstructor from "knex";
import {
  db_host,
  db_username,
  db_password,
  db_name,
} from "../secrets/config.json" with { type: "json" };

const knex = knexConstructor({
  client: "pg",
  connection: {
    host: db_host,
    user: db_username,
    password: db_password,
    database: db_name,
  },
  debug: false,
  asyncStackTraces: true,
});

const connectionsCellDefCache = new Map();

const addResult = async (
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

  const [resultId] = await knex("ConnectionsResult")
    .insert({
      guild_id: guild.id,
      channel_id: channel.id,
      user_id: user.id,
      timestamp,
      puzzle_number: puzzleNumber,
    })
    .returning("id");

  for (let rowIndex = 0; rowIndex < result.length; rowIndex++) {
    const row = result[rowIndex];
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const color = row[colIndex];

      // Check if canonical cell exists
      const cacheKey = `${rowIndex}-${colIndex}-${color}`;
      let cellRecord = connectionsCellDefCache.get(cacheKey);

      if (!cellRecord) {
        cellRecord = await knex("ConnectionsCellDef")
          .where({ row: rowIndex, col: colIndex, color })
          .first();

        if (cellRecord) {
          connectionsCellDefCache.set(cacheKey, cellRecord);
        }
      }

      if (!cellRecord) {
        // Insert new canonical cell
        const [cellId] = await knex("ConnectionsCellDef")
          .insert({ row: rowIndex, col: colIndex, color })
          .returning("id");
        cellRecord = { id: cellId };
        connectionsCellDefCache.set(cacheKey, cellRecord);
      }

      // Link the cell to the result
      await knex("ConnectionsResultCell").insert({
        result_id: resultId,
        cell_id: cellRecord.id,
      });
    }
  }
};

export {};
