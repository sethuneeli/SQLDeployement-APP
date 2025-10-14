-- =============================================
-- Rollback Script: 006_rollback_lead_table.sql
-- Author: System
-- Created: 2025-10-14
-- Description: Rollback Lead table creation
-- Test Case: Rollback table_lead deployment
-- =============================================

USE [AutopilotDev]
GO

PRINT 'Starting table_lead rollback process...'
PRINT 'Timestamp: ' + CONVERT(VARCHAR, GETDATE(), 120)
GO

-- Drop extended properties first
IF EXISTS (SELECT * FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.table_lead') AND name = 'MS_Description')
BEGIN
    EXEC sp_dropextendedproperty
        @name = N'MS_Description',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'table_lead'
    PRINT 'Table extended properties dropped'
END
GO

-- Drop column extended properties
IF EXISTS (SELECT * FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.table_lead') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.table_lead'), 'LeadID', 'ColumnId'))
BEGIN
    EXEC sp_dropextendedproperty
        @name = N'MS_Description',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'table_lead',
        @level2type = N'COLUMN', @level2name = N'LeadID'
    PRINT 'LeadID column extended properties dropped'
END
GO

-- Drop indexes first
IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND name = N'IX_table_lead_AssignedTo')
BEGIN
    DROP INDEX [IX_table_lead_AssignedTo] ON [dbo].[table_lead]
    PRINT 'Index IX_table_lead_AssignedTo dropped successfully'
END
GO

IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND name = N'IX_table_lead_LeadStatus')
BEGIN
    DROP INDEX [IX_table_lead_LeadStatus] ON [dbo].[table_lead]
    PRINT 'Index IX_table_lead_LeadStatus dropped successfully'
END
GO

IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND name = N'IX_table_lead_LastName')
BEGIN
    DROP INDEX [IX_table_lead_LastName] ON [dbo].[table_lead]
    PRINT 'Index IX_table_lead_LastName dropped successfully'
END
GO

-- Drop the table_lead table
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND type in (N'U'))
BEGIN
    -- Check record count before deletion
    DECLARE @RecordCount INT
    SELECT @RecordCount = COUNT(*) FROM [dbo].[table_lead]
    PRINT 'table_lead contains ' + CAST(@RecordCount AS VARCHAR) + ' records before deletion'
    
    DROP TABLE [dbo].[table_lead]
    PRINT 'table_lead dropped successfully'
END
ELSE
BEGIN
    PRINT 'table_lead does not exist'
END
GO

-- Verification
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND type in (N'U'))
BEGIN
    PRINT 'VERIFICATION: table_lead rollback completed successfully'
END
ELSE
BEGIN
    PRINT 'ERROR: table_lead rollback failed - table still exists'
END
GO

PRINT 'table_lead rollback process completed'
PRINT 'End Timestamp: ' + CONVERT(VARCHAR, GETDATE(), 120)
GO