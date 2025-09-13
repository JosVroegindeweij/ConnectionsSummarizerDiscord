// Helper function to convert puzzle number to date
export const puzzleNumberToDate = (puzzleNumber) => {
  // Connections started on June 12, 2023 with puzzle #1
  const startDate = new Date(2023, 5, 12); // Month is 0-indexed
  const targetDate = new Date(startDate);
  targetDate.setDate(startDate.getDate() + (puzzleNumber - 1));

  return targetDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};
