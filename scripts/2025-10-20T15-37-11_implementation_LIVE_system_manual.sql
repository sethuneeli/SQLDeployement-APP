-- SQL Portal Script Tracking
-- Timestamp: 2025-10-20T15:37:11.402Z
-- Environment: LIVE
-- User: system
-- Action: implementation
-- Correlation ID: N/A
-- Rows Affected: N/A
-- Object(s): AutopilotProd.Sales.Customers

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'Sales') EXEC('CREATE SCHEMA [Sales]');
GO

ALTER TABLE [Sales].[Customers] ALTER COLUMN [CustomerID] nchar(5) NOT NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [CompanyName] nvarchar(40) NOT NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [ContactName] nvarchar(30) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [ContactTitle] nvarchar(30) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [Address] nvarchar(60) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [City] nvarchar(15) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [Region] nvarchar(15) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [PostalCode] nvarchar(10) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [Country] nvarchar(15) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [Phone] nvarchar(24) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [Fax] nvarchar(24) NULL
GO