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