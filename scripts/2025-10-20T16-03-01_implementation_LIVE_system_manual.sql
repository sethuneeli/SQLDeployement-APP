-- SQL Portal Script Tracking
-- Timestamp: 2025-10-20T16:03:01.941Z
-- Environment: LIVE
-- User: system
-- Action: implementation
-- Correlation ID: N/A
-- Rows Affected: N/A
-- Object(s): AutopilotProd.Sales.Territories

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'Sales') EXEC('CREATE SCHEMA [Sales]');
GO

CREATE TABLE [Sales].[Territories] (
  [TerritoryID] nvarchar(20) NOT NULL,
  [TerritoryDescription] nchar(50) NOT NULL,
  [RegionID] int NOT NULL,
  [RegionName] nchar(10) NULL,
  [RegionCode] nchar(10) NULL,
  [RegionOwner] nchar(10) NULL,
  [Nationality] nvarchar(20) NULL,
  [NationalityCode] nvarchar(20) NULL
);
ALTER TABLE [Sales].[Territories] ADD CONSTRAINT [PK_Territories] PRIMARY KEY ([TerritoryID]);
GO