-- SQL Portal Script Tracking
-- Timestamp: 2025-10-20T15:35:06.359Z
-- Environment: LIVE
-- User: system
-- Action: rollback
-- Correlation ID: N/A
-- Rows Affected: N/A
-- Object(s): AutopilotProd.dbo.TableEmp

ALTER TABLE [dbo].[TableEmp] ADD [Salary1] decimal(10,2) NULL
ALTER TABLE [dbo].[TableEmp] ADD [FName] nvarchar(200) NULL
ALTER TABLE [dbo].[TableEmp] DROP COLUMN [Salary]
ALTER TABLE [dbo].[TableEmp] DROP COLUMN [Name]
GO