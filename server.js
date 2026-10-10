const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { createHash, randomBytes } = require('crypto');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { sql, dbConfig } = require('./database');

const app = express();
const moduleUploadDirectory = path.join(__dirname, 'uploads', 'modules');
const avatarUploadDirectory = path.join(__dirname, 'uploads', 'avatars');
const yearLevels = new Set(['1st Year', '2nd Year', '3rd Year', '4th Year']);
const allowedModuleExtensions = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.zip']);
const allowedAvatarExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
fs.mkdirSync(moduleUploadDirectory, { recursive: true });
fs.mkdirSync(avatarUploadDirectory, { recursive: true });
async function removeStoredAvatarFile(storedFileName) {
    if (!storedFileName || !/^[a-f0-9]{32}\.[a-z0-9]+$/i.test(storedFileName)) return;
    try {
        await fs.promises.unlink(path.join(avatarUploadDirectory, storedFileName));
    } catch (err) {
        if (err.code !== 'ENOENT') console.error(`Could not delete avatar file ${storedFileName}.`, err);
    }
}
async function removeStoredModuleFiles(files, context) {
    let cleanupWarning = false;
    for (const storedFileName of new Set(files.filter(Boolean))) {
        if (!/^[a-f0-9]{32}\.[a-z0-9]+$/i.test(storedFileName)) {
            console.error(`Skipped deleting invalid stored module filename for ${context}.`);
            cleanupWarning = true;
            continue;
        }
        try {
            await fs.promises.unlink(path.join(moduleUploadDirectory, storedFileName));
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(`Could not delete uploaded module file for ${context}.`, err);
                cleanupWarning = true;
            }
        }
    }
    return cleanupWarning;
}
const moduleUpload = multer({
    storage: multer.diskStorage({
        destination: moduleUploadDirectory,
        filename: (req, file, callback) => callback(null, `${randomBytes(16).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
    }),
    limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(allowedModuleExtensions.has(extension) ? null : new Error('Use a PDF, Office document, text file, image, or ZIP file.'), allowedModuleExtensions.has(extension));
    }
});
const avatarUpload = multer({
    storage: multer.diskStorage({
        destination: avatarUploadDirectory,
        filename: (req, file, callback) => callback(null, `${randomBytes(16).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(allowedAvatarExtensions.has(extension) ? null : new Error('Use a PNG, JPG, WEBP, or GIF image.'), allowedAvatarExtensions.has(extension));
    }
});
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    throw new Error('Set CORS_ORIGINS to the deployed frontend origin in production.');
}
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));
app.use(express.json()); // Para mabasa ang JSON mula sa frontend
app.use('/uploads/avatars', express.static(avatarUploadDirectory, { maxAge: '1h' }));

const frontendFiles = new Set([
    'app.js',
    'academic-workflow.css',
    'arc.css',
    'auth.css',
    'classroom-chat.css',
    'classroom-content.css',
    'course-hierarchy.css',
    'cit-seal.png',
    'config.js',
    'dashboard.css',
    'index.html',
    'manifest.json',
    'modules.css',
    'service-worker.js',
    'password-recovery.css',
    'preview.css',
    'responsive.css',
    'signup.css',
    'style.css',
    'views.css'
]);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/:file', (req, res, next) => {
    if (!frontendFiles.has(req.params.file)) return next();
    res.sendFile(path.join(__dirname, req.params.file));
});

const sessions = new Map();
const passwordResetRequestAttempts = new Map();
const signupAttempts = new Map();

function allowPasswordResetRequest(ipAddress) {
    const now = Date.now();
    const recentAttempts = (passwordResetRequestAttempts.get(ipAddress) || []).filter((timestamp) => now - timestamp < 15 * 60 * 1000);
    if (recentAttempts.length >= 5) return false;
    recentAttempts.push(now);
    passwordResetRequestAttempts.set(ipAddress, recentAttempts);
    return true;
}

function allowSignupRequest(ipAddress) {
    const now = Date.now();
    const recentAttempts = (signupAttempts.get(ipAddress) || []).filter((timestamp) => now - timestamp < 15 * 60 * 1000);
    if (recentAttempts.length >= 5) return false;
    recentAttempts.push(now);
    signupAttempts.set(ipAddress, recentAttempts);
    return true;
}

app.get('/api/signup/programs', async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const result = await sql.query`SELECT p.ProgramID AS id, p.Name AS name, d.Code AS departmentCode, d.Name AS departmentName FROM dbo.Programs p INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID WHERE d.IsActive = 1 AND d.Code = 'CIT' ORDER BY p.Name`;
        res.json({ programs: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load programs for signup.' });
    }
});

app.post('/api/signup', (req, res) => {
    avatarUpload.single('profilePicture')(req, res, async (uploadError) => {
        if (uploadError) {
            return res.status(400).json({ success: false, message: uploadError.code === 'LIMIT_FILE_SIZE' ? 'Profile pictures must be 5 MB or smaller.' : uploadError.message });
        }
        const userId = String(req.body.userId || '').trim();
        const firstName = String(req.body.firstName || '').trim();
        const lastName = String(req.body.lastName || '').trim();
        const password = String(req.body.password || '');
        const requestedRole = String(req.body.role || '');
        const programId = Number.parseInt(req.body.programId, 10);
        if (!/^[A-Za-z0-9._-]{3,50}$/.test(userId) || !firstName || firstName.length > 50 || !lastName || lastName.length > 50 || password.length < 6 || password.length > 128 || !Number.isInteger(programId) || !['Student', 'Instructor'].includes(requestedRole)) {
            if (req.file) await removeStoredAvatarFile(req.file.filename);
            return res.status(400).json({ success: false, message: 'Complete all fields. Account IDs may use letters, numbers, dots, underscores, and hyphens; passwords need at least 6 characters.' });
        }
        if (!allowSignupRequest(req.ip)) {
            if (req.file) await removeStoredAvatarFile(req.file.filename);
            return res.status(429).json({ success: false, message: 'Too many signup requests. Try again in 15 minutes.' });
        }

        try {
            await sql.connect(dbConfig);
            const program = await sql.query`SELECT ProgramID FROM dbo.Programs WHERE ProgramID = ${programId}`;
            const existingUser = await sql.query`SELECT UserID FROM dbo.Users WHERE UserID = ${userId}`;
            const pending = await sql.query`SELECT RequestID FROM dbo.SignupRequests WHERE UserID = ${userId} AND Status = 'Pending'`;
            if (program.recordset.length && !existingUser.recordset.length && !pending.recordset.length) {
                const passwordHash = await bcrypt.hash(password, 12);
                const profilePicture = req.file ? req.file.filename : null;
                await sql.query`INSERT INTO dbo.SignupRequests (UserID, PasswordHash, FirstName, LastName, ProgramID, RequestedRole, ProfilePicture) VALUES (${userId}, ${passwordHash}, ${firstName}, ${lastName}, ${programId}, ${requestedRole}, ${profilePicture})`;
            } else if (req.file) {
                await removeStoredAvatarFile(req.file.filename);
            }
        } catch (err) {
            if (req.file) await removeStoredAvatarFile(req.file.filename);
            console.error(err);
            return res.status(500).json({ success: false, message: 'Could not submit account request. Please try again later.' });
        }

        res.status(202).json({ success: true, message: 'If the details match an available program, the account request has been submitted for approval. You cannot sign in until it is approved.' });
    });
});

app.get('/api/signup-requests', requireAuth, requireRole('dean', 'programchair'), async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const result = req.user.role === 'dean'
            ? await sql.query`SELECT r.RequestID AS id, r.UserID AS userId, r.FirstName AS firstName, r.LastName AS lastName, r.RequestedAt AS requestedAt, r.RequestedRole AS requestedRole, p.ProgramID AS programId, p.Name AS programName FROM dbo.SignupRequests r INNER JOIN dbo.Programs p ON p.ProgramID = r.ProgramID WHERE r.Status = 'Pending' ORDER BY r.RequestedAt ASC`
            : await sql.query`SELECT r.RequestID AS id, r.UserID AS userId, r.FirstName AS firstName, r.LastName AS lastName, r.RequestedAt AS requestedAt, r.RequestedRole AS requestedRole, p.ProgramID AS programId, p.Name AS programName FROM dbo.SignupRequests r INNER JOIN dbo.Programs p ON p.ProgramID = r.ProgramID WHERE r.Status = 'Pending' AND r.RequestedRole = 'Student' AND p.ProgramChairUserID = ${req.user.userId} ORDER BY r.RequestedAt ASC`;
        res.json({ requests: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load signup requests.' });
    }
});

app.post('/api/signup-requests/:requestId/approve', requireAuth, requireRole('dean', 'programchair'), async (req, res) => {
    const requestId = Number.parseInt(req.params.requestId, 10);
    if (!Number.isInteger(requestId)) return res.status(400).json({ message: 'Invalid signup request.' });

    const transaction = new sql.Transaction();
    try {
        await sql.connect(dbConfig);
        await transaction.begin();
        const request = new sql.Request(transaction);
        request.input('requestId', sql.Int, requestId);
        request.input('reviewerUserId', sql.VarChar(50), req.user.userId);
        request.input('isDean', sql.Bit, req.user.role === 'dean');
        const pending = await request.query("SELECT r.UserID, r.PasswordHash, r.FirstName, r.LastName, r.RequestedRole, r.ProfilePicture FROM dbo.SignupRequests r WITH (UPDLOCK, ROWLOCK) INNER JOIN dbo.Programs p ON p.ProgramID = r.ProgramID WHERE r.RequestID = @requestId AND r.Status = 'Pending' AND (@isDean = 1 OR (r.RequestedRole = 'Student' AND p.ProgramChairUserID = @reviewerUserId))");
        if (!pending.recordset.length) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Pending signup request not found in your approval scope.' });
        }

        const signup = pending.recordset[0];
        const insertUser = new sql.Request(transaction);
        insertUser.input('userId', sql.VarChar(50), signup.UserID);
        insertUser.input('passwordHash', sql.VarChar(255), signup.PasswordHash);
        insertUser.input('firstName', sql.VarChar(50), signup.FirstName);
        insertUser.input('lastName', sql.VarChar(50), signup.LastName);
        insertUser.input('role', sql.VarChar(20), signup.RequestedRole);
        insertUser.input('profilePicture', sql.VarChar(80), signup.ProfilePicture || null);
        await insertUser.query("INSERT INTO dbo.Users (UserID, Password, FirstName, LastName, Role, ProfilePicture) VALUES (@userId, @passwordHash, @firstName, @lastName, @role, @profilePicture)");

        const updateRequest = new sql.Request(transaction);
        updateRequest.input('requestId', sql.Int, requestId);
        updateRequest.input('reviewerUserId', sql.VarChar(50), req.user.userId);
        await updateRequest.query("UPDATE dbo.SignupRequests SET Status = 'Approved', ReviewedAt = SYSUTCDATETIME(), ReviewedByUserID = @reviewerUserId WHERE RequestID = @requestId AND Status = 'Pending'");
        await transaction.commit();
        res.status(201).json({ success: true, userId: signup.UserID });
    } catch (err) {
        if (transaction._aborted !== true) await transaction.rollback().catch(() => {});
        if (err.number === 2627 || err.number === 2601) return res.status(409).json({ message: 'An account with that ID already exists.' });
        console.error(err);
        res.status(500).json({ message: 'Could not approve signup request.' });
    }
});

app.post('/api/signup-requests/:requestId/reject', requireAuth, requireRole('dean', 'programchair'), async (req, res) => {
    const requestId = Number.parseInt(req.params.requestId, 10);
    if (!Number.isInteger(requestId)) return res.status(400).json({ message: 'Invalid signup request.' });

    try {
        await sql.connect(dbConfig);
        const result = req.user.role === 'dean'
            ? await sql.query`UPDATE dbo.SignupRequests SET Status = 'Rejected', ReviewedAt = SYSUTCDATETIME(), ReviewedByUserID = ${req.user.userId} WHERE RequestID = ${requestId} AND Status = 'Pending'`
            : await sql.query`UPDATE r SET Status = 'Rejected', ReviewedAt = SYSUTCDATETIME(), ReviewedByUserID = ${req.user.userId} FROM dbo.SignupRequests r INNER JOIN dbo.Programs p ON p.ProgramID = r.ProgramID WHERE r.RequestID = ${requestId} AND r.Status = 'Pending' AND r.RequestedRole = 'Student' AND p.ProgramChairUserID = ${req.user.userId}`;
        if (!result.rowsAffected[0]) return res.status(404).json({ message: 'Pending signup request not found in your approval scope.' });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not reject signup request.' });
    }
});

app.post('/api/password-reset-requests', async (req, res) => {
    const userId = String(req.body.userId || '').trim();
    if (userId && userId.length <= 50 && allowPasswordResetRequest(req.ip)) {
        try {
            await sql.connect(dbConfig);
            await sql.query`UPDATE dbo.PasswordResetRequests SET Status = 'Expired' WHERE UserID = ${userId} AND Status = 'Issued' AND TokenExpiresAt <= SYSUTCDATETIME()`;
            const existing = await sql.query`SELECT TOP (1) RequestID FROM dbo.PasswordResetRequests WHERE UserID = ${userId} AND Status IN ('Pending', 'Issued')`;
            if (!existing.recordset.length) {
                await sql.query`INSERT INTO dbo.PasswordResetRequests (UserID) SELECT UserID FROM dbo.Users WHERE UserID = ${userId}`;
            }
        } catch (err) {
            console.error(err);
        }
    }
    res.status(202).json({ success: true, message: 'If the account exists, the reset request has been submitted for Dean verification.' });
});

app.post('/api/password-reset', async (req, res) => {
    const userId = String(req.body.userId || '').trim();
    const resetCode = String(req.body.resetCode || '').trim();
    const newPassword = String(req.body.newPassword || '');
    if (!userId || userId.length > 50 || !resetCode || newPassword.length < 6 || newPassword.length > 128) {
        return res.status(400).json({ success: false, message: 'Enter your account ID, reset code, and a new password of at least 6 characters.' });
    }

    try {
        await sql.connect(dbConfig);
        const tokenHash = createHash('sha256').update(resetCode).digest('hex');
        const passwordHash = await bcrypt.hash(newPassword, 12);
        const result = await sql.query`BEGIN TRANSACTION; DECLARE @ResetAccount TABLE (UserID VARCHAR(50)); UPDATE dbo.PasswordResetRequests SET Status = 'Completed', CompletedAt = SYSUTCDATETIME(), TokenHash = NULL OUTPUT INSERTED.UserID INTO @ResetAccount WHERE UserID = ${userId} AND TokenHash = ${tokenHash} AND Status = 'Issued' AND TokenExpiresAt > SYSUTCDATETIME(); IF EXISTS (SELECT 1 FROM @ResetAccount) UPDATE dbo.Users SET Password = ${passwordHash} WHERE UserID = (SELECT TOP (1) UserID FROM @ResetAccount); SELECT COUNT(*) AS resetCount FROM @ResetAccount; COMMIT TRANSACTION`;
        if (!result.recordset[0]?.resetCount) return res.status(400).json({ success: false, message: 'Reset code is invalid, expired, or already used.' });
        res.json({ success: true, message: 'Password updated. You can now sign in.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Could not reset the password.' });
    }
});

app.get('/api/password-reset-requests', requireAuth, requireRole('dean'), async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const result = await sql.query`SELECT r.RequestID AS id, r.UserID AS userId, CONCAT(u.FirstName, ' ', u.LastName) AS name, u.Role AS role, r.RequestedAt AS requestedAt FROM dbo.PasswordResetRequests r INNER JOIN dbo.Users u ON u.UserID = r.UserID WHERE r.Status = 'Pending' ORDER BY r.RequestedAt ASC`;
        res.json({ requests: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load password reset requests.' });
    }
});

app.post('/api/password-reset-requests/:requestId/issue', requireAuth, requireRole('dean'), async (req, res) => {
    const requestId = Number.parseInt(req.params.requestId, 10);
    if (!Number.isInteger(requestId)) return res.status(400).json({ message: 'Invalid password reset request.' });

    try {
        await sql.connect(dbConfig);
        const resetCode = randomBytes(9).toString('base64url');
        const tokenHash = createHash('sha256').update(resetCode).digest('hex');
        const result = await sql.query`UPDATE dbo.PasswordResetRequests SET Status = 'Issued', TokenHash = ${tokenHash}, TokenExpiresAt = DATEADD(MINUTE, 60, SYSUTCDATETIME()), ReviewedAt = SYSUTCDATETIME(), ReviewedByUserID = ${req.user.userId} OUTPUT INSERTED.UserID AS userId WHERE RequestID = ${requestId} AND Status = 'Pending'`;
        if (!result.recordset.length) return res.status(404).json({ message: 'Pending request not found.' });
        res.json({ success: true, userId: result.recordset[0].userId, resetCode, expiresInMinutes: 60 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not issue a reset code.' });
    }
});

app.post('/api/password-reset-requests/:requestId/reject', requireAuth, requireRole('dean'), async (req, res) => {
    const requestId = Number.parseInt(req.params.requestId, 10);
    if (!Number.isInteger(requestId)) return res.status(400).json({ message: 'Invalid password reset request.' });

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`UPDATE dbo.PasswordResetRequests SET Status = 'Rejected', ReviewedAt = SYSUTCDATETIME(), ReviewedByUserID = ${req.user.userId} WHERE RequestID = ${requestId} AND Status = 'Pending'`;
        if (!result.rowsAffected[0]) return res.status(404).json({ message: 'Pending request not found.' });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not reject password reset request.' });
    }
});

// Login Endpoint
app.post('/api/login', async (req, res) => {
    const { userId, password } = req.body;

    if (!userId || !password) {
        return res.status(400).json({ success: false, message: 'Account ID and password are required.' });
    }

    try {
        await sql.connect(dbConfig);
        // Parameterized query para iwas SQL Injection
        const result = await sql.query`SELECT ID, FirstName, LastName, Role, Password, ProfilePicture FROM Users WHERE UserID = ${userId}`;

        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            const isPasswordHash = /^\$2[aby]\$/.test(user.Password);
            const passwordValid = isPasswordHash
                ? await bcrypt.compare(password, user.Password)
                : process.env.NODE_ENV !== 'production' && user.Password === password;
            if (!passwordValid) {
                return res.status(401).json({ success: false, message: 'Invalid account ID or password.' });
            }

            const token = randomBytes(32).toString('hex');
            const role = String(user.Role || '').trim().toLowerCase().replace(/[\s_-]/g, '');
            if (!['student', 'instructor', 'programchair', 'dean'].includes(role)) {
                return res.status(403).json({ success: false, message: 'This account has no supported role.' });
            }
            const normalizedRole = role;
            sessions.set(token, { userId, role: normalizedRole });
            res.json({
                success: true,
                token,
                name: [user.FirstName, user.LastName].filter(Boolean).join(' '),
                role: normalizedRole,
                profilePicture: user.ProfilePicture || null
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid account ID or password.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database connection error.' });
    }
});

function requireAuth(req, res, next) {
    const token = req.get('Authorization')?.replace(/^Bearer\s+/i, '');
    const session = token && sessions.get(token);
    if (!session) return res.status(401).json({ message: 'Please sign in again.' });
    req.user = session;
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'You do not have permission to do this.' });
        next();
    };
}

async function requireOwnedClassroom(req, res, next) {
    const classId = Number.parseInt(req.params.classId, 10);
    if (!Number.isInteger(classId)) return res.status(400).json({ message: 'Invalid classroom.' });

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`SELECT ClassID FROM dbo.Classrooms WHERE ClassID = ${classId} AND InstructorUserID = ${req.user.userId}`;
        if (!result.recordset.length) return res.status(404).json({ message: 'Classroom not found.' });
        req.classId = classId;
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not verify classroom access.' });
    }
}

async function requireManagedProgram(req, res, next) {
    const programId = Number.parseInt(req.params.programId, 10);
    if (!Number.isInteger(programId)) return res.status(400).json({ message: 'Invalid program.' });

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`SELECT p.ProgramID, p.DepartmentID FROM dbo.Programs p INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID WHERE p.ProgramID = ${programId} AND p.ProgramChairUserID = ${req.user.userId} AND d.Code = 'CIT'`;
        if (!result.recordset.length) return res.status(404).json({ message: 'Program not found or outside your assignment.' });
        req.programId = programId;
        req.departmentId = result.recordset[0].DepartmentID;
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not verify program access.' });
    }
}

async function canReadClassroom(classId, user) {
    if (user.role === 'dean') {
        const result = await sql.query`SELECT ClassID FROM dbo.Classrooms WHERE ClassID = ${classId}`;
        return result.recordset.length > 0;
    }
    if (user.role === 'programchair') {
        const result = await sql.query`SELECT c.ClassID FROM dbo.Classrooms c INNER JOIN dbo.Programs p ON p.ProgramID = c.ProgramID WHERE c.ClassID = ${classId} AND p.ProgramChairUserID = ${user.userId}`;
        return result.recordset.length > 0;
    }
    const result = await sql.query`SELECT c.ClassID FROM dbo.Classrooms c LEFT JOIN dbo.ClassroomMemberships m ON m.ClassID = c.ClassID AND m.StudentUserID = ${user.userId} AND m.Status = 'Accepted' WHERE c.ClassID = ${classId} AND (c.InstructorUserID = ${user.userId} OR m.MembershipID IS NOT NULL)`;
    return result.recordset.length > 0;
}

function receiveModuleUpload(req, res, next) {
    moduleUpload.single('moduleFile')(req, res, (error) => {
        if (error) return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Modules must be 20 MB or smaller.' : error.message });
        next();
    });
}

app.post('/api/logout', requireAuth, (req, res) => {
    sessions.delete(req.get('Authorization').replace(/^Bearer\s+/i, ''));
    res.json({ success: true });
});

app.get('/api/me', requireAuth, async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const result = await sql.query`SELECT UserID AS userId, FirstName, LastName, Role, ProfilePicture FROM dbo.Users WHERE UserID = ${req.user.userId}`;
        if (!result.recordset.length) return res.status(404).json({ message: 'Account not found.' });
        const user = result.recordset[0];
        res.json({
            userId: user.userId,
            name: [user.FirstName, user.LastName].filter(Boolean).join(' '),
            firstName: user.FirstName || '',
            lastName: user.LastName || '',
            role: req.user.role,
            profilePicture: user.ProfilePicture || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load your profile.' });
    }
});

app.post('/api/profile/picture', requireAuth, (req, res) => {
    avatarUpload.single('profilePicture')(req, res, async (uploadError) => {
        if (uploadError) {
            return res.status(400).json({ message: uploadError.code === 'LIMIT_FILE_SIZE' ? 'Profile pictures must be 5 MB or smaller.' : uploadError.message });
        }
        if (!req.file) return res.status(400).json({ message: 'Choose an image file to upload.' });

        try {
            await sql.connect(dbConfig);
            const previous = await sql.query`SELECT ProfilePicture FROM dbo.Users WHERE UserID = ${req.user.userId}`;
            const previousPicture = previous.recordset[0]?.ProfilePicture || null;
            await sql.query`UPDATE dbo.Users SET ProfilePicture = ${req.file.filename} WHERE UserID = ${req.user.userId}`;
            if (previousPicture && previousPicture !== req.file.filename) await removeStoredAvatarFile(previousPicture);
            res.json({ success: true, profilePicture: req.file.filename, url: `/uploads/avatars/${req.file.filename}` });
        } catch (err) {
            await removeStoredAvatarFile(req.file.filename);
            console.error(err);
            res.status(500).json({ message: 'Could not update your profile picture.' });
        }
    });
});

app.delete('/api/profile/picture', requireAuth, async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const previous = await sql.query`SELECT ProfilePicture FROM dbo.Users WHERE UserID = ${req.user.userId}`;
        const previousPicture = previous.recordset[0]?.ProfilePicture || null;
        await sql.query`UPDATE dbo.Users SET ProfilePicture = NULL WHERE UserID = ${req.user.userId}`;
        if (previousPicture) await removeStoredAvatarFile(previousPicture);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not remove your profile picture.' });
    }
});

app.get('/api/instructor/activities', requireAuth, requireRole('instructor', 'programchair', 'dean'), async (req, res) => {
    const scopedToChair = req.user.role === 'programchair';
    const scopedToInstructor = req.user.role === 'instructor';

    try {
        await sql.connect(dbConfig);
        const request = new sql.Request();
        request.input('userId', sql.VarChar(50), req.user.userId);
        request.input('scopeInstructor', sql.Bit, scopedToInstructor ? 1 : 0);
        request.input('scopeChair', sql.Bit, scopedToChair ? 1 : 0);
        const result = await request.query(`
            SELECT a.ActivityID AS id, a.Title AS title, a.ActivityType AS activityType, a.DueAt AS dueAt, a.Points AS points, a.CreatedAt AS createdAt,
                c.ClassID AS classId, c.Name AS className, c.CourseCode AS courseCode,
                (SELECT COUNT(*) FROM dbo.ClassroomMemberships m WHERE m.ClassID = c.ClassID AND m.Status = 'Accepted') AS studentCount,
                (SELECT COUNT(*) FROM dbo.ActivitySubmissions s WHERE s.ActivityID = a.ActivityID) AS submissionCount,
                (SELECT COUNT(*) FROM dbo.ActivitySubmissions s WHERE s.ActivityID = a.ActivityID AND s.Grade IS NOT NULL) AS gradedCount
            FROM dbo.ClassroomActivities a
            INNER JOIN dbo.Classrooms c ON c.ClassID = a.ClassID
            INNER JOIN dbo.Programs p ON p.ProgramID = c.ProgramID
            WHERE (@scopeInstructor = 1 AND c.InstructorUserID = @userId)
               OR (@scopeChair = 1 AND p.ProgramChairUserID = @userId)
               OR (@scopeInstructor = 0 AND @scopeChair = 0)
            ORDER BY CASE WHEN a.DueAt IS NULL THEN 1 ELSE 0 END, a.DueAt DESC, a.CreatedAt DESC`);

        const activities = result.recordset.map((activity) => ({
            id: activity.id,
            title: activity.title,
            activityType: activity.activityType,
            dueAt: activity.dueAt,
            points: activity.points,
            createdAt: activity.createdAt,
            classId: activity.classId,
            className: activity.className,
            courseCode: activity.courseCode,
            studentCount: Number(activity.studentCount || 0),
            submissionCount: Number(activity.submissionCount || 0),
            gradedCount: Number(activity.gradedCount || 0),
            pendingCount: Number(activity.submissionCount || 0) - Number(activity.gradedCount || 0)
        }));

        const summary = activities.reduce((totals, activity) => {
            totals.activities += 1;
            totals.submissions += activity.submissionCount;
            totals.graded += activity.gradedCount;
            totals.pending += activity.pendingCount;
            totals.expected += activity.studentCount;
            totals.missing += Math.max(0, activity.studentCount - activity.submissionCount);
            return totals;
        }, { activities: 0, submissions: 0, graded: 0, pending: 0, expected: 0, missing: 0 });

        res.json({ scope: req.user.role, activities, summary });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load activity submissions.' });
    }
});

app.get('/api/reports', requireAuth, requireRole('dean', 'programchair'), async (req, res) => {
    const scopedToChair = req.user.role === 'programchair';
    const programFilter = scopedToChair ? ' AND p.ProgramChairUserID = @chairUserId' : '';

    try {
        await sql.connect(dbConfig);

        const summaryRequest = new sql.Request();
        summaryRequest.input('chairUserId', sql.VarChar(50), req.user.userId);
        const summaryResult = await summaryRequest.query(`
            SELECT
                (SELECT COUNT(*) FROM dbo.Programs p INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID WHERE d.Code = 'CIT'${programFilter}) AS activePrograms,
                (SELECT COUNT(*) FROM dbo.Classrooms c INNER JOIN dbo.Programs p ON p.ProgramID = c.ProgramID INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID WHERE d.Code = 'CIT'${programFilter}) AS activeCourses,
                (SELECT COUNT(DISTINCT i.UserID) FROM dbo.Classrooms c INNER JOIN dbo.Users i ON i.UserID = c.InstructorUserID INNER JOIN dbo.Programs p ON p.ProgramID = c.ProgramID INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID WHERE d.Code = 'CIT'${programFilter}) AS activeFaculty,
                (SELECT COUNT(*) FROM dbo.ClassroomMemberships m INNER JOIN dbo.Classrooms c ON c.ClassID = m.ClassID INNER JOIN dbo.Programs p ON p.ProgramID = c.ProgramID INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID WHERE m.Status = 'Accepted' AND d.Code = 'CIT'${programFilter}) AS enrolledStudents,
                (SELECT COUNT(*) FROM dbo.ActivitySubmissions s INNER JOIN dbo.ClassroomActivities a ON a.ActivityID = s.ActivityID INNER JOIN dbo.Classrooms c ON c.ClassID = a.ClassID INNER JOIN dbo.Programs p ON p.ProgramID = c.ProgramID INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID WHERE d.Code = 'CIT'${programFilter}) AS submissionsReceived,
                (SELECT COUNT(*) FROM dbo.ActivitySubmissions s INNER JOIN dbo.ClassroomActivities a ON a.ActivityID = s.ActivityID INNER JOIN dbo.Classrooms c ON c.ClassID = a.ClassID INNER JOIN dbo.Programs p ON p.ProgramID = c.ProgramID INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID WHERE s.Grade IS NOT NULL AND d.Code = 'CIT'${programFilter}) AS gradedSubmissions,
                (SELECT COUNT(*) FROM dbo.ClassroomActivities a INNER JOIN dbo.Classrooms c ON c.ClassID = a.ClassID INNER JOIN dbo.Programs p ON p.ProgramID = c.ProgramID INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID WHERE a.DueAt IS NOT NULL AND a.DueAt < SYSUTCDATETIME() AND d.Code = 'CIT'${programFilter}) AS pastDueActivities`);

        const summary = summaryResult.recordset[0] || {};
        const enrolledStudents = Number(summary.enrolledStudents || 0);
        const activeCourses = Number(summary.activeCourses || 0);
        const submissionsReceived = Number(summary.submissionsReceived || 0);
        const gradedSubmissions = Number(summary.gradedSubmissions || 0);
        const pastDueActivities = Number(summary.pastDueActivities || 0);

        const programRequest = new sql.Request();
        programRequest.input('chairUserId', sql.VarChar(50), req.user.userId);
        const programResult = await programRequest.query(`
            SELECT p.ProgramID AS id, p.Name AS name,
                (SELECT COUNT(DISTINCT c.ClassID) FROM dbo.Classrooms c WHERE c.ProgramID = p.ProgramID) AS subjectCount,
                (SELECT COUNT(*) FROM dbo.ProgramCourses pc WHERE pc.ProgramID = p.ProgramID) AS courseCount,
                (SELECT COUNT(*) FROM dbo.ClassroomMemberships m INNER JOIN dbo.Classrooms c ON c.ClassID = m.ClassID WHERE c.ProgramID = p.ProgramID AND m.Status = 'Accepted') AS studentCount,
                (SELECT COUNT(DISTINCT c.InstructorUserID) FROM dbo.Classrooms c WHERE c.ProgramID = p.ProgramID) AS facultyCount,
                (SELECT COUNT(*) FROM dbo.ActivitySubmissions s INNER JOIN dbo.ClassroomActivities a ON a.ActivityID = s.ActivityID INNER JOIN dbo.Classrooms c ON c.ClassID = a.ClassID WHERE c.ProgramID = p.ProgramID) AS submissionCount,
                (SELECT COUNT(*) FROM dbo.ActivitySubmissions s INNER JOIN dbo.ClassroomActivities a ON a.ActivityID = s.ActivityID INNER JOIN dbo.Classrooms c ON c.ClassID = a.ClassID WHERE c.ProgramID = p.ProgramID AND s.Grade IS NOT NULL) AS gradedCount
            FROM dbo.Programs p
            INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID
            WHERE d.Code = 'CIT'${programFilter}
            ORDER BY p.Name`);

        const perCourseRequest = new sql.Request();
        perCourseRequest.input('chairUserId', sql.VarChar(50), req.user.userId);
        const perCourseResult = await perCourseRequest.query(`
            SELECT c.ClassID AS id, c.Name AS name, c.CourseCode AS courseCode, p.Name AS programName, CONCAT(i.FirstName, ' ', i.LastName) AS instructorName,
                COUNT(CASE WHEN m.Status = 'Accepted' THEN 1 END) AS studentCount,
                (SELECT COUNT(*) FROM dbo.ClassroomActivities a WHERE a.ClassID = c.ClassID) AS activityCount,
                (SELECT COUNT(*) FROM dbo.ActivitySubmissions s INNER JOIN dbo.ClassroomActivities a ON a.ActivityID = s.ActivityID WHERE a.ClassID = c.ClassID) AS submissionCount,
                (SELECT COUNT(*) FROM dbo.ActivitySubmissions s INNER JOIN dbo.ClassroomActivities a ON a.ActivityID = s.ActivityID WHERE a.ClassID = c.ClassID AND s.Grade IS NOT NULL) AS gradedCount,
                (SELECT COUNT(*) FROM dbo.ClassroomModules cm WHERE cm.ClassID = c.ClassID) AS moduleCount
            FROM dbo.Classrooms c
            INNER JOIN dbo.Programs p ON p.ProgramID = c.ProgramID
            INNER JOIN dbo.Users i ON i.UserID = c.InstructorUserID
            INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID
            LEFT JOIN dbo.ClassroomMemberships m ON m.ClassID = c.ClassID
            WHERE d.Code = 'CIT'${programFilter}
            GROUP BY c.ClassID, c.Name, c.CourseCode, p.Name, i.FirstName, i.LastName
            ORDER BY p.Name, c.CourseCode`);

        const pct = (numerator, denominator) => (denominator > 0 ? Math.round((numerator / denominator) * 100) : 0);

        const programs = programResult.recordset.map((program) => ({
            id: program.id,
            name: program.name,
            subjectCount: Number(program.subjectCount || 0),
            courseCount: Number(program.courseCount || 0),
            studentCount: Number(program.studentCount || 0),
            facultyCount: Number(program.facultyCount || 0),
            submissionCount: Number(program.submissionCount || 0),
            gradedCount: Number(program.gradedCount || 0),
            gradingProgress: pct(Number(program.gradedCount || 0), Number(program.submissionCount || 0))
        }));

        const courses = perCourseResult.recordset.map((course) => ({
            id: course.id,
            name: course.name,
            courseCode: course.courseCode,
            programName: course.programName,
            instructorName: course.instructorName,
            studentCount: Number(course.studentCount || 0),
            activityCount: Number(course.activityCount || 0),
            submissionCount: Number(course.submissionCount || 0),
            gradedCount: Number(course.gradedCount || 0),
            moduleCount: Number(course.moduleCount || 0)
        }));

        const expectedSubmissions = courses.reduce((total, course) => total + course.activityCount * course.studentCount, 0);

        res.json({
            scope: scopedToChair ? 'programchair' : 'dean',
            generatedAt: new Date().toISOString(),
            summary: {
                activePrograms: Number(summary.activePrograms || 0),
                activeCourses,
                activeFaculty: Number(summary.activeFaculty || 0),
                enrolledStudents,
                expectedSubmissions,
                submissionsReceived,
                gradedSubmissions,
                pendingGrading: submissionsReceived - gradedSubmissions,
                pastDueActivities,
                submissionRate: pct(submissionsReceived, expectedSubmissions),
                gradingRate: pct(gradedSubmissions, submissionsReceived),
                completionRate: pct(gradedSubmissions, expectedSubmissions),
                averageClassSize: activeCourses > 0 ? Math.round(enrolledStudents / activeCourses) : 0
            },
            programs,
            courses
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not build the academic report.' });
    }
});

app.get('/api/classrooms', requireAuth, async (req, res) => {
    try {
        await sql.connect(dbConfig);
        if (req.user.role === 'student') {
            const result = await sql.query`SELECT c.ClassID AS id, c.Name AS name, c.CourseCode AS courseCode, c.Description AS description, c.ProgramID AS programId, p.Name AS programName, c.ProgramCourseID AS programCourseId, pc.Name AS programCourseName, c.SubjectType AS subjectType, c.YearLevel AS yearLevel, CONCAT(i.FirstName, ' ', i.LastName) AS instructorName, m.Status AS membershipStatus FROM dbo.Classrooms c INNER JOIN dbo.Users i ON i.UserID = c.InstructorUserID LEFT JOIN dbo.Programs p ON p.ProgramID = c.ProgramID LEFT JOIN dbo.ProgramCourses pc ON pc.ProgramCourseID = c.ProgramCourseID LEFT JOIN dbo.ClassroomMemberships m ON m.ClassID = c.ClassID AND m.StudentUserID = ${req.user.userId} ORDER BY c.CreatedAt DESC`;
            return res.json({ classrooms: result.recordset });
        }

        let result;
        if (req.user.role === 'instructor') {
            result = await sql.query`SELECT c.ClassID AS id, c.Name AS name, c.CourseCode AS courseCode, c.Description AS description, c.ProgramID AS programId, p.Name AS programName, c.ProgramCourseID AS programCourseId, pc.Name AS programCourseName, c.SubjectType AS subjectType, c.YearLevel AS yearLevel, COUNT(CASE WHEN m.Status = 'Accepted' THEN 1 END) AS studentCount, COUNT(CASE WHEN m.Status = 'Pending' THEN 1 END) AS pendingCount, (SELECT COUNT(*) FROM dbo.ClassroomModules cm WHERE cm.ClassID = c.ClassID) AS moduleCount, (SELECT COUNT(*) FROM dbo.ClassroomActivities a WHERE a.ClassID = c.ClassID) AS activityCount FROM dbo.Classrooms c LEFT JOIN dbo.Programs p ON p.ProgramID = c.ProgramID LEFT JOIN dbo.ProgramCourses pc ON pc.ProgramCourseID = c.ProgramCourseID LEFT JOIN dbo.ClassroomMemberships m ON m.ClassID = c.ClassID WHERE c.InstructorUserID = ${req.user.userId} GROUP BY c.ClassID, c.Name, c.CourseCode, c.Description, c.ProgramID, p.Name, c.ProgramCourseID, pc.Name, c.SubjectType, c.YearLevel, c.CreatedAt ORDER BY c.CreatedAt DESC`;
        } else if (req.user.role === 'programchair') {
            result = await sql.query`SELECT c.ClassID AS id, c.Name AS name, c.CourseCode AS courseCode, c.Description AS description, c.ProgramID AS programId, p.Name AS programName, c.ProgramCourseID AS programCourseId, pc.Name AS programCourseName, c.SubjectType AS subjectType, c.YearLevel AS yearLevel, c.InstructorUserID AS instructorUserId, CONCAT(i.FirstName, ' ', i.LastName) AS instructorName, COUNT(CASE WHEN m.Status = 'Accepted' THEN 1 END) AS studentCount, COUNT(CASE WHEN m.Status = 'Pending' THEN 1 END) AS pendingCount, (SELECT COUNT(*) FROM dbo.ClassroomModules cm WHERE cm.ClassID = c.ClassID) AS moduleCount, (SELECT COUNT(*) FROM dbo.ClassroomActivities a WHERE a.ClassID = c.ClassID) AS activityCount FROM dbo.Classrooms c INNER JOIN dbo.Programs p ON p.ProgramID = c.ProgramID INNER JOIN dbo.Users i ON i.UserID = c.InstructorUserID LEFT JOIN dbo.ProgramCourses pc ON pc.ProgramCourseID = c.ProgramCourseID LEFT JOIN dbo.ClassroomMemberships m ON m.ClassID = c.ClassID WHERE p.ProgramChairUserID = ${req.user.userId} GROUP BY c.ClassID, c.Name, c.CourseCode, c.Description, c.ProgramID, p.Name, c.ProgramCourseID, pc.Name, c.SubjectType, c.YearLevel, c.InstructorUserID, i.FirstName, i.LastName, c.CreatedAt ORDER BY c.CreatedAt DESC`;
        } else {
            result = await sql.query`SELECT c.ClassID AS id, c.Name AS name, c.CourseCode AS courseCode, c.Description AS description, c.ProgramID AS programId, p.Name AS programName, c.ProgramCourseID AS programCourseId, pc.Name AS programCourseName, c.SubjectType AS subjectType, c.YearLevel AS yearLevel, CONCAT(i.FirstName, ' ', i.LastName) AS instructorName, COUNT(CASE WHEN m.Status = 'Accepted' THEN 1 END) AS studentCount, COUNT(CASE WHEN m.Status = 'Pending' THEN 1 END) AS pendingCount, (SELECT COUNT(*) FROM dbo.ClassroomModules cm WHERE cm.ClassID = c.ClassID) AS moduleCount, (SELECT COUNT(*) FROM dbo.ClassroomActivities a WHERE a.ClassID = c.ClassID) AS activityCount FROM dbo.Classrooms c INNER JOIN dbo.Users i ON i.UserID = c.InstructorUserID LEFT JOIN dbo.Programs p ON p.ProgramID = c.ProgramID LEFT JOIN dbo.ProgramCourses pc ON pc.ProgramCourseID = c.ProgramCourseID LEFT JOIN dbo.ClassroomMemberships m ON m.ClassID = c.ClassID GROUP BY c.ClassID, c.Name, c.CourseCode, c.Description, c.ProgramID, p.Name, c.ProgramCourseID, pc.Name, c.SubjectType, c.YearLevel, i.FirstName, i.LastName, c.CreatedAt ORDER BY c.CreatedAt DESC`;
        }
        res.json({ classrooms: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load classrooms.' });
    }
});

app.post('/api/classrooms', requireAuth, requireRole('instructor'), async (req, res) => {
    const name = String(req.body.name || '').trim();
    const courseCode = String(req.body.courseCode || '').trim();
    const description = String(req.body.description || '').trim();
    if (!name || !courseCode) return res.status(400).json({ message: 'Class name and course code are required.' });

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`INSERT INTO dbo.Classrooms (Name, CourseCode, Description, InstructorUserID) OUTPUT INSERTED.ClassID AS id VALUES (${name}, ${courseCode}, ${description || null}, ${req.user.userId})`;
        res.status(201).json({ success: true, id: result.recordset[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not create classroom.' });
    }
});

app.post('/api/classrooms/:classId/join', requireAuth, requireRole('student'), async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    if (!Number.isInteger(classId)) return res.status(400).json({ message: 'Invalid classroom.' });

    try {
        await sql.connect(dbConfig);
        const existing = await sql.query`SELECT MembershipID, Status FROM dbo.ClassroomMemberships WHERE ClassID = ${classId} AND StudentUserID = ${req.user.userId}`;
        if (existing.recordset.length) {
            const status = existing.recordset[0].Status;
            return res.status(409).json({ message: status === 'Accepted' ? 'You are already in this class.' : 'Your request is already waiting for approval.' });
        }

        const classroom = await sql.query`SELECT ClassID FROM dbo.Classrooms WHERE ClassID = ${classId}`;
        if (!classroom.recordset.length) return res.status(404).json({ message: 'Classroom not found.' });
        await sql.query`INSERT INTO dbo.ClassroomMemberships (ClassID, StudentUserID) VALUES (${classId}, ${req.user.userId})`;
        res.status(201).json({ success: true, status: 'Pending' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not send join request.' });
    }
});

app.get('/api/classroom-requests', requireAuth, requireRole('instructor'), async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const result = await sql.query`SELECT m.MembershipID AS id, m.ClassID AS classId, c.Name AS className, c.CourseCode AS courseCode, u.UserID AS studentUserId, CONCAT(u.FirstName, ' ', u.LastName) AS studentName, m.RequestedAt AS requestedAt FROM dbo.ClassroomMemberships m INNER JOIN dbo.Classrooms c ON c.ClassID = m.ClassID INNER JOIN dbo.Users u ON u.UserID = m.StudentUserID WHERE c.InstructorUserID = ${req.user.userId} AND m.Status = 'Pending' ORDER BY m.RequestedAt ASC`;
        res.json({ requests: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load join requests.' });
    }
});

app.post('/api/classroom-requests/:requestId/accept', requireAuth, requireRole('instructor'), async (req, res) => {
    const requestId = Number.parseInt(req.params.requestId, 10);
    if (!Number.isInteger(requestId)) return res.status(400).json({ message: 'Invalid request.' });

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`UPDATE m SET Status = 'Accepted', ReviewedAt = SYSUTCDATETIME() FROM dbo.ClassroomMemberships m INNER JOIN dbo.Classrooms c ON c.ClassID = m.ClassID WHERE m.MembershipID = ${requestId} AND m.Status = 'Pending' AND c.InstructorUserID = ${req.user.userId}`;
        if (!result.rowsAffected[0]) return res.status(404).json({ message: 'Request not found for your classrooms.' });
        res.json({ success: true, status: 'Accepted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not accept join request.' });
    }
});

app.get('/api/classrooms/:classId/messages', requireAuth, requireRole('student', 'instructor', 'programchair', 'dean'), async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    if (!Number.isInteger(classId)) return res.status(400).json({ message: 'Invalid classroom.' });

    try {
        await sql.connect(dbConfig);
        if (!await canReadClassroom(classId, req.user)) return res.status(404).json({ message: 'Classroom not found or access denied.' });

        const result = await sql.query`SELECT TOP (100) m.MessageID AS id, m.SenderUserID AS senderUserId, CONCAT(u.FirstName, ' ', u.LastName) AS senderName, m.Message AS message, m.SentAt AS sentAt FROM dbo.ClassroomMessages m INNER JOIN dbo.Users u ON u.UserID = m.SenderUserID WHERE m.ClassID = ${classId} ORDER BY m.SentAt DESC, m.MessageID DESC`;
        res.json({ messages: result.recordset.reverse() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load classroom messages.' });
    }
});

app.post('/api/classrooms/:classId/messages', requireAuth, requireRole('student', 'instructor'), async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    const message = String(req.body.message || '').trim();
    if (!Number.isInteger(classId)) return res.status(400).json({ message: 'Invalid classroom.' });
    if (!message || message.length > 2000) return res.status(400).json({ message: 'Messages must be between 1 and 2000 characters.' });

    try {
        await sql.connect(dbConfig);
        const access = await sql.query`SELECT c.ClassID FROM dbo.Classrooms c LEFT JOIN dbo.ClassroomMemberships m ON m.ClassID = c.ClassID AND m.StudentUserID = ${req.user.userId} AND m.Status = 'Accepted' WHERE c.ClassID = ${classId} AND (c.InstructorUserID = ${req.user.userId} OR m.MembershipID IS NOT NULL)`;
        if (!access.recordset.length) return res.status(404).json({ message: 'Classroom not found or access denied.' });

        const result = await sql.query`INSERT INTO dbo.ClassroomMessages (ClassID, SenderUserID, Message) OUTPUT INSERTED.MessageID AS id, INSERTED.SenderUserID AS senderUserId, INSERTED.Message AS message, INSERTED.SentAt AS sentAt VALUES (${classId}, ${req.user.userId}, ${message})`;
        res.status(201).json({ success: true, message: result.recordset[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not send classroom message.' });
    }
});

app.get('/api/classrooms/:classId/modules', requireAuth, requireRole('student', 'instructor', 'programchair', 'dean'), async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    if (!Number.isInteger(classId)) return res.status(400).json({ message: 'Invalid classroom.' });

    try {
        await sql.connect(dbConfig);
        if (!await canReadClassroom(classId, req.user)) return res.status(404).json({ message: 'Classroom not found or access denied.' });

        const result = await sql.query`SELECT cm.ModuleID AS id, cm.Title AS title, cm.Description AS description, cm.FileName AS fileName, cm.FileSize AS fileSize, cm.UploadedAt AS uploadedAt, CONCAT(u.FirstName, ' ', u.LastName) AS uploadedBy FROM dbo.ClassroomModules cm INNER JOIN dbo.Users u ON u.UserID = cm.UploadedByUserID WHERE cm.ClassID = ${classId} ORDER BY cm.UploadedAt DESC, cm.ModuleID DESC`;
        res.json({ modules: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load classroom modules.' });
    }
});

app.post('/api/classrooms/:classId/modules', requireAuth, requireRole('instructor'), requireOwnedClassroom, receiveModuleUpload, async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Choose a module file to upload.' });
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    if (!title || title.length > 120 || description.length > 500) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ message: 'Enter a title up to 120 characters and a description up to 500 characters.' });
    }

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`INSERT INTO dbo.ClassroomModules (ClassID, Title, Description, FileName, StoredFileName, FileSize, UploadedByUserID) OUTPUT INSERTED.ModuleID AS id VALUES (${req.classId}, ${title}, ${description || null}, ${req.file.originalname}, ${req.file.filename}, ${req.file.size}, ${req.user.userId})`;
        res.status(201).json({ success: true, id: result.recordset[0].id });
    } catch (err) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        console.error(err);
        res.status(500).json({ message: 'Could not save classroom module.' });
    }
});

app.get('/api/classrooms/:classId/modules/:moduleId/download', requireAuth, requireRole('student', 'instructor', 'programchair', 'dean'), async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    const moduleId = Number.parseInt(req.params.moduleId, 10);
    if (!Number.isInteger(classId) || !Number.isInteger(moduleId)) return res.status(400).json({ message: 'Invalid classroom module.' });

    try {
        await sql.connect(dbConfig);
        if (!await canReadClassroom(classId, req.user)) return res.status(404).json({ message: 'Module not found or access denied.' });
        const result = await sql.query`SELECT FileName AS fileName, StoredFileName AS storedFileName FROM dbo.ClassroomModules WHERE ModuleID = ${moduleId} AND ClassID = ${classId}`;
        if (!result.recordset.length) return res.status(404).json({ message: 'Module not found or access denied.' });

        const { fileName, storedFileName } = result.recordset[0];
        if (!/^[a-f0-9]{32}\.[a-z0-9]+$/i.test(storedFileName)) return res.status(500).json({ message: 'Stored module file is invalid.' });
        res.download(path.join(moduleUploadDirectory, storedFileName), fileName, (error) => {
            if (error && !res.headersSent) res.status(404).json({ message: 'Module file is unavailable.' });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not download classroom module.' });
    }
});

app.post('/api/classrooms/:classId/students', requireAuth, requireRole('instructor'), requireOwnedClassroom, async (req, res) => {
    const studentUserId = String(req.body.studentUserId || '').trim();
    if (!studentUserId || studentUserId.length > 50) return res.status(400).json({ message: 'Enter the student account ID.' });

    try {
        await sql.connect(dbConfig);
        const student = await sql.query`SELECT UserID FROM dbo.Users WHERE UserID = ${studentUserId} AND LOWER(Role) = 'student'`;
        if (!student.recordset.length) return res.status(404).json({ message: 'No student account matches that ID.' });
        const existing = await sql.query`SELECT MembershipID, Status FROM dbo.ClassroomMemberships WHERE ClassID = ${req.classId} AND StudentUserID = ${studentUserId}`;
        if (existing.recordset[0]?.Status === 'Accepted') return res.status(409).json({ message: 'That student is already enrolled.' });
        if (existing.recordset.length) {
            await sql.query`UPDATE dbo.ClassroomMemberships SET Status = 'Accepted', ReviewedAt = SYSUTCDATETIME() WHERE MembershipID = ${existing.recordset[0].MembershipID}`;
        } else {
            await sql.query`INSERT INTO dbo.ClassroomMemberships (ClassID, StudentUserID, Status, ReviewedAt) VALUES (${req.classId}, ${studentUserId}, 'Accepted', SYSUTCDATETIME())`;
        }
        res.status(201).json({ success: true, status: 'Accepted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not add the student.' });
    }
});

app.delete('/api/classrooms/:classId/membership', requireAuth, requireRole('student'), async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    if (!Number.isInteger(classId)) return res.status(400).json({ message: 'Invalid classroom.' });

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`DELETE FROM dbo.ClassroomMemberships WHERE ClassID = ${classId} AND StudentUserID = ${req.user.userId}`;
        if (!result.rowsAffected[0]) return res.status(404).json({ message: 'You are not a member of this classroom.' });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not leave the classroom.' });
    }
});

app.delete('/api/classrooms/:classId/students/:studentUserId', requireAuth, requireRole('instructor'), requireOwnedClassroom, async (req, res) => {
    const studentUserId = String(req.params.studentUserId || '').trim();
    if (!studentUserId || studentUserId.length > 50) return res.status(400).json({ message: 'Invalid student account ID.' });

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`DELETE FROM dbo.ClassroomMemberships WHERE ClassID = ${req.classId} AND StudentUserID = ${studentUserId} AND Status = 'Accepted'`;
        if (!result.rowsAffected[0]) return res.status(404).json({ message: 'Enrolled student not found in your classroom.' });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not remove the student from this classroom.' });
    }
});

app.get('/api/classrooms/:classId/activities', requireAuth, requireRole('student', 'instructor', 'programchair', 'dean'), async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    if (!Number.isInteger(classId)) return res.status(400).json({ message: 'Invalid classroom.' });

    try {
        await sql.connect(dbConfig);
        if (!await canReadClassroom(classId, req.user)) return res.status(404).json({ message: 'Classroom not found or access denied.' });
        const result = await sql.query`SELECT a.ActivityID AS id, a.Title AS title, a.Instructions AS instructions, a.ActivityType AS activityType, a.DueAt AS dueAt, a.Points AS points, a.CreatedAt AS createdAt, s.Answer AS answer, s.SubmittedAt AS submittedAt, s.Grade AS grade, s.Feedback AS feedback, (SELECT COUNT(*) FROM dbo.ActivitySubmissions allS WHERE allS.ActivityID = a.ActivityID) AS submissionCount FROM dbo.ClassroomActivities a LEFT JOIN dbo.ActivitySubmissions s ON s.ActivityID = a.ActivityID AND s.StudentUserID = ${req.user.userId} WHERE a.ClassID = ${classId} ORDER BY a.DueAt, a.CreatedAt DESC`;
        res.json({ activities: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load classroom activities.' });
    }
});

app.post('/api/classrooms/:classId/activities', requireAuth, requireRole('instructor'), requireOwnedClassroom, async (req, res) => {
    const title = String(req.body.title || '').trim();
    const instructions = String(req.body.instructions || '').trim();
    const activityType = String(req.body.activityType || 'Assignment');
    const points = Number(req.body.points || 100);
    const dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;
    if (!title || title.length > 160 || !instructions || instructions.length > 2000) return res.status(400).json({ message: 'Enter a title and instructions for the activity.' });
    if (!['Assignment', 'Quiz'].includes(activityType)) return res.status(400).json({ message: 'Choose Assignment or Quiz.' });
    if (!Number.isFinite(points) || points < 1 || points > 1000) return res.status(400).json({ message: 'Points must be between 1 and 1000.' });
    if (dueAt && Number.isNaN(dueAt.getTime())) return res.status(400).json({ message: 'Enter a valid due date.' });

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`INSERT INTO dbo.ClassroomActivities (ClassID, Title, Instructions, ActivityType, DueAt, Points, CreatedByUserID) OUTPUT INSERTED.ActivityID AS id VALUES (${req.classId}, ${title}, ${instructions}, ${activityType}, ${dueAt}, ${points}, ${req.user.userId})`;
        res.status(201).json({ success: true, id: result.recordset[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not create classroom activity.' });
    }
});

app.post('/api/classrooms/:classId/activities/:activityId/submissions', requireAuth, requireRole('student'), async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    const activityId = Number.parseInt(req.params.activityId, 10);
    const answer = String(req.body.answer || '').trim();
    if (!Number.isInteger(classId) || !Number.isInteger(activityId)) return res.status(400).json({ message: 'Invalid classroom activity.' });
    if (!answer || answer.length > 12000) return res.status(400).json({ message: 'Enter an answer up to 12000 characters.' });

    const transaction = new sql.Transaction();
    let transactionActive = false;
    try {
        await sql.connect(dbConfig);
        await transaction.begin();
        transactionActive = true;

        const activityRequest = transaction.request();
        activityRequest.input('activityId', sql.Int, activityId);
        activityRequest.input('classId', sql.Int, classId);
        activityRequest.input('studentUserId', sql.VarChar(50), req.user.userId);
        const activity = await activityRequest.query("SELECT a.ActivityID AS id, CASE WHEN a.DueAt IS NOT NULL AND a.DueAt <= SYSUTCDATETIME() THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS isPastDue FROM dbo.ClassroomActivities a WITH (UPDLOCK, HOLDLOCK) INNER JOIN dbo.ClassroomMemberships m ON m.ClassID = a.ClassID AND m.StudentUserID = @studentUserId AND m.Status = 'Accepted' WHERE a.ActivityID = @activityId AND a.ClassID = @classId");
        if (!activity.recordset.length) {
            await transaction.rollback();
            transactionActive = false;
            return res.status(404).json({ message: 'Activity not found or classroom access denied.' });
        }
        if (activity.recordset[0].isPastDue) {
            await transaction.rollback();
            transactionActive = false;
            return res.status(409).json({ message: 'The due date has passed. Answers can no longer be submitted or edited.' });
        }

        const submissionRequest = transaction.request();
        submissionRequest.input('activityId', sql.Int, activityId);
        submissionRequest.input('studentUserId', sql.VarChar(50), req.user.userId);
        submissionRequest.input('answer', sql.NVarChar(sql.MAX), answer);
        await submissionRequest.query("IF EXISTS (SELECT 1 FROM dbo.ActivitySubmissions WHERE ActivityID = @activityId AND StudentUserID = @studentUserId) UPDATE dbo.ActivitySubmissions SET Answer = @answer, SubmittedAt = SYSUTCDATETIME(), Grade = NULL, Feedback = NULL, GradedAt = NULL WHERE ActivityID = @activityId AND StudentUserID = @studentUserId ELSE INSERT INTO dbo.ActivitySubmissions (ActivityID, StudentUserID, Answer) VALUES (@activityId, @studentUserId, @answer)");
        await transaction.commit();
        transactionActive = false;
        res.status(201).json({ success: true });
    } catch (err) {
        if (transactionActive) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error(rollbackError);
            }
        }
        console.error(err);
        res.status(500).json({ message: 'Could not submit the activity.' });
    }
});

app.get('/api/classrooms/:classId/activities/:activityId/submissions', requireAuth, requireRole('instructor', 'programchair', 'dean'), async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    const activityId = Number.parseInt(req.params.activityId, 10);
    if (!Number.isInteger(classId) || !Number.isInteger(activityId)) return res.status(400).json({ message: 'Invalid classroom activity.' });

    try {
        await sql.connect(dbConfig);
        if (!await canReadClassroom(classId, req.user)) return res.status(404).json({ message: 'Classroom not found or access denied.' });
        const result = await sql.query`SELECT s.SubmissionID AS id, s.StudentUserID AS studentUserId, CONCAT(u.FirstName, ' ', u.LastName) AS studentName, s.Answer AS answer, s.SubmittedAt AS submittedAt, s.Grade AS grade, s.Feedback AS feedback, a.Points AS points FROM dbo.ActivitySubmissions s INNER JOIN dbo.Users u ON u.UserID = s.StudentUserID INNER JOIN dbo.ClassroomActivities a ON a.ActivityID = s.ActivityID WHERE s.ActivityID = ${activityId} AND a.ClassID = ${classId} ORDER BY s.SubmittedAt`;
        res.json({ submissions: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load activity submissions.' });
    }
});

app.post('/api/classrooms/:classId/activities/:activityId/submissions/:submissionId/grade', requireAuth, requireRole('instructor'), async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    const activityId = Number.parseInt(req.params.activityId, 10);
    const submissionId = Number.parseInt(req.params.submissionId, 10);
    const grade = Number(req.body.grade);
    const feedback = String(req.body.feedback || '').trim();
    if (!Number.isInteger(classId) || !Number.isInteger(activityId) || !Number.isInteger(submissionId)) return res.status(400).json({ message: 'Invalid submission.' });
    if (!Number.isFinite(grade) || grade < 0 || feedback.length > 1000) return res.status(400).json({ message: 'Enter a valid grade and feedback.' });

    try {
        await sql.connect(dbConfig);
        const gradeRequest = new sql.Request();
        gradeRequest.input('grade', sql.Decimal(8, 2), grade);
        gradeRequest.input('feedback', sql.NVarChar(1000), feedback || null);
        gradeRequest.input('submissionId', sql.Int, submissionId);
        gradeRequest.input('activityId', sql.Int, activityId);
        gradeRequest.input('classId', sql.Int, classId);
        gradeRequest.input('instructorUserId', sql.VarChar(50), req.user.userId);
        const result = await gradeRequest.query("UPDATE s SET Grade = @grade, Feedback = @feedback, GradedAt = SYSUTCDATETIME() FROM dbo.ActivitySubmissions s INNER JOIN dbo.ClassroomActivities a ON a.ActivityID = s.ActivityID INNER JOIN dbo.Classrooms c ON c.ClassID = a.ClassID WHERE s.SubmissionID = @submissionId AND a.ActivityID = @activityId AND c.ClassID = @classId AND c.InstructorUserID = @instructorUserId AND @grade <= a.Points");
        if (!result.rowsAffected[0]) return res.status(400).json({ message: 'Submission not found, or the grade exceeds the activity points.' });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not grade submission.' });
    }
});

app.get('/api/classrooms/:classId/announcements', requireAuth, requireRole('student', 'instructor', 'programchair', 'dean'), async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    if (!Number.isInteger(classId)) return res.status(400).json({ message: 'Invalid classroom.' });

    try {
        await sql.connect(dbConfig);
        if (!await canReadClassroom(classId, req.user)) return res.status(404).json({ message: 'Classroom not found or access denied.' });
        const result = await sql.query`SELECT a.AnnouncementID AS id, a.Title AS title, a.Message AS message, a.PostedAt AS postedAt, CONCAT(u.FirstName, ' ', u.LastName) AS postedBy FROM dbo.ClassroomAnnouncements a INNER JOIN dbo.Users u ON u.UserID = a.PostedByUserID WHERE a.ClassID = ${classId} ORDER BY a.PostedAt DESC, a.AnnouncementID DESC`;
        res.json({ announcements: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load classroom announcements.' });
    }
});

app.post('/api/classrooms/:classId/announcements', requireAuth, requireRole('instructor'), requireOwnedClassroom, async (req, res) => {
    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || '').trim();
    if (!title || title.length > 160 || !message || message.length > 2000) return res.status(400).json({ message: 'Enter a title and announcement up to 2000 characters.' });

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`INSERT INTO dbo.ClassroomAnnouncements (ClassID, Title, Message, PostedByUserID) OUTPUT INSERTED.AnnouncementID AS id VALUES (${req.classId}, ${title}, ${message}, ${req.user.userId})`;
        res.status(201).json({ success: true, id: result.recordset[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not post announcement.' });
    }
});

app.get('/api/announcements', requireAuth, requireRole('student', 'instructor', 'programchair', 'dean'), async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const result = await sql.query`SELECT a.AnnouncementID AS id, a.Title AS title, a.Message AS message, a.PostedAt AS postedAt, CONCAT(u.FirstName, ' ', u.LastName) AS postedBy, c.ClassID AS classId, c.Name AS subjectName, c.CourseCode AS courseCode, p.Name AS programName, pc.Name AS programCourseName, c.SubjectType AS subjectType FROM dbo.ClassroomAnnouncements a INNER JOIN dbo.Classrooms c ON c.ClassID = a.ClassID INNER JOIN dbo.Users u ON u.UserID = a.PostedByUserID LEFT JOIN dbo.Programs p ON p.ProgramID = c.ProgramID LEFT JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID LEFT JOIN dbo.ProgramCourses pc ON pc.ProgramCourseID = c.ProgramCourseID WHERE (${req.user.role} = 'dean' AND d.Code = 'CIT') OR (${req.user.role} = 'programchair' AND p.ProgramChairUserID = ${req.user.userId}) OR (${req.user.role} = 'instructor' AND c.InstructorUserID = ${req.user.userId}) OR (${req.user.role} = 'student' AND EXISTS (SELECT 1 FROM dbo.ClassroomMemberships m WHERE m.ClassID = c.ClassID AND m.StudentUserID = ${req.user.userId} AND m.Status = 'Accepted')) ORDER BY a.PostedAt DESC, a.AnnouncementID DESC`;
        res.json({ announcements: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load announcements.' });
    }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => {
    console.log(`LMS server is running on port ${port}`);
});

app.get('/api/programs', requireAuth, requireRole('dean', 'programchair'), async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const result = req.user.role === 'programchair'
            ? await sql.query`SELECT p.ProgramID AS id, p.Name AS name, p.DepartmentID AS departmentId, d.Code AS departmentCode, d.Name AS departmentName, p.ProgramChairUserID AS programChairUserId, COUNT(DISTINCT c.ClassID) AS subjectCount FROM dbo.Programs p INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID LEFT JOIN dbo.Classrooms c ON c.ProgramID = p.ProgramID WHERE p.ProgramChairUserID = ${req.user.userId} AND d.Code = 'CIT' GROUP BY p.ProgramID, p.Name, p.DepartmentID, d.Code, d.Name, p.ProgramChairUserID ORDER BY p.Name`
            : await sql.query`SELECT p.ProgramID AS id, p.Name AS name, p.DepartmentID AS departmentId, d.Code AS departmentCode, d.Name AS departmentName, p.ProgramChairUserID AS programChairUserId, CONCAT(u.FirstName, ' ', u.LastName) AS programChairName, COUNT(DISTINCT c.ClassID) AS subjectCount FROM dbo.Programs p INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID LEFT JOIN dbo.Users u ON u.UserID = p.ProgramChairUserID LEFT JOIN dbo.Classrooms c ON c.ProgramID = p.ProgramID WHERE d.Code = 'CIT' GROUP BY p.ProgramID, p.Name, p.DepartmentID, d.Code, d.Name, p.ProgramChairUserID, u.FirstName, u.LastName ORDER BY p.Name`;
        res.json({ programs: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load programs.' });
    }
});

app.post('/api/programs', requireAuth, requireRole('dean'), async (req, res) => {
    const name = String(req.body.name || '').trim();
    const chairUserId = String(req.body.programChairUserId || '').trim();
    if (!name || name.length > 120) return res.status(400).json({ message: 'Enter a program name up to 120 characters.' });

    try {
        await sql.connect(dbConfig);
        const department = await sql.query`SELECT DepartmentID FROM dbo.Departments WHERE Code = 'CIT' AND IsActive = 1`;
        if (!department.recordset.length) return res.status(500).json({ message: 'The CIT department is not configured.' });
        if (chairUserId) {
            const chair = await sql.query`SELECT UserID FROM dbo.Users WHERE UserID = ${chairUserId} AND LOWER(REPLACE(Role, ' ', '')) = 'programchair'`;
            if (!chair.recordset.length) return res.status(400).json({ message: 'Choose an existing Program Chair account.' });
        }
        const result = await sql.query`INSERT INTO dbo.Programs (Name, DepartmentID, ProgramChairUserID, CreatedByUserID) OUTPUT INSERTED.ProgramID AS id VALUES (${name}, ${department.recordset[0].DepartmentID}, ${chairUserId || null}, ${req.user.userId})`;
        res.status(201).json({ success: true, id: result.recordset[0].id });
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) return res.status(409).json({ message: 'A program with that name already exists.' });
        console.error(err);
        res.status(500).json({ message: 'Could not create program.' });
    }
});

app.delete('/api/programs/:programId', requireAuth, requireRole('dean'), async (req, res) => {
    const programId = Number.parseInt(req.params.programId, 10);
    if (!Number.isInteger(programId)) return res.status(400).json({ message: 'Invalid program.' });

    const transaction = new sql.Transaction();
    let transactionActive = false;
    try {
        await sql.connect(dbConfig);
        await transaction.begin();
        transactionActive = true;

        const programRequest = transaction.request();
        programRequest.input('programId', sql.Int, programId);
        const program = await programRequest.query("SELECT p.ProgramID AS id, c.ClassID AS classId, m.StoredFileName AS storedFileName FROM dbo.Programs p WITH (UPDLOCK, HOLDLOCK) INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID LEFT JOIN dbo.Classrooms c ON c.ProgramID = p.ProgramID OR c.ProgramCourseID IN (SELECT ProgramCourseID FROM dbo.ProgramCourses WHERE ProgramID = p.ProgramID) LEFT JOIN dbo.ClassroomModules m ON m.ClassID = c.ClassID WHERE p.ProgramID = @programId AND d.Code = 'CIT'");
        if (!program.recordset.length) {
            await transaction.rollback();
            transactionActive = false;
            return res.status(404).json({ message: 'CIT program not found.' });
        }

        const deleteClassroomsRequest = transaction.request();
        deleteClassroomsRequest.input('programId', sql.Int, programId);
        await deleteClassroomsRequest.query("DELETE c FROM dbo.Classrooms c WHERE c.ProgramID = @programId OR c.ProgramCourseID IN (SELECT ProgramCourseID FROM dbo.ProgramCourses WHERE ProgramID = @programId)");

        const deleteSignupsRequest = transaction.request();
        deleteSignupsRequest.input('programId', sql.Int, programId);
        await deleteSignupsRequest.query("DELETE FROM dbo.SignupRequests WHERE ProgramID = @programId");

        const deleteCoursesRequest = transaction.request();
        deleteCoursesRequest.input('programId', sql.Int, programId);
        await deleteCoursesRequest.query("DELETE FROM dbo.ProgramCourses WHERE ProgramID = @programId");

        const deleteProgramRequest = transaction.request();
        deleteProgramRequest.input('programId', sql.Int, programId);
        const deleted = await deleteProgramRequest.query("DELETE p FROM dbo.Programs p INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID WHERE p.ProgramID = @programId AND d.Code = 'CIT'");
        if (!deleted.rowsAffected[0]) {
            await transaction.rollback();
            transactionActive = false;
            return res.status(404).json({ message: 'CIT program not found.' });
        }
        await transaction.commit();
        transactionActive = false;

        const cleanupWarning = await removeStoredModuleFiles(program.recordset.map((item) => item.storedFileName), `program ${programId}`);
        res.json({ success: true, cleanupWarning });
    } catch (err) {
        if (transactionActive) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error(rollbackError);
            }
        }
        console.error(err);
        res.status(500).json({ message: 'Could not remove the program.' });
    }
});

app.get('/api/instructors', requireAuth, requireRole('dean', 'programchair'), async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const result = await sql.query`SELECT UserID AS userId, CONCAT(FirstName, ' ', LastName) AS name FROM dbo.Users WHERE LOWER(Role) = 'instructor' ORDER BY LastName, FirstName`;
        res.json({ instructors: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load instructor accounts.' });
    }
});

app.get('/api/department-courses', requireAuth, requireRole('dean', 'programchair'), async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const result = req.user.role === 'dean'
            ? await sql.query`SELECT dc.CourseID AS id, dc.DepartmentID AS departmentId, d.Code AS departmentCode, d.Name AS departmentName, dc.CourseCode AS courseCode, dc.Name AS name, dc.Description AS description FROM dbo.DepartmentCourses dc INNER JOIN dbo.Departments d ON d.DepartmentID = dc.DepartmentID WHERE d.Code = 'CIT' AND d.IsActive = 1 AND dc.IsActive = 1 ORDER BY dc.CourseCode`
            : await sql.query`SELECT DISTINCT dc.CourseID AS id, dc.DepartmentID AS departmentId, d.Code AS departmentCode, d.Name AS departmentName, dc.CourseCode AS courseCode, dc.Name AS name, dc.Description AS description FROM dbo.DepartmentCourses dc INNER JOIN dbo.Departments d ON d.DepartmentID = dc.DepartmentID INNER JOIN dbo.Programs p ON p.DepartmentID = dc.DepartmentID WHERE d.Code = 'CIT' AND d.IsActive = 1 AND dc.IsActive = 1 AND p.ProgramChairUserID = ${req.user.userId} ORDER BY dc.CourseCode`;
        res.json({ courses: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load the department course catalog.' });
    }
});

app.get('/api/program-courses', requireAuth, requireRole('dean', 'programchair'), async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const result = req.user.role === 'dean'
            ? await sql.query`SELECT pc.ProgramCourseID AS id, pc.ProgramID AS programId, p.Name AS programName, pc.Name AS name, pc.Description AS description, COUNT(c.ClassID) AS subjectCount FROM dbo.ProgramCourses pc INNER JOIN dbo.Programs p ON p.ProgramID = pc.ProgramID INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID LEFT JOIN dbo.Classrooms c ON c.ProgramCourseID = pc.ProgramCourseID WHERE d.Code = 'CIT' GROUP BY pc.ProgramCourseID, pc.ProgramID, p.Name, pc.Name, pc.Description, pc.CreatedAt ORDER BY p.Name, pc.Name`
            : await sql.query`SELECT pc.ProgramCourseID AS id, pc.ProgramID AS programId, p.Name AS programName, pc.Name AS name, pc.Description AS description, COUNT(c.ClassID) AS subjectCount FROM dbo.ProgramCourses pc INNER JOIN dbo.Programs p ON p.ProgramID = pc.ProgramID INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID LEFT JOIN dbo.Classrooms c ON c.ProgramCourseID = pc.ProgramCourseID WHERE d.Code = 'CIT' AND p.ProgramChairUserID = ${req.user.userId} GROUP BY pc.ProgramCourseID, pc.ProgramID, p.Name, pc.Name, pc.Description, pc.CreatedAt ORDER BY p.Name, pc.Name`;
        res.json({ courses: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load program courses.' });
    }
});

app.post('/api/programs/:programId/courses', requireAuth, requireRole('programchair'), requireManagedProgram, async (req, res) => {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (!name || name.length > 120 || description.length > 500) return res.status(400).json({ message: 'Enter a course name up to 120 characters and an optional description up to 500 characters.' });

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`INSERT INTO dbo.ProgramCourses (ProgramID, Name, Description, CreatedByUserID) OUTPUT INSERTED.ProgramCourseID AS id VALUES (${req.programId}, ${name}, ${description || null}, ${req.user.userId})`;
        res.status(201).json({ success: true, id: result.recordset[0].id });
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) return res.status(409).json({ message: 'A course with that name already exists in this program.' });
        console.error(err);
        res.status(500).json({ message: 'Could not add the program course.' });
    }
});

app.post('/api/department-courses', requireAuth, requireRole('programchair'), async (req, res) => {
    const courseCode = String(req.body.courseCode || '').trim();
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (!courseCode || courseCode.length > 30 || !name || name.length > 120 || description.length > 500) {
        return res.status(400).json({ message: 'Enter a course code, name, and optional description.' });
    }

    try {
        await sql.connect(dbConfig);
        const department = await sql.query`SELECT TOP (1) d.DepartmentID, d.Code FROM dbo.Departments d INNER JOIN dbo.Programs p ON p.DepartmentID = d.DepartmentID WHERE d.Code = 'CIT' AND d.IsActive = 1 AND p.ProgramChairUserID = ${req.user.userId}`;
        if (!department.recordset.length) {
            return res.status(403).json({ message: 'A Program Chair must be assigned to a CIT program to add catalog courses.' });
        }
        const result = await sql.query`INSERT INTO dbo.DepartmentCourses (DepartmentID, DepartmentCode, CourseCode, Name, Description, CreatedByUserID) OUTPUT INSERTED.CourseID AS id VALUES (${department.recordset[0].DepartmentID}, ${department.recordset[0].Code}, ${courseCode}, ${name}, ${description || null}, ${req.user.userId})`;
        res.status(201).json({ success: true, id: result.recordset[0].id });
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) return res.status(409).json({ message: 'That course code already exists in this department.' });
        console.error(err);
        res.status(500).json({ message: 'Could not add the department course.' });
    }
});

app.get('/api/program-chair-candidates', requireAuth, requireRole('dean'), async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const result = await sql.query`SELECT UserID AS userId, CONCAT(FirstName, ' ', LastName) AS name, Role AS role FROM dbo.Users WHERE LOWER(REPLACE(Role, ' ', '')) = 'programchair' ORDER BY LastName, FirstName`;
        res.json({ candidates: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load Program Chair accounts.' });
    }
});

app.put('/api/programs/:programId/chair', requireAuth, requireRole('dean'), async (req, res) => {
    const programId = Number.parseInt(req.params.programId, 10);
    const chairUserId = String(req.body.programChairUserId || '').trim();
    if (!Number.isInteger(programId) || !chairUserId) return res.status(400).json({ message: 'Choose a program and Program Chair account.' });

    try {
        await sql.connect(dbConfig);
        const candidate = await sql.query`SELECT UserID FROM dbo.Users WHERE UserID = ${chairUserId} AND LOWER(REPLACE(Role, ' ', '')) = 'programchair'`;
        if (!candidate.recordset.length) return res.status(400).json({ message: 'Choose an existing Program Chair account.' });
        const program = await sql.query`SELECT ProgramChairUserID AS chairUserId FROM dbo.Programs WHERE ProgramID = ${programId}`;
        if (!program.recordset.length) return res.status(404).json({ message: 'Program not found.' });

        await sql.query`UPDATE dbo.Programs SET ProgramChairUserID = ${chairUserId} WHERE ProgramID = ${programId}`;
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not assign Program Chair.' });
    }
});

app.post('/api/programs/:programId/classrooms', requireAuth, requireRole('programchair'), requireManagedProgram, async (req, res) => {
    const programCourseId = Number.parseInt(req.body.programCourseId, 10);
    const courseCode = String(req.body.courseCode || '').trim();
    const name = String(req.body.name || '').trim();
    const subjectType = String(req.body.subjectType || '');
    const yearLevel = String(req.body.yearLevel || '');
    const description = String(req.body.description || '').trim();
    const instructorUserId = String(req.body.instructorUserId || '').trim();
    if (!Number.isInteger(programCourseId) || !courseCode || courseCode.length > 30 || !name || name.length > 120 || !['Major', 'Minor'].includes(subjectType) || !yearLevels.has(yearLevel) || !instructorUserId || description.length > 500) {
        return res.status(400).json({ message: 'Enter a subject code and name, then choose a program course, year level, Major or Minor type, and instructor.' });
    }

    try {
        await sql.connect(dbConfig);
        const programCourse = await sql.query`SELECT ProgramCourseID FROM dbo.ProgramCourses WHERE ProgramCourseID = ${programCourseId} AND ProgramID = ${req.programId}`;
        if (!programCourse.recordset.length) return res.status(400).json({ message: 'Choose a course inside this program.' });
        const instructor = await sql.query`SELECT UserID FROM dbo.Users WHERE UserID = ${instructorUserId} AND LOWER(Role) = 'instructor'`;
        if (!instructor.recordset.length) return res.status(400).json({ message: 'Choose an existing instructor account.' });
        const duplicate = await sql.query`SELECT ClassID FROM dbo.Classrooms WHERE ProgramCourseID = ${programCourseId} AND CourseCode = ${courseCode}`;
        if (duplicate.recordset.length) return res.status(409).json({ message: 'A subject with that code already exists in this program course.' });
        const result = await sql.query`INSERT INTO dbo.Classrooms (Name, CourseCode, Description, InstructorUserID, ProgramID, CourseID, ProgramCourseID, SubjectType, YearLevel) OUTPUT INSERTED.ClassID AS id VALUES (${name}, ${courseCode}, ${description || null}, ${instructorUserId}, ${req.programId}, NULL, ${programCourseId}, ${subjectType}, ${yearLevel})`;
        res.status(201).json({ success: true, id: result.recordset[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not add the subject.' });
    }
});

app.delete('/api/programs/:programId/classrooms/:classId', requireAuth, requireRole('programchair'), requireManagedProgram, async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    if (!Number.isInteger(classId)) return res.status(400).json({ message: 'Invalid subject.' });

    const transaction = new sql.Transaction();
    let transactionActive = false;
    try {
        await sql.connect(dbConfig);
        await transaction.begin();
        transactionActive = true;

        const subjectRequest = transaction.request();
        subjectRequest.input('classId', sql.Int, classId);
        subjectRequest.input('programId', sql.Int, req.programId);
        subjectRequest.input('userId', sql.VarChar(50), req.user.userId);
        const subject = await subjectRequest.query("SELECT c.ClassID AS id, m.StoredFileName AS storedFileName FROM dbo.Classrooms c WITH (UPDLOCK, HOLDLOCK) INNER JOIN dbo.Programs p ON p.ProgramID = c.ProgramID LEFT JOIN dbo.ClassroomModules m ON m.ClassID = c.ClassID WHERE c.ClassID = @classId AND c.ProgramID = @programId AND p.ProgramChairUserID = @userId AND EXISTS (SELECT 1 FROM dbo.Departments d WHERE d.DepartmentID = p.DepartmentID AND d.Code = 'CIT')");
        if (!subject.recordset.length) {
            await transaction.rollback();
            transactionActive = false;
            return res.status(404).json({ message: 'Subject not found in your assigned program.' });
        }

        const deleteRequest = transaction.request();
        deleteRequest.input('classId', sql.Int, classId);
        deleteRequest.input('programId', sql.Int, req.programId);
        deleteRequest.input('userId', sql.VarChar(50), req.user.userId);
        const deleted = await deleteRequest.query("DELETE c FROM dbo.Classrooms c WHERE c.ClassID = @classId AND c.ProgramID = @programId AND EXISTS (SELECT 1 FROM dbo.Programs p INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID WHERE p.ProgramID = c.ProgramID AND p.ProgramChairUserID = @userId AND d.Code = 'CIT')");
        if (!deleted.rowsAffected[0]) {
            await transaction.rollback();
            transactionActive = false;
            return res.status(404).json({ message: 'Subject not found in your assigned program.' });
        }
        await transaction.commit();
        transactionActive = false;

        const cleanupWarning = await removeStoredModuleFiles(subject.recordset.map((item) => item.storedFileName), `classroom ${classId}`);
        res.json({ success: true, cleanupWarning });
    } catch (err) {
        if (transactionActive) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error(rollbackError);
            }
        }
        console.error(err);
        res.status(500).json({ message: 'Could not remove the subject.' });
    }
});

app.get('/api/program-courses', requireAuth, requireRole('dean', 'programchair'), async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const result = req.user.role === 'dean'
            ? await sql.query`SELECT pc.ProgramCourseID AS id, pc.ProgramID AS programId, p.Name AS programName, pc.Name AS name, pc.Description AS description, COUNT(c.ClassID) AS subjectCount FROM dbo.ProgramCourses pc INNER JOIN dbo.Programs p ON p.ProgramID = pc.ProgramID INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID LEFT JOIN dbo.Classrooms c ON c.ProgramCourseID = pc.ProgramCourseID WHERE d.Code = 'CIT' GROUP BY pc.ProgramCourseID, pc.ProgramID, p.Name, pc.Name, pc.Description, pc.CreatedAt ORDER BY p.Name, pc.Name`
            : await sql.query`SELECT pc.ProgramCourseID AS id, pc.ProgramID AS programId, p.Name AS programName, pc.Name AS name, pc.Description AS description, COUNT(c.ClassID) AS subjectCount FROM dbo.ProgramCourses pc INNER JOIN dbo.Programs p ON p.ProgramID = pc.ProgramID INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID LEFT JOIN dbo.Classrooms c ON c.ProgramCourseID = pc.ProgramCourseID WHERE d.Code = 'CIT' AND p.ProgramChairUserID = ${req.user.userId} GROUP BY pc.ProgramCourseID, pc.ProgramID, p.Name, pc.Name, pc.Description, pc.CreatedAt ORDER BY p.Name, pc.Name`;
        res.json({ courses: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load program courses.' });
    }
});

app.delete('/api/department-courses/:courseId', requireAuth, requireRole('dean'), async (req, res) => {
    const courseId = Number.parseInt(req.params.courseId, 10);
    if (!Number.isInteger(courseId)) return res.status(400).json({ message: 'Invalid department course.' });

    const transaction = new sql.Transaction();
    let transactionActive = false;
    try {
        await sql.connect(dbConfig);
        await transaction.begin();
        transactionActive = true;

        const courseRequest = transaction.request();
        courseRequest.input('courseId', sql.Int, courseId);
        const course = await courseRequest.query("SELECT dc.CourseID FROM dbo.DepartmentCourses dc WITH (UPDLOCK, HOLDLOCK) INNER JOIN dbo.Departments d ON d.DepartmentID = dc.DepartmentID WHERE dc.CourseID = @courseId AND d.Code = 'CIT' AND dc.IsActive = 1");
        if (!course.recordset.length) {
            await transaction.rollback();
            transactionActive = false;
            return res.status(404).json({ message: 'Active CIT department course not found.' });
        }

        const classroomRequest = transaction.request();
        classroomRequest.input('courseId', sql.Int, courseId);
        const classroom = await classroomRequest.query('SELECT TOP (1) ClassID FROM dbo.Classrooms WITH (HOLDLOCK) WHERE CourseID = @courseId');
        if (classroom.recordset.length) {
            const deactivateRequest = transaction.request();
            deactivateRequest.input('courseId', sql.Int, courseId);
            await deactivateRequest.query('UPDATE dbo.DepartmentCourses SET IsActive = 0 WHERE CourseID = @courseId AND IsActive = 1');
        } else {
            const deleteRequest = transaction.request();
            deleteRequest.input('courseId', sql.Int, courseId);
            await deleteRequest.query('DELETE FROM dbo.DepartmentCourses WHERE CourseID = @courseId AND IsActive = 1');
        }

        await transaction.commit();
        transactionActive = false;
        res.json({ success: true, classroomPreserved: Boolean(classroom.recordset.length) });
    } catch (err) {
        if (transactionActive) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error(rollbackError);
            }
        }
        console.error(err);
        res.status(500).json({ message: 'Could not remove the department course.' });
    }
});

app.post('/api/programs/:programId/courses', requireAuth, requireRole('programchair'), requireManagedProgram, async (req, res) => {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (!name || name.length > 120 || description.length > 500) return res.status(400).json({ message: 'Enter a course name up to 120 characters and optional description up to 500 characters.' });

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`INSERT INTO dbo.ProgramCourses (ProgramID, Name, Description, CreatedByUserID) OUTPUT INSERTED.ProgramCourseID AS id VALUES (${req.programId}, ${name}, ${description || null}, ${req.user.userId})`;
        res.status(201).json({ success: true, id: result.recordset[0].id });
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) return res.status(409).json({ message: 'A course with that name already exists in this program.' });
        console.error(err);
        res.status(500).json({ message: 'Could not add the program course.' });
    }
});

app.put('/api/programs/:programId/courses/:courseId', requireAuth, requireRole('programchair'), requireManagedProgram, async (req, res) => {
    const courseId = Number.parseInt(req.params.courseId, 10);
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (!Number.isInteger(courseId) || !name || name.length > 120 || description.length > 500) {
        return res.status(400).json({ message: 'Enter a course name up to 120 characters and an optional description up to 500 characters.' });
    }

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`UPDATE dbo.ProgramCourses SET Name = ${name}, Description = ${description || null} WHERE ProgramCourseID = ${courseId} AND ProgramID = ${req.programId}`;
        if (!result.rowsAffected[0]) return res.status(404).json({ message: 'Course not found in your program.' });
        res.json({ success: true });
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) return res.status(409).json({ message: 'A course with that name already exists in this program.' });
        console.error(err);
        res.status(500).json({ message: 'Could not update the program course.' });
    }
});

app.delete('/api/programs/:programId/courses/:courseId', requireAuth, requireRole('programchair'), requireManagedProgram, async (req, res) => {
    const courseId = Number.parseInt(req.params.courseId, 10);
    if (!Number.isInteger(courseId)) return res.status(400).json({ message: 'Invalid program course.' });

    const transaction = new sql.Transaction();
    let transactionActive = false;
    try {
        await sql.connect(dbConfig);
        await transaction.begin();
        transactionActive = true;

        const courseRequest = transaction.request();
        courseRequest.input('courseId', sql.Int, courseId);
        courseRequest.input('programId', sql.Int, req.programId);
        courseRequest.input('userId', sql.VarChar(50), req.user.userId);
        const course = await courseRequest.query("SELECT pc.ProgramCourseID AS id, c.ClassID AS classId, m.StoredFileName AS storedFileName FROM dbo.ProgramCourses pc WITH (UPDLOCK, HOLDLOCK) INNER JOIN dbo.Programs p ON p.ProgramID = pc.ProgramID LEFT JOIN dbo.Classrooms c ON c.ProgramCourseID = pc.ProgramCourseID LEFT JOIN dbo.ClassroomModules m ON m.ClassID = c.ClassID WHERE pc.ProgramCourseID = @courseId AND pc.ProgramID = @programId AND p.ProgramChairUserID = @userId AND EXISTS (SELECT 1 FROM dbo.Departments d WHERE d.DepartmentID = p.DepartmentID AND d.Code = 'CIT')");
        if (!course.recordset.length) {
            await transaction.rollback();
            transactionActive = false;
            return res.status(404).json({ message: 'Course not found in your assigned program.' });
        }

        const deleteClassroomsRequest = transaction.request();
        deleteClassroomsRequest.input('courseId', sql.Int, courseId);
        await deleteClassroomsRequest.query("DELETE FROM dbo.Classrooms WHERE ProgramCourseID = @courseId");

        const deleteCourseRequest = transaction.request();
        deleteCourseRequest.input('courseId', sql.Int, courseId);
        deleteCourseRequest.input('programId', sql.Int, req.programId);
        deleteCourseRequest.input('userId', sql.VarChar(50), req.user.userId);
        const deleted = await deleteCourseRequest.query("DELETE pc FROM dbo.ProgramCourses pc INNER JOIN dbo.Programs p ON p.ProgramID = pc.ProgramID INNER JOIN dbo.Departments d ON d.DepartmentID = p.DepartmentID WHERE pc.ProgramCourseID = @courseId AND pc.ProgramID = @programId AND p.ProgramChairUserID = @userId AND d.Code = 'CIT'");
        if (!deleted.rowsAffected[0]) {
            await transaction.rollback();
            transactionActive = false;
            return res.status(404).json({ message: 'Course not found in your assigned program.' });
        }
        await transaction.commit();
        transactionActive = false;

        const cleanupWarning = await removeStoredModuleFiles(course.recordset.map((item) => item.storedFileName), `program course ${courseId}`);
        res.json({ success: true, cleanupWarning });
    } catch (err) {
        if (transactionActive) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error(rollbackError);
            }
        }
        console.error(err);
        res.status(500).json({ message: 'Could not remove the program course.' });
    }
});

app.put('/api/programs/:programId/classrooms/:classId', requireAuth, requireRole('programchair'), requireManagedProgram, async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    const programCourseId = Number.parseInt(req.body.programCourseId, 10);
    const courseCode = String(req.body.courseCode || '').trim();
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    const subjectType = String(req.body.subjectType || '');
    const yearLevel = String(req.body.yearLevel || '');
    const instructorUserId = String(req.body.instructorUserId || '').trim();
    if (!Number.isInteger(classId) || !Number.isInteger(programCourseId) || !courseCode || courseCode.length > 30 || !name || name.length > 120 || description.length > 500 || !['Major', 'Minor'].includes(subjectType) || !yearLevels.has(yearLevel) || !instructorUserId) {
        return res.status(400).json({ message: 'Complete the subject fields with a valid course, year level, Major or Minor type, and instructor.' });
    }

    try {
        await sql.connect(dbConfig);
        const programCourse = await sql.query`SELECT ProgramCourseID FROM dbo.ProgramCourses WHERE ProgramCourseID = ${programCourseId} AND ProgramID = ${req.programId}`;
        if (!programCourse.recordset.length) return res.status(400).json({ message: 'Choose a course inside this program.' });
        const instructor = await sql.query`SELECT UserID FROM dbo.Users WHERE UserID = ${instructorUserId} AND LOWER(Role) = 'instructor'`;
        if (!instructor.recordset.length) return res.status(400).json({ message: 'Choose an existing instructor account.' });
        const result = await sql.query`UPDATE dbo.Classrooms SET CourseCode = ${courseCode}, Name = ${name}, Description = ${description || null}, ProgramCourseID = ${programCourseId}, SubjectType = ${subjectType}, YearLevel = ${yearLevel}, InstructorUserID = ${instructorUserId} WHERE ClassID = ${classId} AND ProgramID = ${req.programId}`;
        if (!result.rowsAffected[0]) return res.status(404).json({ message: 'Subject not found in your program.' });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not update the subject.' });
    }
});

app.put('/api/programs/:programId/classrooms/:classId/course', requireAuth, requireRole('programchair'), requireManagedProgram, async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    const programCourseId = Number.parseInt(req.body.programCourseId, 10);
    const subjectType = String(req.body.subjectType || '');
    const yearLevel = String(req.body.yearLevel || '');
    if (!Number.isInteger(classId) || !Number.isInteger(programCourseId) || !['Major', 'Minor'].includes(subjectType) || !yearLevels.has(yearLevel)) {
        return res.status(400).json({ message: 'Choose a program course, year level, and mark the subject Major or Minor.' });
    }

    try {
        await sql.connect(dbConfig);
        const parent = await sql.query`SELECT ProgramCourseID FROM dbo.ProgramCourses WHERE ProgramCourseID = ${programCourseId} AND ProgramID = ${req.programId}`;
        if (!parent.recordset.length) return res.status(400).json({ message: 'Choose a course inside this program.' });
        const result = await sql.query`UPDATE c SET ProgramCourseID = ${programCourseId}, SubjectType = ${subjectType}, YearLevel = ${yearLevel} FROM dbo.Classrooms c WHERE c.ClassID = ${classId} AND c.ProgramID = ${req.programId}`;
        if (!result.rowsAffected[0]) return res.status(404).json({ message: 'Subject not found in your program.' });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not move the subject into the program course.' });
    }
});

app.put('/api/programs/:programId/classrooms/:classId/year-level', requireAuth, requireRole('programchair'), requireManagedProgram, async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    const yearLevel = String(req.body.yearLevel || '');
    if (!Number.isInteger(classId) || !yearLevels.has(yearLevel)) return res.status(400).json({ message: 'Choose a valid year level.' });

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`UPDATE c SET YearLevel = ${yearLevel} FROM dbo.Classrooms c WHERE c.ClassID = ${classId} AND c.ProgramID = ${req.programId}`;
        if (!result.rowsAffected[0]) return res.status(404).json({ message: 'Subject not found in your program.' });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not update the subject year level.' });
    }
});

app.get('/api/classrooms/:classId/students', requireAuth, requireRole('student', 'instructor', 'programchair', 'dean'), async (req, res) => {
    const classId = Number.parseInt(req.params.classId, 10);
    if (!Number.isInteger(classId)) return res.status(400).json({ message: 'Invalid classroom.' });

    try {
        await sql.connect(dbConfig);
        if (!await canReadClassroom(classId, req.user)) return res.status(404).json({ message: 'Classroom not found or access denied.' });
        const result = await sql.query`SELECT m.StudentUserID AS userId, CONCAT(u.FirstName, ' ', u.LastName) AS name, m.RequestedAt AS enrolledAt FROM dbo.ClassroomMemberships m INNER JOIN dbo.Users u ON u.UserID = m.StudentUserID WHERE m.ClassID = ${classId} AND m.Status = 'Accepted' ORDER BY u.LastName, u.FirstName`;
        res.json({ students: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load the subject roster.' });
    }
});