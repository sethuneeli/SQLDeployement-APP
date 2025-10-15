-- Test script for Git integration demo
-- Adding a new column to TableEmp for testing Git tracking
-- Environment: TEST
-- Author: Test User
-- Date: 2025-10-10

ALTER TABLE dbo.TableEmp
ADD TestColumn varchar(50) NULL;

-- Add comment for the new column
EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Test column added for Git integration demo',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'TableEmp',
    @level2type = N'COLUMN', @level2name = N'TestColumn';