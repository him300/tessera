-- The record, on the server, appended only.
--
-- The primary key is the same dedupe hash the client already computes
-- (dimension | instant | ordinal), so a POST that is retried after a dropped
-- connection cannot write a second row. The database enforces the invariant the
-- audit used to only report.
create table if not exists entries (
  row_key  text primary key,
  dim      text not null,
  at       text not null,
  ordinal  integer not null default 0,
  origin   text not null default 'user',
  minutes  integer,
  fields   text not null default '{}',
  device   text,
  created  text not null
);

create index if not exists entries_at on entries (at);
create index if not exists entries_dim on entries (dim, at);

-- Highlights are rows too, not a column: the four data tabs keep their columns,
-- exactly as they do in the workbook.
create table if not exists tags (
  row_key  text not null,
  kind     text not null,
  dim      text not null,
  at       text not null,
  note     text not null default '',
  created  text not null,
  primary key (row_key, kind)
);
