CREATE TABLE IF NOT EXISTS application_children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  age_band TEXT NOT NULL,
  gender TEXT NOT NULL,
  interests TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS application_children_application_id_idx
  ON application_children(application_id);

INSERT INTO application_children (application_id, age_band, gender, interests)
SELECT id, age_band, gender, interests
FROM applications
WHERE NOT EXISTS (
  SELECT 1 FROM application_children WHERE application_id = applications.id
);
