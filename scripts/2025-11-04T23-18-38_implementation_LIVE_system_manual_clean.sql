IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'Sales') EXEC('CREATE SCHEMA [Sales]');
GO

-- No changes required
GO

ALTER TABLE [Sales].[CustomersFeedback] ALTER COLUMN [CustomerID] nchar(5) NULL
ALTER TABLE [Sales].[CustomersFeedback] ALTER COLUMN [Comments] nvarchar(500) NULL
GO