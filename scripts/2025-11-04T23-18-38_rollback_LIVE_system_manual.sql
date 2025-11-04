-- SQL Portal Script Tracking
-- Timestamp: 2025-11-04T23:18:38.759Z
-- Environment: LIVE
-- User: system
-- Action: rollback
-- Correlation ID: N/A
-- Rows Affected: N/A
-- Object(s): AutopilotProd.Sales.Customers, AutopilotProd.Sales.CustomersFeedback

ALTER TABLE [Sales].[CustomersFeedback] ALTER COLUMN [Comments] nvarchar(1000) NULL
ALTER TABLE [Sales].[CustomersFeedback] ALTER COLUMN [CustomerID] nchar(10) NULL
GO

-- No rollback needed
GO