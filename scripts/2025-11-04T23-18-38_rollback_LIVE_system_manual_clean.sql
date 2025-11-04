ALTER TABLE [Sales].[CustomersFeedback] ALTER COLUMN [Comments] nvarchar(1000) NULL
ALTER TABLE [Sales].[CustomersFeedback] ALTER COLUMN [CustomerID] nchar(10) NULL
GO

-- No rollback needed
GO