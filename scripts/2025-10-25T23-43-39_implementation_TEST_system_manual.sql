-- SQL Portal Script Tracking
-- Timestamp: 2025-10-25T23:43:39.442Z
-- Environment: TEST
-- User: system
-- Action: implementation
-- Correlation ID: N/A
-- Rows Affected: N/A
-- Object(s): AutopilotTest.Sales.Customers, AutopilotTest.Sales.CustomersFeedback, AutopilotTest.Sales.Orders, AutopilotTest.Sales.OrderAuditLog, AutopilotTest.Sales.Territories, AutopilotTest.Sales.Order Details, AutopilotTest.distributordashboard.DistributorSales, AutopilotTest.distributordashboard.DistributorSalesAudit, AutopilotTest.Sales.DiscountCode, AutopilotTest.Sales.CustomerDemographics, AutopilotTest.Sales.LoyaltyProgram, AutopilotTest.Sales.CustomerOrdersView, AutopilotTest.Sales.CustomersFeedbackSummary, AutopilotTest.Sales.Order Details Extended, AutopilotTest.Sales.Order Subtotals, AutopilotTest.Sales.Sales by Category, AutopilotTest.Sales.Sales Totals by Amount, AutopilotTest.Sales.Summary of Sales by Quarter, AutopilotTest.distributordashboard.vw_DistributorSalesSummary, AutopilotTest.Sales.Sales by Year, AutopilotTest.Sales.SalesByCategory, AutopilotTest.distributordashboard.trg_DistributorSales_Audit, AutopilotTest.Sales.City, AutopilotTest.Sales.CompanyName, AutopilotTest.Sales.PostalCode, AutopilotTest.Sales.Region, AutopilotTest.Sales.CustomerID, AutopilotTest.Sales.CustomersOrders, AutopilotTest.Sales.EmployeeID, AutopilotTest.Sales.EmployeesOrders, AutopilotTest.Sales.OrderDate, AutopilotTest.Sales.ShippedDate, AutopilotTest.Sales.ShipPostalCode, AutopilotTest.Sales.ShippersOrders, AutopilotTest.Sales.OrderID, AutopilotTest.Sales.OrdersOrder_Details, AutopilotTest.Sales.ProductID, AutopilotTest.Sales.ProductsOrder_Details, AutopilotTest.distributordashboard.IX_DistributorSales_Distributor_SaleDate, AutopilotTest.Sales.UQ__Discount__A25C5AA70A86FB88

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'Sales') EXEC('CREATE SCHEMA [Sales]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'distributordashboard') EXEC('CREATE SCHEMA [distributordashboard]');
GO

-- No changes required
GO

-- No changes required
GO

-- No changes required
GO

-- No changes required
GO

-- No changes required
GO

-- No changes required
GO

-- No changes required
GO

-- No changes required
GO

-- No changes required
GO

-- No changes required
GO

-- No changes required
GO

-- No changes detected
GO

-- No changes detected
GO

-- No changes detected
GO

-- No changes detected
GO

-- No changes detected
GO

-- No changes detected
GO

-- No changes detected
GO

-- No changes detected
GO

-- No changes detected
GO

-- No changes detected
GO

-- No changes detected
GO

-- Source does not contain INDEX [Sales].[City]
GO

-- Source does not contain INDEX [Sales].[CompanyName]
GO

-- Source does not contain INDEX [Sales].[PostalCode]
GO

-- Source does not contain INDEX [Sales].[Region]
GO

-- Source does not contain INDEX [Sales].[CustomerID]
GO

-- Source does not contain INDEX [Sales].[CustomersOrders]
GO

-- Source does not contain INDEX [Sales].[EmployeeID]
GO

-- Source does not contain INDEX [Sales].[EmployeesOrders]
GO

-- Source does not contain INDEX [Sales].[OrderDate]
GO

-- Source does not contain INDEX [Sales].[ShippedDate]
GO

-- Source does not contain INDEX [Sales].[ShipPostalCode]
GO

-- Source does not contain INDEX [Sales].[ShippersOrders]
GO

-- Source does not contain INDEX [Sales].[OrderID]
GO

-- Source does not contain INDEX [Sales].[OrdersOrder_Details]
GO

-- Source does not contain INDEX [Sales].[ProductID]
GO

-- Source does not contain INDEX [Sales].[ProductsOrder_Details]
GO

-- Source does not contain INDEX [distributordashboard].[IX_DistributorSales_Distributor_SaleDate]
GO

-- Source does not contain INDEX [Sales].[UQ__Discount__A25C5AA70A86FB88]
GO