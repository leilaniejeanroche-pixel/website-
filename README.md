# Saint Patrick's Academy Website

This version includes a Node.js backend with a SQLite database.

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

Student accounts and bills are saved in:

`data/school.db`

This backend is a starter prototype. For real public school use, passwords should be hashed and the site should use a production database service.
