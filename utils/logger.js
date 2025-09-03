import { mkdir, createWriteStream } from "fs";

import { timestamp } from "./utils.js";

let infoStream = createWriteStream("logs/info.txt", { flags: "a" });
let errorStream = createWriteStream("logs/error.txt", { flags: "a" });

const info = (message, guild) => {
  infoStream.write(`${timestamp()} [${guild?.name || guild}] ${message}\n`);
};

const error = (message, guild) => {
  errorStream.write(`${timestamp()} [${guild?.name || guild}] ${message}\n`);
};

mkdir("./logs", (err) => {
  if (err?.code !== "EEXIST") {
    error(err, "MAIN");
  }
});

export { info, error };
