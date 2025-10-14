-- =============================================
-- Script: 006_create_lead_table.sql
-- Author: System
-- Created: 2025-10-14
-- Description: Create Lead table for lead management system
-- Environment: DEV -> TEST -> PROD
-- Test Case: Move table_lead from DEV to TEST
-- =============================================

USE [AutopilotProd]
GO

-- Check if table exists before creating
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
    
    PRINT 'table_lead created successfully in DEV environment'
END
ELSE
BEGIN
    PRINT 'table_lead already exists in DEV environment'
END
GO

-- Create indexes for better performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND name = N'IX_table_lead_LastName')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_table_lead_LastName] ON [dbo].[table_lead] ([LastName] ASC)
    PRINT 'Index IX_table_lead_LastName created successfully'
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND name = N'IX_table_lead_LeadStatus')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_table_lead_LeadStatus] ON [dbo].[table_lead] ([LeadStatus] ASC)
    PRINT 'Index IX_table_lead_LeadStatus created successfully'
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[table_lead]') AND name = N'IX_table_lead_AssignedTo')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_table_lead_AssignedTo] ON [dbo].[table_lead] ([AssignedTo] ASC)
    PRINT 'Index IX_table_lead_AssignedTo created successfully'
END
GO

-- Insert sample DEV data for testing
IF NOT EXISTS (SELECT * FROM [dbo].[table_lead] WHERE Email = 'john.prospect@techcorp.com')
BEGIN
    INSERT INTO [dbo].[table_lead] ([LeadSource], [FirstName], [LastName], [Email], [Phone], [Company], [JobTitle], [Industry], [LeadStatus], [LeadScore], [EstimatedValue], [ExpectedCloseDate], [AssignedTo], [Notes])
    VALUES 
        ('Website', 'John', 'Prospect', 'john.prospect@techcorp.com', '555-0001', 'TechCorp Inc', 'IT Director', 'Technology', 'New', 75, 50000.00, '2025-12-15', 'Sales Rep 1', 'Interested in enterprise solution'),
        ('Referral', 'Sarah', 'Johnson', 'sarah.johnson@retailplus.com', '555-0002', 'RetailPlus', 'VP Marketing', 'Retail', 'Contacted', 85, 75000.00, '2025-11-30', 'Sales Rep 2', 'Warm lead from existing customer'),
        ('Trade Show', 'Mike', 'Chen', 'mike.chen@manufacturing.com', '555-0003', 'Manufacturing Solutions', 'Operations Manager', 'Manufacturing', 'Qualified', 90, 125000.00, '2025-10-31', 'Sales Rep 1', 'Ready for proposal'),
        ('Cold Call', 'Lisa', 'Rodriguez', 'lisa.rodriguez@healthcare.org', '555-0004', 'Healthcare Systems', 'CTO', 'Healthcare', 'Proposal', 95, 200000.00, '2025-11-15', 'Sales Rep 3', 'Enterprise deal in progress'),
        ('LinkedIn', 'David', 'Wilson', 'david.wilson@financecorp.com', '555-0005', 'Finance Corp', 'CFO', 'Finance', 'Nurturing', 60, 30000.00, '2026-01-31', 'Sales Rep 2', 'Long-term opportunity')
    
    PRINT 'Sample lead data inserted successfully in DEV environment'
END
GO

-- Add extended properties for documentation
EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Lead management table for tracking sales prospects and opportunities',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'table_lead'
GO

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Unique identifier for each lead',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'table_lead',
    @level2type = N'COLUMN', @level2name = N'LeadID'
GO

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Source where the lead originated (Website, Referral, Trade Show, etc.)',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'table_lead',
    @level2type = N'COLUMN', @level2name = N'LeadSource'
GO