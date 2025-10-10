-- =============================================
-- Rollback Script: 005_rollback_customer_table.sql
-- Author: System
-- Created: 2025-10-10
-- Description: Rollback Customer table creation
-- =============================================

USE [AutopilotProd]
GO

-- Drop indexes first
IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Customer]') AND name = N'IX_Customer_LastName')
BEGIN
    DROP INDEX [IX_Customer_LastName] ON [dbo].[Customer]
    PRINT 'Index IX_Customer_LastName dropped successfully'
END
GO

-- Drop the Customer table
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Customer]') AND type in (N'U'))
BEGIN
    DROP TABLE [dbo].[Customer]
    PRINT 'Customer table dropped successfully'
END
ELSE
BEGIN
    PRINT 'Customer table does not exist'
END
GO