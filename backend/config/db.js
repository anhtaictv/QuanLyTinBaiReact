const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'localhost',
    database: 'QuanLyTinBai',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    port: 1433
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('✅ Connected to SQL Server 160.191.46.223');
        return pool;
    })
    .catch(err => {
        console.error('❌ Database Connection Failed: ', err);
        process.exit(1);
    });

module.exports = { sql, poolPromise };