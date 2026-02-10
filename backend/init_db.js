const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDB() {
    try {
        // 1. Create connection without database selected to create it
        const connection = await mysql.createConnection({
            host: process.env.DB_SERVER,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
            multipleStatements: true,
            ssl: process.env.DB_SSL === 'true' ? {
                minVersion: 'TLSv1.2',
                rejectUnauthorized: true,
                ca: process.env.DB_CA ? fs.readFileSync(process.env.DB_CA) : undefined
            } : null
        });

        console.log('✅ Connected to MySQL server');

        // 2. Read Schema File
        const schemaPath = path.join(__dirname, 'db_schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // 3. Execute Schema
        // Note: mysql2 supports multiple statements if configured, but here we can just run the whole script if syntax allows
        // Splitting by ; might be safer if multipleStatements is not reliable or we want to log progress,
        // but schema usually works fine with multipleStatements: true

        console.log('⏳ Executing schema...');

        // Explicitly create DB first if it's the first statement, but usually the file has it.
        // The file has: CREATE DATABASE IF NOT EXISTS win_moto; USE win_moto; ...
        // So we can just run it.

        await connection.query(schema);

        console.log('✅ Database "win_moto" and tables created successfully!');
        await connection.end();

        process.exit(0);
    } catch (err) {
        console.error('❌ Error initializing database:', err.message);
        console.error('  -> Please check if MySQL is running and credentials in .env are correct.');
        process.exit(1);
    }
}

initDB();
