DROP TABLE IF EXISTS summarizer.ConnectionsResult CASCADE;
DROP TABLE IF EXISTS summarizer.ConnectionsCellDef CASCADE;
DROP TABLE IF EXISTS summarizer.ConnectionsResultCell CASCADE;

CREATE TABLE ConnectionsResult (
    id serial PRIMARY KEY,
    guild_id varchar(90) NOT NULL,
    channel_id varchar(90) NOT NULL,
    user_id varchar(90) NOT NULL,
    puzzle_number int,
    timestamp bigint NOT NULL
);

CREATE TABLE ConnectionsCellDef (
    id serial PRIMARY KEY,
    row int NOT NULL,
    col int NOT NULL,
    color int NOT NULL,
    UNIQUE (row, col, color)
);

CREATE TABLE ConnectionsResultCell (
    result_id int NOT NULL REFERENCES ConnectionsResult(id) ON DELETE CASCADE,
    cell_id int NOT NULL REFERENCES ConnectionsCellDef(id) ON DELETE CASCADE,
    PRIMARY KEY (result_id, cell_id)
);

CREATE INDEX idx_ConnectionsCellDef_rowcol ON ConnectionsCellDef(row, col);
CREATE INDEX idx_ConnectionsCellDef_color ON ConnectionsCellDef(color);
CREATE INDEX idx_ConnectionsResult_user ON ConnectionsResult(user_id);
CREATE INDEX idx_ConnectionsResult_puzzle ON ConnectionsResult(puzzle_number); 
