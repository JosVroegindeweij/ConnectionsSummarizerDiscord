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

  const [resultId] = await knex("connectionsresult")
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
        cellRecord = await knex("connectionscelldef")
          .where({ row: rowIndex, col: colIndex, color })
          .first();

        if (cellRecord) {
          connectionsCellDefCache.set(cacheKey, cellRecord);
        }
      }

      if (!cellRecord) {
        // Insert new canonical cell
        const [cellId] = await knex("connectionscelldef")
          .insert({ row: rowIndex, col: colIndex, color })
          .onConflict(["row", "col", "color"])
          .ignore()
          .returning("id");
        if (cellId) {
          cellRecord = { id: cellId };
        } else {
          cellRecord = await knex("connectionscelldef")
            .where({ row: rowIndex, col: colIndex, color })
            .first();
        }
        connectionsCellDefCache.set(cacheKey, cellRecord);
      }

      // Link the cell to the result
      await knex("connectionsresultcell").insert({
        result_id: resultId,
        cell_id: cellRecord.id,
      });
    }
  }
};
