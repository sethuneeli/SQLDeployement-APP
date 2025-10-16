IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'MA1') EXEC('CREATE SCHEMA [MA1]');
GO

CREATE TABLE [MA1].[Customer] (
  [ID] int NULL,
  [name] nvarchar(10) NULL,
  [sal] int NULL,
  [sal1] int NULL
);

GO


create view [MA1].Customer_view as select name from [MA].[Customer]; 


GO



create proc [MA1].Customer_proc as select name from [MA].[Customer];


GO