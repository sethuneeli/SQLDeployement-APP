--------------------------------------------------------------------------------
-- Module: distributordashboiard
-- File: distributordashboiard_module.sql
-- Purpose: create schema + table + view + function + proc + trigger + index
-- Notes: safe/idempotent - drops objects only if they exist then re-creates
--------------------------------------------------------------------------------

/* ==============
   1) Create schema
   ============== */
IF NOT EXISTS (SELECT 1 FROM sys.schemas s WHERE s.name = 'distributordashboiard')
BEGIN
    EXEC('CREATE SCHEMA [distributordashboiard]');
END;
GO

/* ===========================
   2) Tables and audit tables
   =========================== */

-- Distributor master table
IF OBJECT_ID('distributordashboiard.Distributor', 'U') IS NOT NULL
    DROP TABLE distributordashboiard.Distributor;
GO

CREATE TABLE distributordashboiard.Distributor (
    DistributorId INT IDENTITY(1,1) PRIMARY KEY,
    DistributorCode NVARCHAR(50) NOT NULL UNIQUE,
    DisplayName NVARCHAR(200) NOT NULL,
    Region NVARCHAR(100) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Main sales table
IF OBJECT_ID('distributordashboiard.DistributorSales', 'U') IS NOT NULL
    DROP TABLE distributordashboiard.DistributorSales;
GO

CREATE TABLE distributordashboiard.DistributorSales (
    SaleId BIGINT IDENTITY(1,1) PRIMARY KEY,
    DistributorId INT NOT NULL REFERENCES distributordashboiard.Distributor(DistributorId) ON DELETE CASCADE,
    SaleDate DATETIME2(3) NOT NULL,
    ProductCode NVARCHAR(100) NULL,
    Quantity INT NOT NULL DEFAULT 1,
    UnitPrice DECIMAL(18,4) NOT NULL,
    Amount AS (Quantity * UnitPrice) PERSISTED,
    Notes NVARCHAR(1000) NULL,
    CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Audit table for sales changes (used by trigger)
IF OBJECT_ID('distributordashboiard.DistributorSalesAudit', 'U') IS NOT NULL
    DROP TABLE distributordashboiard.DistributorSalesAudit;
GO

CREATE TABLE distributordashboiard.DistributorSalesAudit (
    AuditId BIGINT IDENTITY(1,1) PRIMARY KEY,
    SaleId BIGINT NULL,
    DistributorId INT NULL,
    SaleDate DATETIME2(3) NULL,
    Amount DECIMAL(18,4) NULL,
    Operation NVARCHAR(20) NOT NULL, -- INSERT / UPDATE / DELETE
    ChangedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    ChangedBy NVARCHAR(200) NULL,
    RawData NVARCHAR(MAX) NULL
);
GO

/* ===========================
   3) View: aggregated summary
   =========================== */

IF OBJECT_ID('distributordashboiard.vw_DistributorSalesSummary', 'V') IS NOT NULL
    DROP VIEW distributordashboiard.vw_DistributorSalesSummary;
GO

CREATE VIEW distributordashboiard.vw_DistributorSalesSummary
AS
SELECT
    d.DistributorId,
    d.DistributorCode,
    d.DisplayName,
    d.Region,
    COUNT(s.SaleId)    AS SaleCount,
    SUM(s.Amount)      AS TotalSales,
    MAX(s.SaleDate)    AS LastSaleDate
FROM distributordashboiard.Distributor d
LEFT JOIN distributordashboiard.DistributorSales s
    ON s.DistributorId = d.DistributorId
GROUP BY
    d.DistributorId, d.DistributorCode, d.DisplayName, d.Region;
GO

/* ===========================
   4) Scalar function: get total
   =========================== */

IF OBJECT_ID('distributordashboiard.ufn_GetDistributorTotal', 'FN') IS NOT NULL
    DROP FUNCTION distributordashboiard.ufn_GetDistributorTotal;
GO

CREATE FUNCTION distributordashboiard.ufn_GetDistributorTotal(@DistributorId INT)
RETURNS DECIMAL(18,4)
AS
BEGIN
    DECLARE @total DECIMAL(18,4);
    SELECT @total = SUM(Amount) FROM distributordashboiard.DistributorSales WHERE DistributorId = @DistributorId;
    RETURN ISNULL(@total, 0);
END;
GO

/* =========================================
   5) Stored procedure: summary + recent rows
   ========================================= */

IF OBJECT_ID('distributordashboiard.usp_GetDistributorSummary', 'P') IS NOT NULL
    DROP PROCEDURE distributordashboiard.usp_GetDistributorSummary;
GO

CREATE PROCEDURE distributordashboiard.usp_GetDistributorSummary
    @DistributorId INT = NULL,      -- NULL => return all distributors
    @RecentDays INT = 30            -- include recent sales within this many days
AS
BEGIN
    SET NOCOUNT ON;

    -- return summary rows from view
    SELECT
        v.*
    FROM distributordashboiard.vw_DistributorSalesSummary v
    WHERE (@DistributorId IS NULL OR v.DistributorId = @DistributorId)
    ORDER BY v.TotalSales DESC;

    -- return recent sales (if DistributorId specified, filter; otherwise recent sales across all)
    SELECT TOP (100)
        s.SaleId, s.DistributorId, d.DisplayName, s.SaleDate, s.ProductCode, s.Quantity, s.UnitPrice, s.Amount
    FROM distributordashboiard.DistributorSales s
    LEFT JOIN distributordashboiard.Distributor d ON d.DistributorId = s.DistributorId
    WHERE s.SaleDate >= DATEADD(DAY, -1 * @RecentDays, SYSUTCDATETIME())
      AND (@DistributorId IS NULL OR s.DistributorId = @DistributorId)
    ORDER BY s.SaleDate DESC;
END;
GO

-- Optional helper wrapper
IF OBJECT_ID('dbo.fn_Distributor_Exists','FN') IS NULL
BEGIN
    EXEC('CREATE FUNCTION dbo.fn_Distributor_Exists(@d INT) RETURNS BIT AS BEGIN RETURN (SELECT CASE WHEN EXISTS(SELECT 1 FROM distributordashboiard.Distributor WHERE DistributorId=@d) THEN 1 ELSE 0 END) END');
END;
GO

/* ===========================
   6) Trigger: audit inserts
   
   IMPORTANT: CREATE TRIGGER must be the first statement in a batch. Many runners
   (including sqlcmd/SSMS) honor GO as a batch separator. If your runner does not
   split GO, use the dynamic-SQL block below which executes the CREATE TRIGGER as
   its own batch via sp_executesql.
   =========================== */

-- Drop trigger if it exists (safe to run in the same batch)
IF OBJECT_ID('distributordashboiard.trg_DistributorSales_Audit', 'TR') IS NOT NULL
    DROP TRIGGER distributordashboiard.trg_DistributorSales_Audit;
GO

-- Preferred: create trigger in its own batch
CREATE TRIGGER distributordashboiard.trg_DistributorSales_Audit
ON distributordashboiard.DistributorSales
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @op NVARCHAR(20) = 'UNKNOWN';
    IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) SET @op = 'UPDATE';
    ELSE IF EXISTS (SELECT 1 FROM inserted) SET @op = 'INSERT';
    ELSE IF EXISTS (SELECT 1 FROM deleted) SET @op = 'DELETE';

    INSERT INTO distributordashboiard.DistributorSalesAudit (SaleId, DistributorId, SaleDate, Amount, Operation, ChangedAt, ChangedBy, RawData)
    SELECT
        COALESCE(i.SaleId, d.SaleId) AS SaleId,
        COALESCE(i.DistributorId, d.DistributorId) AS DistributorId,
        COALESCE(i.SaleDate, d.SaleDate) AS SaleDate,
        COALESCE(i.Amount, d.Amount) AS Amount,
        @op AS Operation,
        SYSUTCDATETIME() AS ChangedAt,
        SUSER_SNAME() AS ChangedBy,
        (SELECT COALESCE(i.SaleId, d.SaleId) AS SaleId, COALESCE(i.DistributorId, d.DistributorId) AS DistributorId, COALESCE(i.SaleDate, d.SaleDate) AS SaleDate, COALESCE(i.Amount, d.Amount) AS Amount FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    FULL OUTER JOIN deleted d ON i.SaleId = d.SaleId;
END;
GO

-- Alternate: dynamic-SQL version (uncomment if your runner doesn't split GO):
-- DECLARE @trsql NVARCHAR(MAX) = N'
-- CREATE TRIGGER distributordashboiard.trg_DistributorSales_Audit
-- ON distributordashboiard.DistributorSales
-- AFTER INSERT, UPDATE, DELETE
-- AS
-- BEGIN
--     SET NOCOUNT ON;
--     DECLARE @op NVARCHAR(20) = ''UNKNOWN'';
--     IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) SET @op = ''UPDATE'';
--     ELSE IF EXISTS (SELECT 1 FROM inserted) SET @op = ''INSERT'';
--     ELSE IF EXISTS (SELECT 1 FROM deleted) SET @op = ''DELETE'';
--     INSERT INTO distributordashboiard.DistributorSalesAudit (SaleId, DistributorId, SaleDate, Amount, Operation, ChangedAt, ChangedBy, RawData)
--     SELECT
--         COALESCE(i.SaleId, d.SaleId) AS SaleId,
--         COALESCE(i.DistributorId, d.DistributorId) AS DistributorId,
--         COALESCE(i.SaleDate, d.SaleDate) AS SaleDate,
--         COALESCE(i.Amount, d.Amount) AS Amount,
--         @op AS Operation,
--         SYSUTCDATETIME() AS ChangedAt,
--         SUSER_SNAME() AS ChangedBy,
--         (SELECT COALESCE(i.SaleId, d.SaleId) AS SaleId, COALESCE(i.DistributorId, d.DistributorId) AS DistributorId, COALESCE(i.SaleDate, d.SaleDate) AS SaleDate, COALESCE(i.Amount, d.Amount) AS Amount FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
--     FROM inserted i
--     FULL OUTER JOIN deleted d ON i.SaleId = d.SaleId;
-- END';
-- EXEC sp_executesql @trsql;
-- GO

/* ===========================
   7) Indexes
   =========================== */

-- Non-clustered index to speed queries by DistributorId and SaleDate
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('distributordashboiard.DistributorSales') AND name = 'IX_DistributorSales_Distributor_SaleDate')
    DROP INDEX IX_DistributorSales_Distributor_SaleDate ON distributordashboiard.DistributorSales;
GO

CREATE NONCLUSTERED INDEX IX_DistributorSales_Distributor_SaleDate
ON distributordashboiard.DistributorSales (DistributorId ASC, SaleDate DESC)
INCLUDE (Quantity, UnitPrice, Amount);
GO

/* ===========================
   8) Demo data (optional)
   =========================== */

-- insert sample distributors
INSERT INTO distributordashboiard.Distributor (DistributorCode, DisplayName, Region)
VALUES
('D100','North Widgets Inc','North'),
('D200','South Gadgets Ltd','South'),
('D300','East Supplies Co.','East');
GO

-- insert sample sales
INSERT INTO distributordashboiard.DistributorSales (DistributorId, SaleDate, ProductCode, Quantity, UnitPrice, Notes)
VALUES
(1, DATEADD(DAY, -1, SYSUTCDATETIME()), 'P-RED', 10, 9.99, 'Demo sale 1'),
(1, DATEADD(DAY, -7, SYSUTCDATETIME()), 'P-BLU', 5, 19.5, 'Demo sale 2'),
(2, DATEADD(DAY, -3, SYSUTCDATETIME()), 'P-GRN', 2, 250.00, 'Large ticket'),
(3, DATEADD(DAY, -10, SYSUTCDATETIME()), 'P-YEL', 1, 15.00, NULL);
GO

/* ===========================
   9) Example usage
   =========================== */

-- Get summary for all distributors:
-- EXEC distributordashboiard.usp_GetDistributorSummary;

-- Get summary + recent sales for distributor 1:
-- EXEC distributordashboiard.usp_GetDistributorSummary @DistributorId = 1, @RecentDays = 14;

-- Call scalar function:
-- SELECT distributordashboiard.ufn_GetDistributorTotal(1) AS TotalForDistributor1;

-- Query view:
-- SELECT * FROM distributordashboiard.vw_DistributorSalesSummary ORDER BY TotalSales DESC;
