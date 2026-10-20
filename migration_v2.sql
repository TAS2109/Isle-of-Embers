-- すでに schema.sql を実行済みの場合のみ、これを実行
ALTER TABLE ranks ADD COLUMN daily TEXT;
CREATE INDEX IF NOT EXISTS i_daily ON ranks(daily,assets DESC);
