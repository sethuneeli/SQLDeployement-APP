-- SQL Portal Script Tracking
-- Timestamp: 2025-10-20T16:14:45.989Z
-- Environment: LIVE
-- User: system
-- Action: implementation
-- Correlation ID: N/A
-- Rows Affected: N/A
-- Object(s): AutopilotProd.dbo.TableEmp11

CREATE TABLE [dbo].[TableEmp11] (
  [Id] int NOT NULL,
  [Name] nvarchar(100) NULL,
  [Salary] decimal(10,2) NULL,
  [history] char(1) NULL
);
ALTER TABLE [dbo].[TableEmp11] ADD CONSTRAINT [PK__TableEmp__3214EC077AB0E889] PRIMARY KEY ([Id]);
GO