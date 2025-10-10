-- SQL Portal Script Tracking
-- Timestamp: 2025-10-10T14:50:00.000Z
-- Environment: TEST
-- User: GitTestUser
-- Action: implementation
-- Correlation ID: DEMO-001
-- Rows Affected: 1
-- Object(s): dbo.TableEmp

-- Test DDL Change for Git Integration Demo
-- Adding a column to TableEmp

ALTER TABLE dbo.TableEmp 
ADD DemoColumn VARCHAR(50) NULL;

-- Update extended properties
EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Demo column for Git integration testing',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'TableEmp',
    @level2type = N'COLUMN', @level2name = N'DemoColumn';