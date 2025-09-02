import { readdirSync } from "fs";

import { Collection } from "discord.js";

import { info, error as _error } from "./logger";

import { isAdmin } from "../commands/admin";
import { findChannelId } from "../commands/setup";

import { prefix } from "../secrets/config.json";
import { PermissionsBitField } from "discord.js";

function initCommands(client) {
  client.commands = new Collection();
  const commandFiles = readdirSync("./commands").filter((file) =>
    file.endsWith(".js"),
  );

  commandFiles.forEach((file) => {
    const command = require(`../commands/${file}`);
    client.commands.set(command.name, command);
    info(`Command ${command.name} added`, "main");
  });
}

async function onMessage(client, message) {
  if (
    !message.content.startsWith(prefix) ||
    message.author.bot ||
    !message.member
  )
    return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command =
    client.commands.get(commandName) ||
    client.commands.find(
      (cmd) => cmd.aliases && cmd.aliases.includes(commandName),
    );
  if (!command) return;

  // Admin permission check
  let isGlobalAdmin = message.member.permissions.any(
    PermissionsBitField.Flags.Administrator,
  );
  if (command.admin && !(isGlobalAdmin || (await isAdmin(message.member)))) {
    info(
      `User '${message.member.displayName}'(${message.member.id}) ` +
        `tried to use admin-only command '${message}' (in channel '${message.channel.name})'`,
      message.guild,
    );
    message
      .reply(`Only admins can use this command!`)
      .catch((reason) => _error(reason, message.guild));
    return;
  }

  // Channel permission check - can only occur after the setup command has been run,
  // so setup should be independent of this

  findChannelId(message.guild, command.channel).then((correctChannelId) => {
    let correctChannel = message.guild.channels.cache.get(correctChannelId);
    if (command.name !== "setup" && message.channel.id !== correctChannelId) {
      info(
        `User '${message.member.displayName}'(${message.member.id}) ` +
          `tried to use command '${message}' in channel '${message.channel.name}'`,
        message.guild,
      );
      message
        .reply(
          `This command cannot be used in this channel. Use channel ${correctChannel} instead`,
        )
        .catch((reason) => _error(reason, message.guild));
    } else {
      // Execute command
      try {
        info(
          `User '${message.member.displayName}'(${message.member.id}) ` +
            `used command '${message}' in channel '${message.channel.name}'`,
          message.guild,
        );
        command.execute(message, args);
      } catch (error) {
        _error(error, message.guild);
        message
          .reply(
            "There was an error executing the command. Check the logs for more info",
          )
          .catch((reason) => _error(reason, message.guild));
      }
    }
  });
}

export {
  initCommands,
  onMessage,
};
