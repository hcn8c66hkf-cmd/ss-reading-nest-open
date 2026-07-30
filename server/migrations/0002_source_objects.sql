CREATE TABLE IF NOT EXISTS source_objects (
  object_key TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data_base64 TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL,
  metadata_json TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (object_key, chunk_index)
);

CREATE INDEX IF NOT EXISTS source_objects_key_index
  ON source_objects (object_key);
