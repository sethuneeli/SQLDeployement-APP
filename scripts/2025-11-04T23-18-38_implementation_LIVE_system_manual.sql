-- SQL Portal Script Tracking
-- Timestamp: 2025-11-04T23:18:38.759Z
-- Environment: LIVE
-- User: system
-- Action: implementation
-- Correlation ID: N/A
-- Rows Affected: N/A
-- Object(s): AutopilotProd.Sales.Customers, AutopilotProd.Sales.CustomersFeedback

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'Sales') EXEC('CREATE SCHEMA [Sales]');
GO

-- No changes required
GO

ALTER TABLE [Sales].[CustomersFeedback] ALTER COLUMN [CustomerID] nchar(5) NULL
ALTER TABLE [Sales].[CustomersFeedback] ALTER COLUMN [Comments] nvarchar(500) NULL
GO