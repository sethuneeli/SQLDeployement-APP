IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'MA') EXEC('CREATE SCHEMA [MA]');
GO

CREATE TABLE [MA].[Customer] (
  [ID] int NULL,
  [name] nvarchar(10) NULL,
  [sal] int NULL,
  [sal1] int NULL
);

GO

create view [MA].Customer_view as select name from [MA].[Customer]; 

GO


create proc [MA].Customer_proc as select name from [MA].[Customer];

GO