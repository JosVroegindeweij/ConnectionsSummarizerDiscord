import { REST, Routes } from "discord.js";
import {
  client_id,
  guild_id,
  token,
} from "./config.json" with { type: "json" };

import { error } from "./utils/logger.js";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const commands = [];
const foldersPath = join(__dirname, "commands");
const commandFolders = readdirSync(foldersPath);

for (const folder of commandFolders) {
  // Grab all the command files from the commands directory you created earlier
  const commandsPath = join(foldersPath, folder);
  const commandFiles = readdirSync(commandsPath).filter((file) =>
    file.endsWith(".js"),
  );
  // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      commands.push(command.data.toJSON());
    } else {
      error(
        `The command at ${filePath} is missing a required "data" or "execute" property.`,
      );
    }
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands!
(async () => {
  try {
    info(
      `Started refreshing ${commands.length} application (/) commands.`,
      "main",
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationGuildCommands(client_id, guild_id),
      { body: commands },
    );

    info(
      `Successfully reloaded ${data.length} application (/) commands.`,
      "main",
    );
  } catch (msg) {
    // And of course, make sure you catch and log any errors!
    error(msg);
  }
})();
