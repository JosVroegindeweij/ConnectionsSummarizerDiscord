import { Collection } from "discord.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readdirSync } from "fs";
import { error } from "./logger.js";

export const initCommands = async (client) => {
  client.commands = new Collection();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const foldersPath = join(__dirname, "../commands");
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
        client.commands.set(command.data.name, command);
      } else {
        error(
          `The command at ${filePath} is missing a required "data" or "execute" property.`,
          "main",
        );
      }
    }
  }
};
