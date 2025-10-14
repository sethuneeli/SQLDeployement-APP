-- =============================================
-- Implementation Script: 2025-10-14_implementation_TEST_table_lead_TESTCASE-003.sql
-- Author: System
-- Created: 2025-10-14
-- Target Environment: TEST
-- Description: Deploy table_lead from DEV to TEST environment
-- Test Case: Complete DEV to TEST migration with validation
-- Related Scripts: 006_create_lead_table.sql
-- =============================================

USE [AutopilotProd]
GO

PRINT '=========================================='
PRINT 'TEST CASE: table_lead DEV to TEST Migration'
PRINT 'Started: ' + CONVERT(VARCHAR, GETDATE(), 120)
PRINT 'Environment: TEST'
PRINT 'Object: dbo.table_lead'
PRINT 'Action: Implementation'
PRINT 'Test Case ID: TESTCASE-003'
PRINT '=========================================='
GO

-- Pre-deployment validation
PRINT 'Phase 1: Pre-deployment validation...'
GO

-- Check if table already exists
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND type in (N'U'))
BEGIN
    PRINT 'WARNING: table_lead already exists in TEST environment'
    DECLARE @ExistingCount INT
    SELECT @ExistingCount = COUNT(*) FROM [dbo].[table_lead]
    PRINT 'Existing record count: ' + CAST(@ExistingCount AS VARCHAR)
END
ELSE
BEGIN
    PRINT 'INFO: table_lead does not exist in TEST - proceeding with creation'
END
GO

-- Phase 2: Table Creation
PRINT 'Phase 2: Creating table_lead in TEST environment...'
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[table_lead] (
        [LeadID] INT IDENTITY(1,1) NOT NULL,
        [LeadSource] NVARCHAR(100) NOT NULL,
        [FirstName] NVARCHAR(50) NOT NULL,
        [LastName] NVARCHAR(50) NOT NULL,
        [Email] NVARCHAR(100) NOT NULL,
        [Phone] NVARCHAR(20) NULL,
        [Company] NVARCHAR(200) NULL,
        [JobTitle] NVARCHAR(100) NULL,
        [Industry] NVARCHAR(100) NULL,
        [LeadStatus] NVARCHAR(50) NOT NULL DEFAULT 'New',
        [LeadScore] INT NULL DEFAULT 0,
        [EstimatedValue] DECIMAL(18,2) NULL,
        [ExpectedCloseDate] DATE NULL,
        [AssignedTo] NVARCHAR(100) NULL,
        [Notes] NVARCHAR(MAX) NULL,
        [DateCreated] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [DateModified] DATETIME2 NULL,
        [CreatedBy] NVARCHAR(100) NOT NULL DEFAULT SYSTEM_USER,
        [ModifiedBy] NVARCHAR(100) NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [IsQualified] BIT NOT NULL DEFAULT 0,
        
        CONSTRAINT [PK_table_lead] PRIMARY KEY CLUSTERED ([LeadID] ASC),
        CONSTRAINT [UK_table_lead_Email] UNIQUE ([Email]),
        CONSTRAINT [CK_table_lead_LeadStatus] CHECK ([LeadStatus] IN ('New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Closed-Won', 'Closed-Lost', 'Nurturing')),
        CONSTRAINT [CK_table_lead_LeadScore] CHECK ([LeadScore] >= 0 AND [LeadScore] <= 100)
    )
    
    PRINT 'SUCCESS: table_lead structure created in TEST environment'
END
GO

-- Phase 3: Index Creation
PRINT 'Phase 3: Creating indexes in TEST environment...'
GO

-- Create performance indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND name = N'IX_table_lead_LastName')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_table_lead_LastName] ON [dbo].[table_lead] ([LastName] ASC)
    PRINT 'SUCCESS: Index IX_table_lead_LastName created'
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND name = N'IX_table_lead_LeadStatus')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_table_lead_LeadStatus] ON [dbo].[table_lead] ([LeadStatus] ASC)
    PRINT 'SUCCESS: Index IX_table_lead_LeadStatus created'
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND name = N'IX_table_lead_AssignedTo')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_table_lead_AssignedTo] ON [dbo].[table_lead] ([AssignedTo] ASC)
    PRINT 'SUCCESS: Index IX_table_lead_AssignedTo created'
END
GO

-- Phase 4: Test Data Insertion
PRINT 'Phase 4: Inserting TEST environment data...'
GO

IF NOT EXISTS (SELECT * FROM [dbo].[table_lead] WHERE Email = 'test.lead@testcompany.com')
BEGIN
    INSERT INTO [dbo].[table_lead] ([LeadSource], [FirstName], [LastName], [Email], [Phone], [Company], [JobTitle], [Industry], [LeadStatus], [LeadScore], [EstimatedValue], [ExpectedCloseDate], [AssignedTo], [Notes])
    VALUES 
        ('TEST-Website', 'Test', 'Lead', 'test.lead@testcompany.com', '555-TEST1', 'Test Company Inc', 'Test Manager', 'Testing', 'New', 80, 25000.00, '2025-12-01', 'Test Sales Rep', 'Test lead for validation'),
        ('TEST-Demo', 'Demo', 'Prospect', 'demo.prospect@democorp.com', '555-TEST2', 'Demo Corp', 'Demo Director', 'Technology', 'Contacted', 70, 40000.00, '2025-11-20', 'Test Sales Rep', 'Demo lead for testing'),
        ('TEST-QA', 'Quality', 'Assurance', 'qa.lead@qacorp.com', '555-TEST3', 'QA Corporation', 'QA Lead', 'Software', 'Qualified', 95, 60000.00, '2025-10-25', 'Test Sales Rep', 'Quality assurance test lead')
    
    PRINT 'SUCCESS: Test data inserted in TEST environment'
    
    DECLARE @TestRecordCount INT
    SELECT @TestRecordCount = COUNT(*) FROM [dbo].[table_lead]
    PRINT 'Total records after insertion: ' + CAST(@TestRecordCount AS VARCHAR)
END
ELSE
BEGIN
    PRINT 'INFO: Test data already exists in TEST environment'
END
GO

-- Phase 5: Extended Properties
PRINT 'Phase 5: Adding extended properties...'
GO

-- Add table documentation
IF NOT EXISTS (SELECT * FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.table_lead') AND name = 'MS_Description' AND minor_id = 0)
BEGIN
    EXEC sp_addextendedproperty 
        @name = N'MS_Description', 
        @value = N'Lead management table for tracking sales prospects and opportunities - TEST Environment',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'table_lead'
    PRINT 'SUCCESS: Table extended properties added'
END
GO

-- Phase 6: Comprehensive Validation
PRINT 'Phase 6: Comprehensive deployment validation...'
GO

-- Table existence check
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND type in (N'U'))
BEGIN
    PRINT 'VALIDATION PASSED: table_lead exists in TEST environment'
    
    -- Column count validation
    DECLARE @ColumnCount INT
    SELECT @ColumnCount = COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.table_lead')
    PRINT 'VALIDATION: Column count = ' + CAST(@ColumnCount AS VARCHAR) + ' (Expected: 20)'
    
    -- Record count validation
    DECLARE @RecordCount INT
    SELECT @RecordCount = COUNT(*) FROM [dbo].[table_lead]
    PRINT 'VALIDATION: Record count = ' + CAST(@RecordCount AS VARCHAR)
    
    -- Constraint validation
    DECLARE @ConstraintCount INT
    SELECT @ConstraintCount = COUNT(*) FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('dbo.table_lead')
    PRINT 'VALIDATION: Constraint count = ' + CAST(@ConstraintCount AS VARCHAR) + ' (Expected: 2)'
    
    -- Index validation
    DECLARE @IndexCount INT
    SELECT @IndexCount = COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.table_lead') AND name IS NOT NULL
    PRINT 'VALIDATION: Index count = ' + CAST(@IndexCount AS VARCHAR) + ' (Expected: 4)'
    
    -- Check constraints validation
    IF EXISTS (SELECT * FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.table_lead') AND name = 'CK_table_lead_LeadStatus')
        PRINT 'VALIDATION PASSED: LeadStatus check constraint exists'
    ELSE
        PRINT 'VALIDATION FAILED: LeadStatus check constraint missing'
    
    IF EXISTS (SELECT * FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.table_lead') AND name = 'CK_table_lead_LeadScore')
        PRINT 'VALIDATION PASSED: LeadScore check constraint exists'
    ELSE
        PRINT 'VALIDATION FAILED: LeadScore check constraint missing'
    
    -- Primary key validation
    IF EXISTS (SELECT * FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('dbo.table_lead') AND name = 'PK_table_lead')
        PRINT 'VALIDATION PASSED: Primary key constraint exists'
    ELSE
        PRINT 'VALIDATION FAILED: Primary key constraint missing'
    
    -- Unique constraint validation
    IF EXISTS (SELECT * FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('dbo.table_lead') AND name = 'UK_table_lead_Email')
        PRINT 'VALIDATION PASSED: Email unique constraint exists'
    ELSE
        PRINT 'VALIDATION FAILED: Email unique constraint missing'
    
END
ELSE
BEGIN
    PRINT 'VALIDATION FAILED: table_lead does not exist in TEST environment'
END
GO

-- Phase 7: Performance Test
PRINT 'Phase 7: Performance validation...'
GO

-- Test query performance
DECLARE @StartTime DATETIME2 = GETDATE()
SELECT COUNT(*) as TotalLeads FROM [dbo].[table_lead]
DECLARE @EndTime DATETIME2 = GETDATE()
DECLARE @Duration INT = DATEDIFF(MILLISECOND, @StartTime, @EndTime)
PRINT 'PERFORMANCE: Count query completed in ' + CAST(@Duration AS VARCHAR) + ' milliseconds'
GO

-- Test index usage
DECLARE @StartTime2 DATETIME2 = GETDATE()
SELECT * FROM [dbo].[table_lead] WHERE LeadStatus = 'New'
DECLARE @EndTime2 DATETIME2 = GETDATE()
DECLARE @Duration2 INT = DATEDIFF(MILLISECOND, @StartTime2, @EndTime2)
PRINT 'PERFORMANCE: Index query completed in ' + CAST(@Duration2 AS VARCHAR) + ' milliseconds'
GO

PRINT '=========================================='
PRINT 'TEST CASE DEPLOYMENT SUMMARY:'
PRINT 'Object: dbo.table_lead'
PRINT 'Source: DEV Environment'
PRINT 'Target: TEST Environment'
PRINT 'Status: COMPLETED'
PRINT 'Timestamp: ' + CONVERT(VARCHAR, GETDATE(), 120)
PRINT 'Test Case ID: TESTCASE-003'
PRINT '=========================================='
GO