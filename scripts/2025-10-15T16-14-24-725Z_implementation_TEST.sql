ALTER TABLE [dbo].[TableEmp1] ADD [history] char(1) NULL
GO

CREATE TABLE [dbo].[emp1] (
  [id] int NULL
);

GO

CREATE TABLE [dbo].[Emp12345] (
  [Id] int NOT NULL,
  [Name] nvarchar(100) NULL
);
ALTER TABLE [dbo].[Emp12345] ADD CONSTRAINT [PK__Emp12345__3214EC078A1C09E0] PRIMARY KEY ([Id]);
GO

CREATE TABLE [dbo].[Emp123456] (
  [Id] int NOT NULL,
  [Name] nvarchar(100) NULL,
  [Salary] decimal(10,2) NULL
);
ALTER TABLE [dbo].[Emp123456] ADD CONSTRAINT [PK__Emp12345__3214EC07DFC7EFE5] PRIMARY KEY ([Id]);
GO