-- Apply once to a PostgreSQL database containing the pre-multi-user schema.
-- Existing records are assigned to a reserved non-UUID demo owner. Supabase
-- Auth subjects are UUIDs, so this tenant cannot be selected by a real login.
BEGIN;

INSERT INTO users (id, name, email)
VALUES ('legacy-demo', 'DarkConnector Legacy Demo', 'legacy-demo@darkconnector.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_settings (user_id)
VALUES ('legacy-demo')
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

ALTER TABLE reports ADD COLUMN user_id varchar;
ALTER TABLE site_scores ADD COLUMN user_id varchar;
ALTER TABLE alerts ADD COLUMN user_id varchar;

UPDATE reports SET user_id = 'legacy-demo';
UPDATE site_scores SET user_id = 'legacy-demo';
UPDATE alerts SET user_id = 'legacy-demo';

ALTER TABLE reports ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE site_scores ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE alerts ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE reports
    ADD CONSTRAINT reports_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE site_scores
    ADD CONSTRAINT site_scores_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE alerts
    ADD CONSTRAINT alerts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE site_scores DROP CONSTRAINT site_scores_pkey;
ALTER TABLE site_scores ADD CONSTRAINT site_scores_pkey PRIMARY KEY (user_id, domain);

CREATE INDEX reports_user_id_idx ON reports (user_id);
CREATE INDEX alerts_user_id_idx ON alerts (user_id);

COMMIT;
