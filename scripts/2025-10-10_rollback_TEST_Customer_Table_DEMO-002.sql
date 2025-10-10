-- =============================================
-- Rollback Script: 2025-10-10_rollback_TEST_Customer_Table_DEMO-002.sql
-- Author: System
-- Created: 2025-10-10
-- Target Environment: TEST
-- Description: Rollback Customer table deployment from TEST
-- Related Scripts: 2025-10-10_implementation_TEST_Customer_Table_DEMO-002.sql
-- =============================================

USE [AutopilotProd]
GO

PRINT 'Starting Customer table rollback from TEST environment...'
PRINT 'Timestamp: ' + CONVERT(VARCHAR, GETDATE(), 120)
GO

-- Drop indexes first
IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Customer]') AND name = N'IX_Customer_LastName')
BEGIN
    DROP INDEX [IX_Customer_LastName] ON [dbo].[Customer]
    PRINT 'SUCCESS: Index IX_Customer_LastName dropped from TEST environment'
END
ELSE
BEGIN
    PRINT 'INFO: Index IX_Customer_LastName does not exist in TEST environment'
END
GO

-- Drop the Customer table
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Customer]') AND type in (N'U'))
BEGIN
    -- First check if there are any dependencies
    DECLARE @RecordCount INT
    SELECT @RecordCount = COUNT(*) FROM [dbo].[Customer]
    PRINT 'INFO: Customer table has ' + CAST(@RecordCount AS VARCHAR) + ' records before deletion'
    
    DROP TABLE [dbo].[Customer]
    PRINT 'SUCCESS: Customer table dropped from TEST environment'
END
ELSE
BEGIN
    PRINT 'INFO: Customer table does not exist in TEST environment'
END
GO

-- Verification
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Customer]') AND type in (N'U'))
BEGIN
    PRINT 'VERIFICATION: Customer table rollback - PASSED'
END
ELSE
BEGIN
    PRINT 'VERIFICATION: Customer table rollback - FAILED (table still exists)'
END
GO

PRINT 'Customer table rollback from TEST environment completed.'
PRINT 'End Timestamp: ' + CONVERT(VARCHAR, GETDATE(), 120)
GO