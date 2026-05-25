# Saint Patrick's Academy Website

This version includes a Node.js backend with database support.

- Local computer: SQLite file database
- Online hosting: PostgreSQL through `DATABASE_URL`

## Run Locally

1. Install Node.js from https://nodejs.org if it is not installed.
2. Open PowerShell in this folder:

   `C:\Users\ADMIN\OneDrive\Documents\website`

3. Install the backend database package:

   `npm.cmd install`

4. Start the backend:

   `npm.cmd start`

5. Open this in your browser:

   `http://localhost:3000`

## Admin Login

Default admin password:

`admin123`

To change it when running locally:

`$env:ADMIN_PASSWORD="your-new-password"; npm start`

## Data Storage

Local student accounts and bills are saved in:

`data/school.db`

For online hosting, create a PostgreSQL database and add this environment variable to your web service:

`DATABASE_URL=your-postgresql-connection-string`

If your database provider requires SSL, also add:

`DATABASE_SSL=true`

This backend is a starter prototype. For real public school use, passwords should be hashed before launch.
