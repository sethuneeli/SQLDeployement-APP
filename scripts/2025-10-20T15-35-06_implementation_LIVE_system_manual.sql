-- SQL Portal Script Tracking
-- Timestamp: 2025-10-20T15:35:06.359Z
-- Environment: LIVE
-- User: system
-- Action: implementation
-- Correlation ID: N/A
-- Rows Affected: N/A
-- Object(s): AutopilotProd.dbo.TableEmp

ALTER TABLE [dbo].[TableEmp] ADD [Name] nvarchar(100) NULL
ALTER TABLE [dbo].[TableEmp] ADD [Salary] decimal(10,2) NULL
ALTER TABLE [dbo].[TableEmp] DROP COLUMN [FName]
ALTER TABLE [dbo].[TableEmp] DROP COLUMN [Salary1]
GO