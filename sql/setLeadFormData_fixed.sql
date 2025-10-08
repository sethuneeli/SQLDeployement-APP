-- Fixed version of dbo.setLeadFormData
-- Uses a single RETURN at the end and sets @retVal in TRY/CATCH

IF OBJECT_ID('dbo.setLeadFormData', 'P') IS NOT NULL
    DROP PROCEDURE dbo.setLeadFormData;
GO

CREATE PROCEDURE [dbo].[setLeadFormData]
(
  @FirstName nvarchar(128),
  @LastName nvarchar(128) = NULL,
  @Email nvarchar(255),
  @CellPhone nvarchar(100),
  @ReferralInfo nvarchar(100) = NULL,
  @PortalData nvarchar(255),
  @UTM nvarchar(255) = NULL,
  @SiteType nvarchar(3),
  @Country nvarchar(3),
  @Language nvarchar(3),
  @PCID nvarchar(25) = NULL,
  @Location nvarchar(100) = NULL,
  @Assigned nvarchar(25) = NULL,
  @Status nvarchar(25) = NULL,
  @Internal_Comment nvarchar(1000) = NULL,
  @BestContactTime nvarchar(50) = NULL,
  @Interest nvarchar(1000) = NULL,
  @Lead_Comment nvarchar(1000) = NULL,
  @Closed_None_Result nvarchar(1000) = NULL,
  @UTM_Source NVARCHAR(255) = NULL,
  @UTM_Medium NVARCHAR(255) = NULL,
  @UTM_Campaign NVARCHAR(255) = NULL,
  @UTM_Content NVARCHAR(255) = NULL,
  @UTM_Term NVARCHAR(255) = NULL
)
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE
    @LastUpdated datetime,
    @sql nvarchar(max),
    @TextOut varchar(max),
    @retVal int = 0,
    @prevStatus nvarchar(25);

  -- defaults
  IF @Status IS NULL SET @Status = 'New';
  IF @SiteType IS NULL SET @SiteType = 'D';

  BEGIN TRY
    INSERT INTO [dbo].[LeadForm]
    (
      FirstName, LastName, Email, CellPhone, ReferralInfo, PortalData, UTM,
      SiteType, Country, Language, PCID, Location, Assigned, Status,
      Internal_Comment, BestContactTime, Interest, Lead_Comment, Closed_None_Result,
      Opened_On, Pending_On, Closed_On,
      UTM_Source, UTM_Medium, UTM_Campaign, UTM_Content, UTM_Term
    )
    SELECT
      @FirstName, @LastName, @Email, @CellPhone, @ReferralInfo, @PortalData, @UTM,
      @SiteType, @Country, @Language, @PCID, @Location, @Assigned, @Status,
      @Internal_Comment, @BestContactTime, @Interest, @Lead_Comment, @Closed_None_Result,
      CASE WHEN @Status = 'Open' THEN GETDATE() ELSE NULL END,
      CASE WHEN @Status = 'Pending' THEN GETDATE() ELSE NULL END,
      CASE WHEN @Status = 'Closed' THEN GETDATE() ELSE NULL END,
      @UTM_Source, @UTM_Medium, @UTM_Campaign, @UTM_Content, @UTM_Term;

    -- success
    SET @retVal = 0;
  END TRY
  BEGIN CATCH
    SELECT
      @TextOut =
        'Server: ' + @@SERVERNAME + CHAR(13) +
        'DB: ' + DB_NAME() + CHAR(13) +
        'ErrorProcedure: ' + ISNULL(ERROR_PROCEDURE(), '') + CHAR(13) +
        'ErrorNumber: ' + CAST(ERROR_NUMBER() AS VARCHAR(255)) + CHAR(13) +
        'ErrorSeverity: ' + CAST(ERROR_SEVERITY() AS VARCHAR(255)) + CHAR(13) +
        'ErrorState: ' + CAST(ERROR_STATE() AS VARCHAR(255)) + CHAR(13) +
        'ErrorLine: ' + CAST(ERROR_LINE() AS VARCHAR(255)) + CHAR(13) +
        'ErrorMessage: ' + ISNULL(ERROR_MESSAGE(), '');

    IF @@TRANCOUNT > 0
      ROLLBACK TRANSACTION;

    PRINT @TextOut;

    SET @retVal = 1; -- indicate failure
  END CATCH;

  -- single return at end
  RETURN @retVal;
END;
GO
