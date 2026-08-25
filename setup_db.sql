-- Run ONCE with:  sudo mysql < setup_db.sql
-- Creates the app databases and a dedicated MySQL user for the project.

CREATE DATABASE IF NOT EXISTS auth_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS auth_system_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'auth_app'@'localhost' IDENTIFIED BY 'change_me_strong_password';
GRANT ALL PRIVILEGES ON auth_system.* TO 'auth_app'@'localhost';
GRANT ALL PRIVILEGES ON auth_system_test.* TO 'auth_app'@'localhost';
FLUSH PRIVILEGES;
