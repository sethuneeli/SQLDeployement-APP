-- =============================================
-- Script: 005_create_customer_table.sql
-- Author: System
-- Created: 2025-10-10
-- Description: Create Customer table for customer management
-- Environment: DEV -> TEST -> PROD
-- =============================================

USE [AutopilotProd]
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
    
    PRINT 'Customer table created successfully'
END
ELSE
BEGIN
    PRINT 'Customer table already exists'
END
GO

-- Create index for better performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Customer]') AND name = N'IX_Customer_LastName')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Customer_LastName] ON [dbo].[Customer] ([LastName] ASC)
    PRINT 'Index IX_Customer_LastName created successfully'
END
GO

-- Insert sample data
IF NOT EXISTS (SELECT * FROM [dbo].[Customer] WHERE Email = 'john.doe@example.com')
BEGIN
    INSERT INTO [dbo].[Customer] ([FirstName], [LastName], [Email], [Phone], [Address], [City], [State], [ZipCode])
    VALUES 
        ('John', 'Doe', 'john.doe@example.com', '555-0123', '123 Main St', 'Anytown', 'NY', '12345'),
        ('Jane', 'Smith', 'jane.smith@example.com', '555-0456', '456 Oak Ave', 'Somewhere', 'CA', '67890'),
        ('Mike', 'Johnson', 'mike.johnson@example.com', '555-0789', '789 Pine Rd', 'Elsewhere', 'TX', '54321')
    
    PRINT 'Sample customer data inserted successfully'
END
GO