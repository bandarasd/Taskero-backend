-- Drop trigger and function
DROP TRIGGER IF EXISTS update_verifications_updated_at ON verifications;
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_verifications_created_at;
DROP INDEX IF EXISTS idx_verifications_document_type;
DROP INDEX IF EXISTS idx_verifications_status;
DROP INDEX IF EXISTS idx_verifications_user_id;

-- Drop verifications table
DROP TABLE IF EXISTS verifications;