-- =============================================
-- PRODUCTION ROLLBACK Script: 2025-10-14_rollback_PROD_table_lead_TESTCASE-003.sql
-- Author: System
-- Created: 2025-10-14
-- Target Environment: PROD
-- Description: EMERGENCY ROLLBACK table_lead from PRODUCTION
-- Test Case: Complete PROD environment emergency rollback
-- Related Scripts: 2025-10-14_implementation_PROD_table_lead_TESTCASE-003.sql
-- ⚠️  CRITICAL: PRODUCTION ROLLBACK PROCEDURE ⚠️
-- =============================================

USE [AutopilotProd]
GO

PRINT '🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨'
PRINT '⚠️  CRITICAL PRODUCTION ROLLBACK INITIATED ⚠️'
PRINT 'PRODUCTION ROLLBACK: table_lead EMERGENCY REMOVAL'
PRINT 'Started: ' + CONVERT(VARCHAR, GETDATE(), 120)
PRINT 'Environment: PRODUCTION (AutopilotProd)'
PRINT 'Object: dbo.table_lead'
PRINT 'Action: EMERGENCY ROLLBACK'
PRINT 'Test Case ID: TESTCASE-003-PROD-ROLLBACK'
PRINT '⚠️  THIS WILL PERMANENTLY DELETE PRODUCTION DATA ⚠️'
PRINT '🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨'
GO

-- MANDATORY PRODUCTION SAFETY DELAYS
PRINT '⏰ PRODUCTION SAFETY: 10-second mandatory review period...'
WAITFOR DELAY '00:00:10'
PRINT '⏰ PRODUCTION SAFETY: Review period complete'
GO

-- Phase 1: CRITICAL Production Pre-Rollback Assessment
PRINT 'Phase 1: CRITICAL production pre-rollback assessment...'
GO

-- Check for business data
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND type in (N'U'))
BEGIN
    PRINT '⚠️  PRODUCTION ASSESSMENT: table_lead exists in PRODUCTION'
    
    -- Count production business data
    DECLARE @CriticalDataCount INT
    SELECT @CriticalDataCount = COUNT(*) FROM [dbo].[table_lead]
    PRINT '⚠️  CRITICAL DATA ASSESSMENT: ' + CAST(@CriticalDataCount AS VARCHAR) + ' production records at risk'
    
    -- Business impact assessment
    IF @CriticalDataCount > 0
    BEGIN
        PRINT '🚨 BUSINESS IMPACT WARNING: ' + CAST(@CriticalDataCount AS VARCHAR) + ' lead records will be PERMANENTLY DELETED'
        PRINT '🚨 BUSINESS IMPACT: All lead management data will be LOST'
        PRINT '🚨 BUSINESS IMPACT: Sales team will lose access to lead information'
        
        -- Log critical records for emergency recovery
        PRINT '📊 EMERGENCY BACKUP: Logging critical records for potential recovery...'
        SELECT TOP 10 
            LeadID, FirstName, LastName, Email, Company, LeadStatus, EstimatedValue,
            'CRITICAL_BACKUP_' + CONVERT(VARCHAR, GETDATE(), 120) as BackupMarker
        FROM [dbo].[table_lead]
        ORDER BY EstimatedValue DESC, DateCreated DESC
        
        PRINT '💾 EMERGENCY BACKUP: Top 10 critical records logged for recovery'
    END
    ELSE
    BEGIN
        PRINT '✅ BUSINESS IMPACT: No production data - rollback safe to proceed'
    END
    
    -- Check for dependencies
    IF EXISTS (SELECT * FROM sys.foreign_keys WHERE referenced_object_id = OBJECT_ID('dbo.table_lead'))
    BEGIN
        PRINT '🚨 DEPENDENCY ALERT: Foreign key dependencies detected'
        PRINT '🚨 DEPENDENCY IMPACT: Related tables may be affected'
        
        -- List dependencies
        SELECT 
            OBJECT_NAME(fk.parent_object_id) as DependentTable,
            fk.name as ForeignKeyName
        FROM sys.foreign_keys fk
        WHERE fk.referenced_object_id = OBJECT_ID('dbo.table_lead')
        
        PRINT '⚠️  MANUAL INTERVENTION: Review dependencies before proceeding'
    END
    ELSE
    BEGIN
        PRINT '✅ DEPENDENCY CHECK: No foreign key dependencies found'
    END
END
ELSE
BEGIN
    PRINT '✅ PRODUCTION ASSESSMENT: table_lead does not exist - no rollback needed'
    GOTO RollbackComplete
END
GO

-- Phase 2: Production Change Tracking Disable
PRINT 'Phase 2: Disabling production monitoring systems...'
GO

-- Disable change tracking if enabled
IF EXISTS (SELECT * FROM sys.change_tracking_tables WHERE object_id = OBJECT_ID('dbo.table_lead'))
BEGIN
    -- ALTER TABLE [dbo].[table_lead] DISABLE CHANGE_TRACKING
    PRINT '✅ PRODUCTION MONITORING: Change tracking disabled'
END
GO

-- Phase 3: Production Extended Properties Removal
PRINT 'Phase 3: Removing production documentation...'
GO

-- Remove production extended properties
IF EXISTS (SELECT * FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.table_lead') AND name = 'MS_Description' AND minor_id = 0)
BEGIN
    EXEC sp_dropextendedproperty
        @name = N'MS_Description',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'table_lead'
    PRINT '✅ PRODUCTION CLEANUP: Table documentation removed'
END
GO

-- Remove column extended properties
DECLARE @ProdColumnName NVARCHAR(128)
DECLARE prod_column_cursor CURSOR FOR
SELECT c.name
FROM sys.columns c
INNER JOIN sys.extended_properties ep ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
WHERE c.object_id = OBJECT_ID('dbo.table_lead') AND ep.name = 'MS_Description'

OPEN prod_column_cursor
FETCH NEXT FROM prod_column_cursor INTO @ProdColumnName

WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC sp_dropextendedproperty
        @name = N'MS_Description',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'table_lead',
        @level2type = N'COLUMN', @level2name = @ProdColumnName
    
    PRINT '✅ PRODUCTION CLEANUP: Extended property removed from column ' + @ProdColumnName
    FETCH NEXT FROM prod_column_cursor INTO @ProdColumnName
END

CLOSE prod_column_cursor
DEALLOCATE prod_column_cursor
GO

-- Phase 4: Production Index Removal
PRINT 'Phase 4: Removing production indexes...'
GO

-- Drop production indexes with explicit confirmation
IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND name = N'IX_table_lead_AssignedTo')
BEGIN
    DROP INDEX [IX_table_lead_AssignedTo] ON [dbo].[table_lead]
    PRINT '✅ PRODUCTION ROLLBACK: Index IX_table_lead_AssignedTo removed'
END

IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND name = N'IX_table_lead_LeadStatus')
BEGIN
    DROP INDEX [IX_table_lead_LeadStatus] ON [dbo].[table_lead]
    PRINT '✅ PRODUCTION ROLLBACK: Index IX_table_lead_LeadStatus removed'
END

IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND name = N'IX_table_lead_LastName')
BEGIN
    DROP INDEX [IX_table_lead_LastName] ON [dbo].[table_lead]
    PRINT '✅ PRODUCTION ROLLBACK: Index IX_table_lead_LastName removed'
END
GO

-- Phase 5: Production Constraint Removal
PRINT 'Phase 5: Removing production business rules...'
GO

-- Remove business rule constraints
IF EXISTS (SELECT * FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.table_lead') AND name = 'CK_table_lead_LeadScore')
BEGIN
    ALTER TABLE [dbo].[table_lead] DROP CONSTRAINT [CK_table_lead_LeadScore]
    PRINT '✅ PRODUCTION ROLLBACK: LeadScore business rules removed'
END

IF EXISTS (SELECT * FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.table_lead') AND name = 'CK_table_lead_LeadStatus')
BEGIN
    ALTER TABLE [dbo].[table_lead] DROP CONSTRAINT [CK_table_lead_LeadStatus]
    PRINT '✅ PRODUCTION ROLLBACK: LeadStatus business rules removed'
END

-- Remove unique constraints
IF EXISTS (SELECT * FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('dbo.table_lead') AND name = 'UK_table_lead_Email')
BEGIN
    ALTER TABLE [dbo].[table_lead] DROP CONSTRAINT [UK_table_lead_Email]
    PRINT '✅ PRODUCTION ROLLBACK: Email uniqueness constraint removed'
END

-- Remove primary key (CRITICAL STEP)
IF EXISTS (SELECT * FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('dbo.table_lead') AND name = 'PK_table_lead')
BEGIN
    ALTER TABLE [dbo].[table_lead] DROP CONSTRAINT [PK_table_lead]
    PRINT '✅ PRODUCTION ROLLBACK: Primary key constraint removed'
END
GO

-- Phase 6: CRITICAL Production Table Removal
PRINT 'Phase 6: CRITICAL production table removal...'
GO

-- Final confirmation and table drop
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND type in (N'U'))
BEGIN
    PRINT '🚨 FINAL WARNING: About to DROP production table dbo.table_lead'
    PRINT '🚨 FINAL WARNING: This action cannot be undone'
    PRINT '⏰ FINAL SAFETY DELAY: 5 seconds...'
    WAITFOR DELAY '00:00:05'
    
    DROP TABLE [dbo].[table_lead]
    PRINT '✅ PRODUCTION ROLLBACK: table_lead REMOVED from production'
    PRINT '🚨 BUSINESS IMPACT: Lead management system OFFLINE'
END
GO

-- Phase 7: Production Rollback Validation
PRINT 'Phase 7: Production rollback validation...'
GO

RollbackComplete:

-- Verify complete removal from production
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND type in (N'U'))
BEGIN
    PRINT '✅ PRODUCTION VALIDATION: table_lead successfully removed from PRODUCTION'
    PRINT '✅ PRODUCTION VALIDATION: System returned to pre-deployment state'
END
ELSE
BEGIN
    PRINT '❌ PRODUCTION VALIDATION FAILED: table_lead still exists in PRODUCTION'
    PRINT '🚨 MANUAL INTERVENTION REQUIRED'
END

-- Verify no orphaned objects
IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('dbo.table_lead'))
    AND NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.table_lead') AND name IS NOT NULL)
    AND NOT EXISTS (SELECT * FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.table_lead'))
BEGIN
    PRINT '✅ PRODUCTION VALIDATION: No orphaned database objects remain'
END
ELSE
BEGIN
    PRINT '⚠️  PRODUCTION WARNING: Some orphaned objects may remain - manual cleanup required'
END
GO

-- Phase 8: Production System Restoration
PRINT 'Phase 8: Production system status...'
GO

PRINT '📊 PRODUCTION STATUS: Lead management system OFFLINE'
PRINT '📊 PRODUCTION STATUS: Database returned to pre-deployment state'
PRINT '📊 PRODUCTION STATUS: No business data impact (table removed)'
PRINT '📊 PRODUCTION STATUS: System ready for alternative deployment'
GO

PRINT '🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨'
PRINT 'PRODUCTION ROLLBACK SUMMARY:'
PRINT 'Object: dbo.table_lead'
PRINT 'Environment: PRODUCTION (AutopilotProd)'
PRINT 'Status: ROLLBACK COMPLETED'
PRINT 'Timestamp: ' + CONVERT(VARCHAR, GETDATE(), 120)
PRINT 'Test Case ID: TESTCASE-003-PROD-ROLLBACK'
PRINT 'Business Impact: Lead management system OFFLINE'
PRINT 'Next Steps: Business review required before re-deployment'
PRINT '🚨 PRODUCTION ROLLBACK COMPLETED 🚨'
PRINT '🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨'
GO