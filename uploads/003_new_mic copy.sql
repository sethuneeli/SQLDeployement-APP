-- 1. Create Table
CREATE TABLE dbo.Employee (
    EmployeeID INT PRIMARY KEY IDENTITY(1,1),
    FirstName NVARCHAR(50),
    LastName NVARCHAR(50),
    HireDate DATE,
    Salary DECIMAL(10, 2),
    UpdatedAt DATETIME NULL
);

-- 2. Create View
CREATE VIEW dbo.vw_EmployeeDetails AS
SELECT
    EmployeeID,
    FirstName + ' ' + LastName AS FullName,
    HireDate,
    Salary
FROM dbo.Employee;

-- 3. Create Stored Procedure
CREATE PROCEDURE dbo.usp_GetEmployeesBySalary
    @MinSalary DECIMAL(10,2)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT *
    FROM dbo.Employee
    WHERE Salary >= @MinSalary;
END;

-- 4. Create Scalar Function
CREATE FUNCTION dbo.fn_GetEmployeeFullName
(
    @EmployeeID INT
)
RETURNS NVARCHAR(101)
AS
BEGIN
    DECLARE @FullName NVARCHAR(101);
    SELECT @FullName = FirstName + ' ' + LastName
    FROM dbo.Employee
    WHERE EmployeeID = @EmployeeID;
    RETURN @FullName;
END;

-- 5. Create Trigger
CREATE TRIGGER dbo.trg_UpdateEmployeeTimestamp
ON dbo.Employee
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE E
    SET UpdatedAt = GETDATE()
    FROM dbo.Employee E
    INNER JOIN inserted i ON E.EmployeeID = i.EmployeeID;
END;
