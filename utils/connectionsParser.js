const colors = {
  "🟩": 0,
  "🟨": 1,
  "🟦": 2,
  "🟪": 3,
};

/**
 * Parses a message content to check if it contains a valid connections result
 * @param {string} messageContent - The content of the message to parse
 * @returns {Object} - Object containing { isResult: boolean, puzzleNumber: number, result: Array }
 */
export const parseConnectionsResult = (messageContent) => {
  if (!messageContent)
    return { isResult: false, puzzleNumber: null, result: [] };

  const lines = messageContent.split("\n");
  let rowCount = 0;
  let puzzleNumber;
  const result = [];

  for (const line of lines) {
    if (line.startsWith("Puzzle #")) {
      const match = line.match(/Puzzle #(\d+)/);
      if (match) {
        puzzleNumber = parseInt(match[1], 10);
      }
    }

    const cleanLine = line.replace(/\s+/g, "");
    if (/[🟩🟨🟦🟪]{8}/.test(cleanLine)) {
      result.push(Array.from(cleanLine).map((char) => colors[char]));
      rowCount++;
    }
  }

  return { isResult: rowCount >= 4 && rowCount <= 7, puzzleNumber, result };
};
