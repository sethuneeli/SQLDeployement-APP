-- SQL Portal Script Tracking
-- Timestamp: 2025-10-20T15:37:11.402Z
-- Environment: LIVE
-- User: system
-- Action: rollback
-- Correlation ID: N/A
-- Rows Affected: N/A
-- Object(s): AutopilotProd.Sales.Customers

ALTER TABLE [Sales].[Customers] ALTER COLUMN [Fax] nvarchar(48) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [Phone] nvarchar(48) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [Country] nvarchar(30) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [PostalCode] nvarchar(20) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [Region] nvarchar(30) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [City] nvarchar(30) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [Address] nvarchar(120) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [ContactTitle] nvarchar(60) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [ContactName] nvarchar(60) NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [CompanyName] nvarchar(80) NOT NULL
ALTER TABLE [Sales].[Customers] ALTER COLUMN [CustomerID] nchar(10) NOT NULL
GO