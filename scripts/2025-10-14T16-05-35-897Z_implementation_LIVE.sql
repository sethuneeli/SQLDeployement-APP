CREATE TABLE [dbo].[TableEmp1] (
  [Id] int NOT NULL,
  [Name] nvarchar(100) NULL,
  [Salary] decimal(10,2) NULL
);
ALTER TABLE [dbo].[TableEmp1] ADD CONSTRAINT [PK__TableEmp__3214EC07B7CD5456] PRIMARY KEY ([Id]);
GO