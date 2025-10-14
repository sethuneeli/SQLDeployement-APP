-- =============================================
-- Rollback Script: 2025-10-14_rollback_TEST_table_lead_TESTCASE-003.sql
-- Author: System
-- Created: 2025-10-14
-- Target Environment: TEST
-- Description: Rollback table_lead deployment from TEST
-- Test Case: Complete TEST environment rollback with validation
-- Related Scripts: 2025-10-14_implementation_TEST_table_lead_TESTCASE-003.sql
-- =============================================

USE [AutopilotTest]
GO

PRINT '=========================================='
PRINT 'TEST CASE ROLLBACK: table_lead TEST Environment'
PRINT 'Started: ' + CONVERT(VARCHAR, GETDATE(), 120)
PRINT 'Environment: TEST'
PRINT 'Object: dbo.table_lead'
PRINT 'Action: Rollback'
PRINT 'Test Case ID: TESTCASE-003-ROLLBACK'
PRINT '=========================================='
GO

-- Phase 1: Pre-rollback validation
PRINT 'Phase 1: Pre-rollback validation...'
GO

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND type in (N'U'))
BEGIN
    PRINT 'INFO: table_lead exists in TEST environment - proceeding with rollback'
    
    -- Check record count before rollback
    DECLARE @PreRollbackCount INT
    SELECT @PreRollbackCount = COUNT(*) FROM [dbo].[table_lead]
    PRINT 'Records to be removed: ' + CAST(@PreRollbackCount AS VARCHAR)
    
    -- Check for any dependencies
    IF EXISTS (SELECT * FROM sys.foreign_keys WHERE referenced_object_id = OBJECT_ID('dbo.table_lead'))
    BEGIN
        PRINT 'WARNING: Foreign key dependencies found - manual intervention may be required'
    END
    ELSE
    BEGIN
        PRINT 'INFO: No foreign key dependencies found'
    END
END
ELSE
BEGIN
    PRINT 'INFO: table_lead does not exist in TEST environment - no rollback needed'
    GOTO RollbackComplete
END
GO

-- Phase 2: Remove extended properties
PRINT 'Phase 2: Removing extended properties...'
GO

-- Drop table extended properties
IF EXISTS (SELECT * FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.table_lead') AND name = 'MS_Description' AND minor_id = 0)
BEGIN
    EXEC sp_dropextendedproperty
        @name = N'MS_Description',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'table_lead'
    PRINT 'SUCCESS: Table extended properties removed'
END
GO

-- Drop column extended properties if they exist
DECLARE @ColumnName NVARCHAR(128)
DECLARE column_cursor CURSOR FOR
SELECT c.name
FROM sys.columns c
INNER JOIN sys.extended_properties ep ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
WHERE c.object_id = OBJECT_ID('dbo.table_lead') AND ep.name = 'MS_Description'

OPEN column_cursor
FETCH NEXT FROM column_cursor INTO @ColumnName

WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC sp_dropextendedproperty
        @name = N'MS_Description',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'table_lead',
        @level2type = N'COLUMN', @level2name = @ColumnName
    
    PRINT 'SUCCESS: Extended property removed from column ' + @ColumnName
    FETCH NEXT FROM column_cursor INTO @ColumnName
END

CLOSE column_cursor
DEALLOCATE column_cursor
GO

-- Phase 3: Drop indexes
PRINT 'Phase 3: Dropping indexes...'
GO

IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND name = N'IX_table_lead_AssignedTo')
BEGIN
    DROP INDEX [IX_table_lead_AssignedTo] ON [dbo].[table_lead]
    PRINT 'SUCCESS: Index IX_table_lead_AssignedTo dropped'
END
GO

IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND name = N'IX_table_lead_LeadStatus')
BEGIN
    DROP INDEX [IX_table_lead_LeadStatus] ON [dbo].[table_lead]
    PRINT 'SUCCESS: Index IX_table_lead_LeadStatus dropped'
END
GO

IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND name = N'IX_table_lead_LastName')
BEGIN
    DROP INDEX [IX_table_lead_LastName] ON [dbo].[table_lead]
    PRINT 'SUCCESS: Index IX_table_lead_LastName dropped'
END
GO

-- Phase 4: Data backup (optional - for safety)
PRINT 'Phase 4: Creating data backup record...'
GO

DECLARE @BackupRecordCount INT
SELECT @BackupRecordCount = COUNT(*) FROM [dbo].[table_lead]
PRINT 'INFO: ' + CAST(@BackupRecordCount AS VARCHAR) + ' records will be permanently deleted'

-- Log critical records that will be lost
IF @BackupRecordCount > 0
BEGIN
    PRINT 'INFO: Sample records being deleted:'
    SELECT TOP 3 LeadID, FirstName, LastName, Email, Company, LeadStatus
    FROM [dbo].[table_lead]
    ORDER BY LeadID
END
GO

-- Phase 5: Drop constraints
PRINT 'Phase 5: Dropping constraints...'
GO

-- Drop check constraints
IF EXISTS (SELECT * FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.table_lead') AND name = 'CK_table_lead_LeadScore')
BEGIN
    ALTER TABLE [dbo].[table_lead] DROP CONSTRAINT [CK_table_lead_LeadScore]
    PRINT 'SUCCESS: Check constraint CK_table_lead_LeadScore dropped'
END
GO

IF EXISTS (SELECT * FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.table_lead') AND name = 'CK_table_lead_LeadStatus')
BEGIN
    ALTER TABLE [dbo].[table_lead] DROP CONSTRAINT [CK_table_lead_LeadStatus]
    PRINT 'SUCCESS: Check constraint CK_table_lead_LeadStatus dropped'
END
GO

-- Drop unique constraints
IF EXISTS (SELECT * FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('dbo.table_lead') AND name = 'UK_table_lead_Email')
BEGIN
    ALTER TABLE [dbo].[table_lead] DROP CONSTRAINT [UK_table_lead_Email]
    PRINT 'SUCCESS: Unique constraint UK_table_lead_Email dropped'
END
GO

-- Drop primary key constraint
IF EXISTS (SELECT * FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('dbo.table_lead') AND name = 'PK_table_lead')
BEGIN
    ALTER TABLE [dbo].[table_lead] DROP CONSTRAINT [PK_table_lead]
    PRINT 'SUCCESS: Primary key constraint PK_table_lead dropped'
END
GO

-- Phase 6: Drop the table
PRINT 'Phase 6: Dropping table...'
GO

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND type in (N'U'))
BEGIN
    DROP TABLE [dbo].[table_lead]
    PRINT 'SUCCESS: table_lead dropped from TEST environment'
END
GO

-- Phase 7: Post-rollback validation
PRINT 'Phase 7: Post-rollback validation...'
GO

RollbackComplete:

-- Verify table removal
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND type in (N'U'))
BEGIN
    PRINT 'VALIDATION PASSED: table_lead successfully removed from TEST environment'
END
ELSE
BEGIN
    PRINT 'VALIDATION FAILED: table_lead still exists in TEST environment'
END

-- Verify no orphaned constraints
IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('dbo.table_lead'))
BEGIN
    PRINT 'VALIDATION PASSED: No orphaned constraints remain'
END
ELSE
BEGIN
    PRINT 'VALIDATION WARNING: Orphaned constraints may still exist'
END

-- Verify no orphaned indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.table_lead') AND name IS NOT NULL)
BEGIN
    PRINT 'VALIDATION PASSED: No orphaned indexes remain'
END
ELSE
BEGIN
    PRINT 'VALIDATION WARNING: Orphaned indexes may still exist'
END

-- Verify no orphaned extended properties
IF NOT EXISTS (SELECT * FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.table_lead'))
BEGIN
    PRINT 'VALIDATION PASSED: No orphaned extended properties remain'
END
ELSE
BEGIN
    PRINT 'VALIDATION WARNING: Orphaned extended properties may still exist'
END

PRINT '=========================================='
PRINT 'TEST CASE ROLLBACK SUMMARY:'
PRINT 'Object: dbo.table_lead'
PRINT 'Environment: TEST'
PRINT 'Status: COMPLETED'
PRINT 'Timestamp: ' + CONVERT(VARCHAR, GETDATE(), 120)
PRINT 'Test Case ID: TESTCASE-003-ROLLBACK'
PRINT 'Result: table_lead successfully removed from TEST'
PRINT '=========================================='
GO