-- Run ONCE with:  psql -U postgres -f setup_db.sql
-- Creates the app databases and a dedicated PostgreSQL user for the project.

CREATE USER auth_app WITH PASSWORD 'your_secure_password_here';

CREATE DATABASE auth_system OWNER auth_app;
CREATE DATABASE auth_system_test OWNER auth_app;

GRANT ALL PRIVILEGES ON DATABASE auth_system TO auth_app;
GRANT ALL PRIVILEGES ON DATABASE auth_system_test TO auth_app;
