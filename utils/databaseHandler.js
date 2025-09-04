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

  const [resultIdObj] = await knex("connectionsresult")
    .insert({
      guild_id: guild.id,
      channel_id: channel.id,
      user_id: user.id,
      timestamp,
      puzzle_number: puzzleNumber,
    })
    .returning("id");
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

      console.log(resultId, cellId);
      // Link the cell to the result
      await knex("connectionsresultcell").insert({
        result_id: resultId,
        cell_id: cellId,
      });
    }
  }
};
