-- Initialize test database for MCP MSSQL Server
-- This script creates a sample database with test data

USE master;
GO

-- Create test database
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'MCPTest')
BEGIN
    CREATE DATABASE MCPTest;
END
GO

USE MCPTest;
GO

-- Create sample tables
CREATE TABLE Customers (
    CustomerID int PRIMARY KEY IDENTITY(1,1),
    FirstName nvarchar(50) NOT NULL,
    LastName nvarchar(50) NOT NULL,
    Email nvarchar(100),
    City nvarchar(50),
    Country nvarchar(50),
    CreatedDate datetime2 DEFAULT GETDATE()
);

CREATE TABLE Orders (
    OrderID int PRIMARY KEY IDENTITY(1,1),
    CustomerID int NOT NULL,
    OrderDate datetime2 DEFAULT GETDATE(),
    TotalAmount decimal(10,2),
    Status nvarchar(20) DEFAULT 'Pending',
    FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID)
);

CREATE TABLE Products (
    ProductID int PRIMARY KEY IDENTITY(1,1),
    ProductName nvarchar(100) NOT NULL,
    Category nvarchar(50),
    Price decimal(10,2),
    InStock bit DEFAULT 1
);

CREATE TABLE OrderItems (
    OrderItemID int PRIMARY KEY IDENTITY(1,1),
    OrderID int NOT NULL,
    ProductID int NOT NULL,
    Quantity int NOT NULL,
    UnitPrice decimal(10,2),
    FOREIGN KEY (OrderID) REFERENCES Orders(OrderID),
    FOREIGN KEY (ProductID) REFERENCES Products(ProductID)
);

-- Insert sample data
INSERT INTO Customers (FirstName, LastName, Email, City, Country) VALUES
('John', 'Doe', 'john.doe@email.com', 'New York', 'USA'),
('Jane', 'Smith', 'jane.smith@email.com', 'London', 'UK'),
('Bob', 'Johnson', 'bob.johnson@email.com', 'Toronto', 'Canada'),
('Alice', 'Brown', 'alice.brown@email.com', 'Sydney', 'Australia'),
('Charlie', 'Wilson', 'charlie.wilson@email.com', 'Berlin', 'Germany');

INSERT INTO Products (ProductName, Category, Price) VALUES
('Laptop', 'Electronics', 999.99),
('Mouse', 'Electronics', 29.99),
('Keyboard', 'Electronics', 79.99),
('Monitor', 'Electronics', 299.99),
('Desk Chair', 'Furniture', 199.99);

INSERT INTO Orders (CustomerID, TotalAmount, Status) VALUES
(1, 1029.98, 'Completed'),
(2, 299.99, 'Pending'),
(3, 79.99, 'Shipped'),
(4, 999.99, 'Completed'),
(5, 229.98, 'Processing');

INSERT INTO OrderItems (OrderID, ProductID, Quantity, UnitPrice) VALUES
(1, 1, 1, 999.99),
(1, 2, 1, 29.99),
(2, 4, 1, 299.99),
(3, 3, 1, 79.99),
(4, 1, 1, 999.99),
(5, 2, 2, 29.99),
(5, 5, 1, 199.99);

PRINT 'MCPTest database initialized successfully!';
GO