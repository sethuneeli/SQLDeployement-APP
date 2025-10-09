-- Simple test to check if procedure exists and then create it
BEGIN TRY
    DROP PROCEDURE [dbo].[setLeadFormData]
    PRINT 'Dropped existing procedure setLeadFormData'
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() = 3701
        PRINT 'No existing procedure found to drop'
    ELSE
        THROW
END CATCH

-- Create the procedure (simplified version for testing)
EXEC sp_executesql N'
CREATE PROCEDURE [dbo].[setLeadFormData]
    @leadType NVARCHAR(50),
    @contactName NVARCHAR(100),
    @companyName NVARCHAR(100),
    @phone NVARCHAR(50),
    @email NVARCHAR(100),
    @comments NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON
    DECLARE @retVal INT = 0
    
    BEGIN TRY
        INSERT INTO LeadForm (LeadType, ContactName, CompanyName, Phone, Email, Comments, DateCreated)
        VALUES (@leadType, @contactName, @companyName, @phone, @email, @comments, GETDATE())
        
        SET @retVal = 1
    END TRY
    BEGIN CATCH
        SET @retVal = -1
    END CATCH
    
    RETURN @retVal
END'

PRINT 'SUCCESS: setLeadFormData procedure created successfully'