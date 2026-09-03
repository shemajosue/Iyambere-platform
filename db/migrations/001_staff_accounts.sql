-- Staff account management.
--
-- Adds the flag the admin portal needs to retire someone's access without
-- deleting them: reports they filed and repairs they closed must stay attached
-- to a real person, so accounts are deactivated, never removed.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- The dispatch picker and the sign-in check both filter on this.
CREATE INDEX IF NOT EXISTS users_active_role_idx ON users (role, is_active);
