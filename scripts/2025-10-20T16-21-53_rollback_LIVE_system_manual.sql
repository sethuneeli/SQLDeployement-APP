-- SQL Portal Script Tracking
-- Timestamp: 2025-10-20T16:21:53.357Z
-- Environment: LIVE
-- User: system
-- Action: rollback
-- Correlation ID: N/A
-- Rows Affected: N/A
-- Object(s): AutopilotProd.dbo.NewMUFO_Tracker

ALTER TABLE [dbo].[NewMUFO_Tracker] DROP COLUMN [PeriodID]
GO