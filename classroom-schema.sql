IF OBJECT_ID('dbo.Classrooms', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Classrooms (
        ClassID INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(120) NOT NULL,
        CourseCode VARCHAR(30) NOT NULL,
        Description NVARCHAR(500) NULL,
        InstructorUserID VARCHAR(50) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Classrooms_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Classrooms_Users FOREIGN KEY (InstructorUserID) REFERENCES dbo.Users(UserID)
    );
END;
GO

IF OBJECT_ID('dbo.Departments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Departments (
        DepartmentID INT IDENTITY(1,1) PRIMARY KEY,
        Code VARCHAR(20) NOT NULL CONSTRAINT UQ_Departments_Code UNIQUE,
        Name NVARCHAR(120) NOT NULL CONSTRAINT UQ_Departments_Name UNIQUE,
        IsActive BIT NOT NULL CONSTRAINT DF_Departments_IsActive DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Departments_CreatedAt DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Departments WHERE Code = 'CIT')
BEGIN
    INSERT INTO dbo.Departments (Code, Name) VALUES ('CIT', 'College of Industrial Technology');
END;
GO

IF OBJECT_ID('dbo.Programs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Programs (
        ProgramID INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(120) NOT NULL CONSTRAINT UQ_Programs_Name UNIQUE,
        DepartmentID INT NULL,
        ProgramChairUserID VARCHAR(50) NULL,
        CreatedByUserID VARCHAR(50) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Programs_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Programs_Departments FOREIGN KEY (DepartmentID) REFERENCES dbo.Departments(DepartmentID),
        CONSTRAINT FK_Programs_Chair FOREIGN KEY (ProgramChairUserID) REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_Programs_CreatedBy FOREIGN KEY (CreatedByUserID) REFERENCES dbo.Users(UserID)
    );
END;
GO

IF COL_LENGTH('dbo.Programs', 'DepartmentID') IS NULL
BEGIN
    ALTER TABLE dbo.Programs ADD DepartmentID INT NULL;
    ALTER TABLE dbo.Programs ADD CONSTRAINT FK_Programs_Departments FOREIGN KEY (DepartmentID) REFERENCES dbo.Departments(DepartmentID);
END;
GO

UPDATE p SET DepartmentID = d.DepartmentID
FROM dbo.Programs p CROSS JOIN dbo.Departments d
WHERE p.DepartmentID IS NULL AND d.Code = 'CIT';
GO

IF OBJECT_ID('dbo.ProgramCourses', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProgramCourses (
        ProgramCourseID INT IDENTITY(1,1) PRIMARY KEY,
        ProgramID INT NOT NULL,
        Name NVARCHAR(120) NOT NULL,
        Description NVARCHAR(500) NULL,
        CreatedByUserID VARCHAR(50) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ProgramCourses_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_ProgramCourses_Program_Name UNIQUE (ProgramID, Name),
        CONSTRAINT FK_ProgramCourses_Programs FOREIGN KEY (ProgramID) REFERENCES dbo.Programs(ProgramID) ON DELETE CASCADE,
        CONSTRAINT FK_ProgramCourses_Users FOREIGN KEY (CreatedByUserID) REFERENCES dbo.Users(UserID)
    );
END;
GO

IF COL_LENGTH('dbo.Classrooms', 'ProgramCourseID') IS NULL
BEGIN
    ALTER TABLE dbo.Classrooms ADD ProgramCourseID INT NULL;
    ALTER TABLE dbo.Classrooms ADD CONSTRAINT FK_Classrooms_ProgramCourses FOREIGN KEY (ProgramCourseID) REFERENCES dbo.ProgramCourses(ProgramCourseID);
END;
GO

IF COL_LENGTH('dbo.Classrooms', 'SubjectType') IS NULL
BEGIN
    ALTER TABLE dbo.Classrooms ADD SubjectType VARCHAR(10) NULL;
END;
GO

IF COL_LENGTH('dbo.Classrooms', 'YearLevel') IS NULL
BEGIN
    ALTER TABLE dbo.Classrooms ADD YearLevel VARCHAR(10) NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Classrooms_SubjectType')
BEGIN
    ALTER TABLE dbo.Classrooms ADD CONSTRAINT CK_Classrooms_SubjectType CHECK (SubjectType IS NULL OR SubjectType IN ('Major', 'Minor'));
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Classrooms_YearLevel')
BEGIN
    ALTER TABLE dbo.Classrooms ADD CONSTRAINT CK_Classrooms_YearLevel CHECK (YearLevel IS NULL OR YearLevel IN ('1st Year', '2nd Year', '3rd Year', '4th Year'));
END;
GO

IF OBJECT_ID('dbo.DepartmentCourses', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DepartmentCourses (
        CourseID INT IDENTITY(1,1) PRIMARY KEY,
        DepartmentID INT NULL,
        DepartmentCode VARCHAR(20) NOT NULL CONSTRAINT DF_DepartmentCourses_Department DEFAULT 'CIT',
        CourseCode VARCHAR(30) NOT NULL,
        Name NVARCHAR(120) NOT NULL,
        Description NVARCHAR(500) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_DepartmentCourses_IsActive DEFAULT 1,
        CreatedByUserID VARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_DepartmentCourses_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_DepartmentCourses_Department_Code UNIQUE (DepartmentCode, CourseCode),
        CONSTRAINT FK_DepartmentCourses_Departments FOREIGN KEY (DepartmentID) REFERENCES dbo.Departments(DepartmentID),
        CONSTRAINT FK_DepartmentCourses_Users FOREIGN KEY (CreatedByUserID) REFERENCES dbo.Users(UserID)
    );
END;
GO

IF COL_LENGTH('dbo.DepartmentCourses', 'DepartmentID') IS NULL
BEGIN
    ALTER TABLE dbo.DepartmentCourses ADD DepartmentID INT NULL;
    ALTER TABLE dbo.DepartmentCourses ADD CONSTRAINT FK_DepartmentCourses_Departments FOREIGN KEY (DepartmentID) REFERENCES dbo.Departments(DepartmentID);
END;
GO

UPDATE dc SET DepartmentID = d.DepartmentID
FROM dbo.DepartmentCourses dc INNER JOIN dbo.Departments d ON d.Code = dc.DepartmentCode
WHERE dc.DepartmentID IS NULL;
GO

IF COL_LENGTH('dbo.Classrooms', 'CourseID') IS NULL
BEGIN
    ALTER TABLE dbo.Classrooms ADD CourseID INT NULL;
    ALTER TABLE dbo.Classrooms ADD CONSTRAINT FK_Classrooms_DepartmentCourses FOREIGN KEY (CourseID) REFERENCES dbo.DepartmentCourses(CourseID);
END;
GO

INSERT INTO dbo.DepartmentCourses (DepartmentCode, CourseCode, Name)
SELECT DISTINCT 'CIT', c.CourseCode, c.Name
FROM dbo.Classrooms c
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.DepartmentCourses dc
    WHERE dc.DepartmentCode = 'CIT' AND dc.CourseCode = c.CourseCode
);
GO

UPDATE c SET CourseID = dc.CourseID
FROM dbo.Classrooms c
INNER JOIN dbo.DepartmentCourses dc ON dc.DepartmentCode = 'CIT' AND dc.CourseCode = c.CourseCode
WHERE c.CourseID IS NULL;
GO

UPDATE dbo.Users SET Role = 'Program Chair' WHERE LOWER(REPLACE(Role, ' ', '')) IN ('admin', 'administrator');
GO

IF COL_LENGTH('dbo.Classrooms', 'ProgramID') IS NULL
BEGIN
    ALTER TABLE dbo.Classrooms ADD ProgramID INT NULL;
    ALTER TABLE dbo.Classrooms ADD CONSTRAINT FK_Classrooms_Programs FOREIGN KEY (ProgramID) REFERENCES dbo.Programs(ProgramID);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Classrooms') AND name = 'IX_Classrooms_ProgramCourseID')
BEGIN
    CREATE INDEX IX_Classrooms_ProgramCourseID ON dbo.Classrooms(ProgramCourseID, CourseID);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Classrooms') AND name = 'IX_Classrooms_CourseID')
BEGIN
    CREATE INDEX IX_Classrooms_CourseID ON dbo.Classrooms(CourseID, ProgramID);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Classrooms') AND name = 'IX_Classrooms_ProgramID')
BEGIN
    CREATE INDEX IX_Classrooms_ProgramID ON dbo.Classrooms(ProgramID, CreatedAt);
END;
GO

IF OBJECT_ID('dbo.ClassroomMemberships', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ClassroomMemberships (
        MembershipID INT IDENTITY(1,1) PRIMARY KEY,
        ClassID INT NOT NULL,
        StudentUserID VARCHAR(50) NOT NULL,
        Status VARCHAR(20) NOT NULL CONSTRAINT DF_ClassroomMemberships_Status DEFAULT 'Pending',
        RequestedAt DATETIME2 NOT NULL CONSTRAINT DF_ClassroomMemberships_RequestedAt DEFAULT SYSUTCDATETIME(),
        ReviewedAt DATETIME2 NULL,
        CONSTRAINT CK_ClassroomMemberships_Status CHECK (Status IN ('Pending', 'Accepted')),
        CONSTRAINT UQ_ClassroomMemberships_Class_Student UNIQUE (ClassID, StudentUserID),
        CONSTRAINT FK_ClassroomMemberships_Classrooms FOREIGN KEY (ClassID) REFERENCES dbo.Classrooms(ClassID) ON DELETE CASCADE,
        CONSTRAINT FK_ClassroomMemberships_Users FOREIGN KEY (StudentUserID) REFERENCES dbo.Users(UserID)
    );

    CREATE INDEX IX_ClassroomMemberships_Status_ClassID
        ON dbo.ClassroomMemberships(Status, ClassID);
END;
GO

IF OBJECT_ID('dbo.ClassroomMessages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ClassroomMessages (
        MessageID INT IDENTITY(1,1) PRIMARY KEY,
        ClassID INT NOT NULL,
        SenderUserID VARCHAR(50) NOT NULL,
        Message NVARCHAR(2000) NOT NULL,
        SentAt DATETIME2 NOT NULL CONSTRAINT DF_ClassroomMessages_SentAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ClassroomMessages_Classrooms FOREIGN KEY (ClassID) REFERENCES dbo.Classrooms(ClassID) ON DELETE CASCADE,
        CONSTRAINT FK_ClassroomMessages_Users FOREIGN KEY (SenderUserID) REFERENCES dbo.Users(UserID)
    );

    CREATE INDEX IX_ClassroomMessages_ClassID_SentAt
        ON dbo.ClassroomMessages(ClassID, SentAt, MessageID);
END;
GO

IF OBJECT_ID('dbo.ClassroomModules', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ClassroomModules (
        ModuleID INT IDENTITY(1,1) PRIMARY KEY,
        ClassID INT NOT NULL,
        Title NVARCHAR(120) NOT NULL,
        Description NVARCHAR(500) NULL,
        FileName NVARCHAR(255) NOT NULL,
        StoredFileName VARCHAR(255) NOT NULL,
        FileSize BIGINT NOT NULL,
        UploadedByUserID VARCHAR(50) NOT NULL,
        UploadedAt DATETIME2 NOT NULL CONSTRAINT DF_ClassroomModules_UploadedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ClassroomModules_Classrooms FOREIGN KEY (ClassID) REFERENCES dbo.Classrooms(ClassID) ON DELETE CASCADE,
        CONSTRAINT FK_ClassroomModules_Users FOREIGN KEY (UploadedByUserID) REFERENCES dbo.Users(UserID)
    );

    CREATE INDEX IX_ClassroomModules_ClassID_UploadedAt
        ON dbo.ClassroomModules(ClassID, UploadedAt, ModuleID);
END;
GO

IF OBJECT_ID('dbo.ClassroomActivities', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ClassroomActivities (
        ActivityID INT IDENTITY(1,1) PRIMARY KEY,
        ClassID INT NOT NULL,
        Title NVARCHAR(160) NOT NULL,
        Instructions NVARCHAR(2000) NOT NULL,
        ActivityType VARCHAR(20) NOT NULL CONSTRAINT DF_ClassroomActivities_Type DEFAULT 'Assignment',
        DueAt DATETIME2 NULL,
        Points DECIMAL(8,2) NOT NULL CONSTRAINT DF_ClassroomActivities_Points DEFAULT 100,
        CreatedByUserID VARCHAR(50) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ClassroomActivities_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_ClassroomActivities_Type CHECK (ActivityType IN ('Assignment', 'Quiz')),
        CONSTRAINT FK_ClassroomActivities_Classrooms FOREIGN KEY (ClassID) REFERENCES dbo.Classrooms(ClassID) ON DELETE CASCADE,
        CONSTRAINT FK_ClassroomActivities_Users FOREIGN KEY (CreatedByUserID) REFERENCES dbo.Users(UserID)
    );
    CREATE INDEX IX_ClassroomActivities_ClassID_DueAt ON dbo.ClassroomActivities(ClassID, DueAt, ActivityID);
END;
GO

IF OBJECT_ID('dbo.ActivitySubmissions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ActivitySubmissions (
        SubmissionID INT IDENTITY(1,1) PRIMARY KEY,
        ActivityID INT NOT NULL,
        StudentUserID VARCHAR(50) NOT NULL,
        Answer NVARCHAR(MAX) NOT NULL,
        SubmittedAt DATETIME2 NOT NULL CONSTRAINT DF_ActivitySubmissions_SubmittedAt DEFAULT SYSUTCDATETIME(),
        Grade DECIMAL(8,2) NULL,
        Feedback NVARCHAR(1000) NULL,
        GradedAt DATETIME2 NULL,
        CONSTRAINT UQ_ActivitySubmissions_Activity_Student UNIQUE (ActivityID, StudentUserID),
        CONSTRAINT FK_ActivitySubmissions_Activities FOREIGN KEY (ActivityID) REFERENCES dbo.ClassroomActivities(ActivityID) ON DELETE CASCADE,
        CONSTRAINT FK_ActivitySubmissions_Users FOREIGN KEY (StudentUserID) REFERENCES dbo.Users(UserID)
    );
    CREATE INDEX IX_ActivitySubmissions_StudentUserID ON dbo.ActivitySubmissions(StudentUserID, SubmittedAt);
END;
GO

IF OBJECT_ID('dbo.ClassroomAnnouncements', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ClassroomAnnouncements (
        AnnouncementID INT IDENTITY(1,1) PRIMARY KEY,
        ClassID INT NOT NULL,
        Title NVARCHAR(160) NOT NULL,
        Message NVARCHAR(2000) NOT NULL,
        PostedByUserID VARCHAR(50) NOT NULL,
        PostedAt DATETIME2 NOT NULL CONSTRAINT DF_ClassroomAnnouncements_PostedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ClassroomAnnouncements_Classrooms FOREIGN KEY (ClassID) REFERENCES dbo.Classrooms(ClassID) ON DELETE CASCADE,
        CONSTRAINT FK_ClassroomAnnouncements_Users FOREIGN KEY (PostedByUserID) REFERENCES dbo.Users(UserID)
    );
    CREATE INDEX IX_ClassroomAnnouncements_ClassID_PostedAt ON dbo.ClassroomAnnouncements(ClassID, PostedAt, AnnouncementID);
END;
GO

IF OBJECT_ID('dbo.PasswordResetRequests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PasswordResetRequests (
        RequestID INT IDENTITY(1,1) PRIMARY KEY,
        UserID VARCHAR(50) NOT NULL,
        Status VARCHAR(20) NOT NULL CONSTRAINT DF_PasswordResetRequests_Status DEFAULT 'Pending',
        RequestedAt DATETIME2 NOT NULL CONSTRAINT DF_PasswordResetRequests_RequestedAt DEFAULT SYSUTCDATETIME(),
        TokenHash CHAR(64) NULL,
        TokenExpiresAt DATETIME2 NULL,
        ReviewedAt DATETIME2 NULL,
        ReviewedByUserID VARCHAR(50) NULL,
        CompletedAt DATETIME2 NULL,
        CONSTRAINT CK_PasswordResetRequests_Status CHECK (Status IN ('Pending', 'Issued', 'Completed', 'Rejected', 'Expired')),
        CONSTRAINT FK_PasswordResetRequests_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_PasswordResetRequests_ReviewedBy FOREIGN KEY (ReviewedByUserID) REFERENCES dbo.Users(UserID)
    );

    CREATE INDEX IX_PasswordResetRequests_Status_RequestedAt
        ON dbo.PasswordResetRequests(Status, RequestedAt);
END;
GO

IF OBJECT_ID('dbo.SignupRequests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SignupRequests (
        RequestID INT IDENTITY(1,1) PRIMARY KEY,
        UserID VARCHAR(50) NOT NULL,
        PasswordHash VARCHAR(255) NOT NULL,
        FirstName VARCHAR(100) NOT NULL,
        LastName VARCHAR(100) NOT NULL,
        ProgramID INT NOT NULL,
        RequestedRole VARCHAR(20) NOT NULL CONSTRAINT DF_SignupRequests_RequestedRole DEFAULT 'Student',
        Status VARCHAR(20) NOT NULL CONSTRAINT DF_SignupRequests_Status DEFAULT 'Pending',
        RequestedAt DATETIME2 NOT NULL CONSTRAINT DF_SignupRequests_RequestedAt DEFAULT SYSUTCDATETIME(),
        ReviewedAt DATETIME2 NULL,
        ReviewedByUserID VARCHAR(50) NULL,
        CONSTRAINT CK_SignupRequests_RequestedRole CHECK (RequestedRole IN ('Student', 'Instructor')),
        CONSTRAINT CK_SignupRequests_Status CHECK (Status IN ('Pending', 'Approved', 'Rejected')),
        CONSTRAINT FK_SignupRequests_Programs FOREIGN KEY (ProgramID) REFERENCES dbo.Programs(ProgramID),
        CONSTRAINT FK_SignupRequests_ReviewedBy FOREIGN KEY (ReviewedByUserID) REFERENCES dbo.Users(UserID)
    );

    CREATE INDEX IX_SignupRequests_Status_ProgramID_RequestedAt
        ON dbo.SignupRequests(Status, ProgramID, RequestedAt);
END;
GO

IF COL_LENGTH('dbo.SignupRequests', 'RequestedRole') IS NULL
BEGIN
    ALTER TABLE dbo.SignupRequests
        ADD RequestedRole VARCHAR(20) NOT NULL
            CONSTRAINT DF_SignupRequests_RequestedRole DEFAULT 'Student';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.SignupRequests') AND name = 'CK_SignupRequests_RequestedRole')
BEGIN
    ALTER TABLE dbo.SignupRequests
        ADD CONSTRAINT CK_SignupRequests_RequestedRole CHECK (RequestedRole IN ('Student', 'Instructor'));
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.SignupRequests') AND name = 'IX_SignupRequests_Status_UserID')
BEGIN
    CREATE INDEX IX_SignupRequests_Status_UserID ON dbo.SignupRequests(Status, UserID);
END;
GO
-- ============================================================
-- Profile pictures
-- Users and SignupRequests store the stored filename of the
-- uploaded avatar (served from /uploads/avatars/<filename>).
-- ============================================================

IF COL_LENGTH('dbo.Users', 'ProfilePicture') IS NULL
BEGIN
    ALTER TABLE dbo.Users
        ADD ProfilePicture VARCHAR(80) NULL;
END;
GO

IF COL_LENGTH('dbo.SignupRequests', 'ProfilePicture') IS NULL
BEGIN
    ALTER TABLE dbo.SignupRequests
        ADD ProfilePicture VARCHAR(80) NULL;
END;
GO
