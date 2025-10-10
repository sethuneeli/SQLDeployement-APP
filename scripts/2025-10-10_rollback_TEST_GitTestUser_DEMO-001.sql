-- SQL Portal Script Tracking
-- Timestamp: 2025-10-10T14:52:00.000Z
-- Environment: TEST
-- User: GitTestUser
-- Action: rollback
-- Correlation ID: DEMO-001-ROLLBACK
-- Rows Affected: 1
-- Object(s): dbo.TableEmp

-- Rollback script for Git integration demo
-- Removing DemoColumn from TableEmp

-- Remove extended properties first
IF EXISTS (SELECT * FROM sys.extended_properties 
           WHERE major_id = OBJECT_ID('dbo.TableEmp') 
           AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.TableEmp'), 'DemoColumn', 'ColumnId')
           AND name = 'MS_Description')
BEGIN
    EXEC sp_dropextendedproperty 
        @name = N'MS_Description',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'TableEmp',
        @level2type = N'COLUMN', @level2name = N'DemoColumn';
END

-- Drop the column
ALTER TABLE dbo.TableEmp 
DROP COLUMN DemoColumn;