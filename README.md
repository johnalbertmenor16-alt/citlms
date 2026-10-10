
# Learning Management System for College of Industrial Technology

A responsive front-end MVP for the College of Industrial Technology learning hub.

## Included in this version

- Student dashboard overview with approved classrooms only
- Single account/password sign-in with role detection from `dbo.Users`
- Role-specific workspaces for students, instructors, Program Chairs, and Deans
- Students see classroom modules only after an instructor accepts their join request
- Instructors can create classrooms, review join requests, and accept students
- Students can leave a classroom, and instructors can remove enrolled students from their roster
- Each classroom has a persistent chat for its instructor and approved students
- Instructors can upload classroom modules; approved students can download them
- Dean and Program Chair views are scoped to all programs and their assigned program, respectively
- Program Chairs assign subjects to existing instructors; instructors can directly enroll existing students
- Instructors can publish subject activities and announcements, review answers, and record grades; students cannot submit or edit answers after an activity's due date
- Classroom memberships and request status are stored in SQL Server
- Classroom views, including **Find classrooms**, are grouped as Program → Program Course → Major/Minor subjects
- Student dashboards and classroom lists are filtered by the selected year level; Program Chairs assign each subject to a year level
- Dean oversight spans all programs; Program Chair access is scoped to the assigned program
- Course progress cards
- Upcoming tasks and task filter
- Announcements panel
- Daily schedule
- Grades, calendar, messages, and course navigation placeholders
- Responsive layout for desktop and mobile screens
- CIT Learning Arc landing experience for Computer Industrial Technology
- DTRMS-inspired centered login card featuring the CIT seal and a blue-and-orange interface theme

## Run

Open `index.html` directly in a browser to view the app. Login uses the local SQL Server API and defaults to the `LMS_DB` database on `SQLEXPRESS` with Windows Authentication.

Create the classroom and membership tables once, then start the API:

```powershell
sqlcmd -S '.\SQLEXPRESS' -E -d LMS_DB -i classroom-schema.sql
npm start
```

Re-run the additive schema command after updating the project to create the program, subject activity, submission, announcement, chat, and module tables. The Dean creates programs and assigns an existing instructor account as Program Chair. A Program Chair sees only their assigned programs and creates subjects by assigning existing instructor accounts. Instructors manage their assigned subjects, enroll students by account ID, upload modules, post activities and announcements, review submissions, and grade answers. Students can request to join a subject, or an instructor can add their existing account directly. Only approved students can access subject work. Program monitoring is read-only; the Dean can see every program and each Program Chair is restricted to their assigned program. Module files are stored in `uploads/modules`, excluded from Git, and limited to 20 MB each.

Forgot-password requests use Dean verification because accounts do not store email addresses. The Dean verifies the requester through the school's existing identity-check process, then issues a single-use reset code that expires after one hour. Share the code privately; users set their own new password on the sign-in page. The database stores only a hash of the code. If the Dean account itself is locked out, a database operator must restore access because no other account can approve a Dean's request.

Student and instructor signups are requests until approval. Applicants choose an account type and program; the Dean can review all requests, while each Program Chair can review student requests only for their assigned program. Instructor requests require Dean approval. Approval creates the selected account type in `dbo.Users` using a bcrypt password hash. Re-run the additive schema command after updating to add the requested account type column to existing signup request tables. Create programs before enabling registration.

This workspace is limited to the CIT department. Its subject hierarchy is **CIT → Program → Program Course → Major/Minor Subjects**, with year level assigned to each subject. Program Chairs manage the CIT department course catalog from **Program details** and create courses there; they then create subjects inside their program (for example, Computer Technology under BINDTECH) by entering each subject's code and name and choosing its Major/Minor type, year level, and instructor. Subject creation does not depend on the department catalog. Program Chairs can edit program course names and descriptions, and edit subject codes, names, course placement, Major/Minor type, year level, instructor, and descriptions. Students can select a year level to see the matching dashboard and classroom subjects. Existing subject offerings remain **Unassigned** for year level (and **Uncategorized** until moved into a course) until the Program Chair assigns them. Program Chairs can remove individual subjects or delete a course group; removing a subject or course permanently deletes associated classrooms, memberships, coursework, submissions, announcements, messages, and uploaded modules. Only the Dean can delete a program, which also removes its courses, classrooms, associated records, and pending signup requests. Program Chair assignment accepts existing Program Chair accounts only and never changes an Instructor's role.

The Dean can remove courses from the CIT department catalog through the authorized API. If a catalog entry is still referenced by a classroom, it is deactivated and hidden from the catalog while the existing classroom and its records are preserved; unused entries are permanently deleted.

The migration is additive and keeps existing users. Do not run a script containing `DROP TABLE Users` after applying it; that would delete accounts and conflict with the classroom foreign keys. To use a different SQL Server instance or database, set `DB_SERVER` and `DB_NAME` before running `npm start`. The Windows account running Node needs permission to read `dbo.Users` and create/read/update the classroom tables.

To test from a phone on the same Wi-Fi, start the server with `npm start` on the laptop and open `http://<LAPTOP_WIFI_IP>:3000` on the phone. Find the laptop IP with `ipconfig`. Keep the server running and allow Node.js through Windows Firewall on **Private networks** if prompted. This is a local-network test; GitHub Pages still cannot run the API.

## Suggested next modules

- Persistent sessions and password recovery
- Course/module/lesson management
- Syllabus PDF download
- Assignment submission and grading
- Attendance and class schedules
- Announcements and private messaging
- Database-backed API

## GitHub Publishing

The `.gitignore` excludes dependency folders, environment files, SQL Server data files, backups, and ZIP archives. Do not force-add database backups or files containing real account data or passwords. The classroom schema is safe to share; user records are not.

GitHub Pages can host the static interface, but it cannot run this Node.js API or SQL Server. Login and classroom requests need a separately hosted API and database. Production mode requires SQL authentication, a bcrypt-hashed user password, and explicit `CORS_ORIGINS`.

### Cloud Test Deployment

The API supports local Windows Authentication (`DB_AUTH=windows`) and hosted SQL authentication (`DB_AUTH=sql`). A typical Azure setup uses Azure App Service for Node.js and a separate Azure SQL test database. Do not connect a public test app to the live student database.

1. Create a separate test database and apply the users/classroom schema. Use synthetic test accounts; do not copy personal student data into a public test environment.
2. Configure the App Service application settings using the variable names in `.env.example`. Store the real SQL username/password only in the hosting dashboard, never in GitHub.
3. Back up the test database, then run `node scripts/hash-user-passwords.js` with environment variables pointed at that test database. This updates every plaintext password in that database to a bcrypt hash; production login rejects un-hashed passwords.
4. Set `window.LMS_API_BASE_URL` in `config.js` to the deployed HTTPS API origin, commit that public URL change, and push it so GitHub Pages uses the hosted API.
5. Set `CORS_ORIGINS` to `https://marskyortiguero-wq.github.io` and verify login using only test accounts.

To upload the source, first create an empty **private** repository on GitHub. Do not initialize it with a README, license, or `.gitignore`. Then run these commands from this project folder, replacing the URL with your repository URL:

```powershell
git add .
git status --short
git commit -m "Initial LMS project"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

Before committing, confirm that `git status --short` does not list backups, `.env` files, or personal database data. Publishing the source does not publish or host the SQL Server database or API.
