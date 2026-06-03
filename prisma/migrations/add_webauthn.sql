ALTER TABLE hr_staff ADD COLUMN credential_id TEXT;
ALTER TABLE hr_staff ADD COLUMN credential_public_key TEXT;
ALTER TABLE hr_staff ADD COLUMN credential_counter INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hr_staff ADD COLUMN pending_challenge TEXT;
