-- =============================================
-- Implementation Script: 2025-10-10_implementation_TEST_Customer_Table_DEMO-002.sql
-- Author: System
-- Created: 2025-10-10
-- Target Environment: TEST
-- Description: Deploy Customer table from DEV to TEST
-- Related Scripts: 005_create_customer_table.sql
-- =============================================

USE [AutopilotProd]
GO

PRINT 'Starting Customer table deployment to TEST environment...'
PRINT 'Timestamp: ' + CONVERT(VARCHAR, GETDATE(), 120)
GO

-- Check if table exists before creating
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Customer]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Customer] (
        [CustomerID] INT IDENTITY(1,1) NOT NULL,
        [FirstName] NVARCHAR(50) NOT NULL,
        [LastName] NVARCHAR(50) NOT NULL,
        [Email] NVARCHAR(100) NOT NULL,
        [Phone] NVARCHAR(20) NULL,
        [Address] NVARCHAR(200) NULL,
        [City] NVARCHAR(50) NULL,
        [State] NVARCHAR(50) NULL,
        [ZipCode] NVARCHAR(10) NULL,
        [Country] NVARCHAR(50) NULL DEFAULT 'USA',
        [DateCreated] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [DateModified] DATETIME2 NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        
        CONSTRAINT [PK_Customer] PRIMARY KEY CLUSTERED ([CustomerID] ASC),
        CONSTRAINT [UK_Customer_Email] UNIQUE ([Email])
    )
    
    PRINT 'SUCCESS: Customer table created in TEST environment'
END
ELSE
BEGIN
    PRINT 'INFO: Customer table already exists in TEST environment'
END
GO

-- Create index for better performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Customer]') AND name = N'IX_Customer_LastName')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Customer_LastName] ON [dbo].[Customer] ([LastName] ASC)
    PRINT 'SUCCESS: Index IX_Customer_LastName created in TEST environment'
END
ELSE
BEGIN
    PRINT 'INFO: Index IX_Customer_LastName already exists in TEST environment'
END
GO

-- Insert sample test data
IF NOT EXISTS (SELECT * FROM [dbo].[Customer] WHERE Email = 'test.customer@example.com')
BEGIN
    INSERT INTO [dbo].[Customer] ([FirstName], [LastName], [Email], [Phone], [Address], [City], [State], [ZipCode])
    VALUES 
        ('Test', 'Customer', 'test.customer@example.com', '555-TEST', '123 Test St', 'Test City', 'TS', '00000'),
        ('Demo', 'User', 'demo.user@example.com', '555-DEMO', '456 Demo Ave', 'Demo Town', 'DM', '11111')
    
    PRINT 'SUCCESS: Sample test data inserted in TEST environment'
END
ELSE
BEGIN
    PRINT 'INFO: Test data already exists in TEST environment'
END
GO

-- Verification queries
PRINT 'Performing deployment verification...'
GO

-- Check table exists
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Customer]') AND type in (N'U'))
BEGIN
    PRINT 'VERIFICATION: Customer table exists - PASSED'
    
    -- Check record count
    DECLARE @RecordCount INT
    SELECT @RecordCount = COUNT(*) FROM [dbo].[Customer]
    PRINT 'VERIFICATION: Customer table has ' + CAST(@RecordCount AS VARCHAR) + ' records'
    
    -- Check constraints
    IF EXISTS (SELECT * FROM sys.key_constraints WHERE name = 'PK_Customer')
        PRINT 'VERIFICATION: Primary key constraint exists - PASSED'
    
    IF EXISTS (SELECT * FROM sys.key_constraints WHERE name = 'UK_Customer_Email')
        PRINT 'VERIFICATION: Unique email constraint exists - PASSED'
    
    -- Check index
    IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Customer]') AND name = N'IX_Customer_LastName')
        PRINT 'VERIFICATION: LastName index exists - PASSED'
END
ELSE
BEGIN
    PRINT 'VERIFICATION: Customer table deployment - FAILED'
END
GO

PRINT 'Customer table deployment to TEST environment completed.'
PRINT 'End Timestamp: ' + CONVERT(VARCHAR, GETDATE(), 120)
GO