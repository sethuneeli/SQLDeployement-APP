-- SQL Portal Script Tracking
-- Timestamp: 2025-10-20T16:36:05.621Z
-- Environment: LIVE
-- User: system
-- Action: implementation
-- Correlation ID: N/A
-- Rows Affected: N/A
-- Object(s): AutopilotProd.dbo.t2

CREATE TABLE [dbo].[t2] (
  [id] int NOT NULL,
  [name] varchar(50) NULL
);
ALTER TABLE [dbo].[t2] ADD CONSTRAINT [PK__t2__3213E83FFD2314AF] PRIMARY KEY ([id]);
GO