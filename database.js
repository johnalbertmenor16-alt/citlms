const authMode = (process.env.DB_AUTH || 'windows').toLowerCase();

if (!['windows', 'sql'].includes(authMode)) {
    throw new Error('DB_AUTH must be either windows or sql.');
}

if (process.env.NODE_ENV === 'production' && authMode !== 'sql') {
    throw new Error('Production deployments must use DB_AUTH=sql.');
}

if (authMode === 'sql' && (!process.env.DB_USER || !process.env.DB_PASSWORD)) {
    throw new Error('DB_USER and DB_PASSWORD are required when DB_AUTH=sql.');
}

const sql = authMode === 'windows' ? require('mssql/msnodesqlv8') : require('mssql');
const dbConfig = {
    server: process.env.DB_SERVER || '.\\SQLEXPRESS',
    database: process.env.DB_NAME || 'LMS_DB',
    ...(authMode === 'windows'
        ? { driver: 'ODBC Driver 17 for SQL Server' }
        : { user: process.env.DB_USER, password: process.env.DB_PASSWORD }),
    ...(process.env.DB_PORT ? { port: Number(process.env.DB_PORT) } : {}),
    options: authMode === 'windows'
        ? { trustedConnection: true, trustServerCertificate: true }
        : {
            encrypt: process.env.DB_ENCRYPT !== 'false',
            trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
        }
};

module.exports = { sql, dbConfig };