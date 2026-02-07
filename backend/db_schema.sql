CREATE DATABASE IF NOT EXISTS win_moto;
USE win_moto;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS driver_location (
    driver_id INT PRIMARY KEY,
    lat FLOAT,
    lng FLOAT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT, -- Assuming there is a user_id based on typical order logic, though not explicitly in the snippet viewed
    driver_id INT,
    pickup_lat FLOAT,
    pickup_lng FLOAT,
    dropoff_lat FLOAT,
    dropoff_lng FLOAT,
    status VARCHAR(50) DEFAULT 'WAITING', -- WAITING, ON_ROUTE, COMPLETED, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
