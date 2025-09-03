import { REST, Routes } from "discord.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

import config from "./secrets/config.json" with { type: "json" };
import { info, error } from "./utils/logger.js";

import { readdirSync } from "node:fs";
import { join } from "node:path";

const commands = [];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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
    const command = await import(filePath);

    if ("data" in command && "execute" in command) {
      commands.push(command.data.toJSON());
    } else {
      error(
        `The command at ${filePath} is missing a required "data" or "execute" property.`,
        "main",
      );
    }
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(config.token);

// and deploy your commands!
(async () => {
  try {
    info(
      `Started refreshing ${commands.length} application (/) commands.`,
      "main",
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationGuildCommands(config.client_id, config.guild_id),
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
