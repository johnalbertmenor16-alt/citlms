const pageTitle = document.getElementById('pageTitle');
const sidebar = document.getElementById('sidebar');
const menuButton = document.getElementById('menuButton');
const toast = document.getElementById('toast');
const yearSelector = document.getElementById('yearSelector');
const yearLevels = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const pageContainer = document.getElementById('pageContainer');
const authScreen = document.getElementById('authScreen');
const appShell = document.getElementById('appShell');
const loginForm = document.getElementById('loginForm');
const overviewMarkup = pageContainer.innerHTML;
const configuredApiBaseUrl = window.LMS_API_BASE_URL?.replace(/\/$/, '');
const apiBaseUrl = configuredApiBaseUrl || (window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io')
  ? 'http://localhost:3000'
  : window.location.origin);

const viewNames = {
  overview: 'Dashboard',
  'learning-arc': 'CIT Learning Arc',
  courses: 'My classrooms',
  catalog: 'Find classrooms',
  requests: 'Join requests',
  programs: 'Programs',
  'signup-requests': 'Signup approvals',
  'password-resets': 'Password resets',
  settings: 'Settings',
  assignments: 'Assignments',
  gradebook: 'Gradebook',
  departments: 'Departments',
  reports: 'Reports',
  users: 'User management',
  announcements: 'Announcements'
};

const roleNavigation = {
  student: [['overview', '⌂', 'Dashboard'], ['catalog', '＋', 'Find classrooms'], ['courses', '▦', 'My classrooms'], ['announcements', '◉', 'Announcements'], ['learning-arc', '✦', 'Explore learning']],
  instructor: [['overview', '⌂', 'Dashboard'], ['courses', '▦', 'My subjects'], ['requests', '↗', 'Join requests'], ['assignments', '✓', 'Activities'], ['announcements', '◉', 'Announcements']],
  programchair: [['overview', '⌂', 'Dashboard'], ['courses', '▦', 'All subjects'], ['signup-requests', '＋', 'Signup approvals'], ['programs', '▤', 'Program details'], ['announcements', '◉', 'Announcements'], ['reports', '↗', 'Monitoring']],
  dean: [['overview', '⌂', 'Dashboard'], ['programs', '▤', 'Programs'], ['courses', '▦', 'All programs'], ['signup-requests', '＋', 'Signup approvals'], ['password-resets', '↻', 'Password resets'], ['announcements', '◉', 'Announcements'], ['reports', '↗', 'Monitoring']]
};

let toastTimer;
let showingOpenTasks = false;
let activeCourse = null;
let activeCourseYear = '';
let authToken = '';
let classroomCache = [];
let activeView = 'learning-arc';
let showClassroomFormOnLoad = false;
let chatPollTimer;
let modulePollTimer;
let activeChatClassId;

function classroomsForSelectedYear(classrooms = classroomCache) {
  return classrooms.filter((classroom) => classroom.yearLevel === yearSelector.value);
}

function updateYearLevel(year) {
  document.querySelectorAll('.year-badge').forEach((badge) => {
    badge.textContent = year;
    badge.className = `year-badge year-${year.charAt(0)}`;
  });
  document.querySelectorAll('.module-header .eyebrow, .view-toolbar strong, .arc-track small').forEach((element) => {
    element.textContent = element.textContent.replace(/[1-4](st|nd|rd|th) Year/g, year);
  });
}
const viewMarkup = {
  'learning-arc': `<section class="arc-hero"><div class="arc-hero-copy"><p class="eyebrow">CIT LEARNING ARC · COMPUTER INDUSTRIAL TECHNOLOGY</p><h1>Learn the craft.<br><em>Build what matters.</em></h1><p>One focused learning space for the people who design, build, troubleshoot, and improve the technologies around us.</p><div class="arc-hero-actions"><button class="primary-button" data-action="explore">Explore learning paths <span>→</span></button><button class="arc-quiet-button" data-view="courses">View my courses</button></div></div><div class="arc-hero-visual"><span class="arc-orbit orbit-one"></span><span class="arc-orbit orbit-two"></span><div class="arc-core"><span>01</span><strong>MAKE<br>IT<br>REAL</strong></div><div class="arc-float float-top">♧ <small>Hands-on modules</small></div><div class="arc-float float-bottom">✦ <small>Built for CIT learners</small></div></div></section><section class="arc-intro"><div><p class="eyebrow">A LEARNING SYSTEM FOR THE WORK AHEAD</p><h2>From first concept<br>to finished system.</h2></div><p>Move through practical tracks that connect classroom knowledge to the tools, decisions, and problem-solving habits of modern industrial technology.</p></section><section class="arc-capabilities"><article><span class="arc-cap-icon coral-icon">◒</span><p class="eyebrow">01 · DISCOVER</p><h3>Learn in the flow</h3><p>Short lessons, guided examples, and quick checks keep every module close to the work.</p><button class="arc-link" data-action="discover">Explore modules →</button></article><article><span class="arc-cap-icon blue-icon">⌁</span><p class="eyebrow">02 · PRACTICE</p><h3>Build through doing</h3><p>Turn concepts into interfaces, databases, networks, and working prototypes.</p><button class="arc-link" data-action="practice">Open practice lab →</button></article><article><span class="arc-cap-icon lime-icon">↗</span><p class="eyebrow">03 · PROGRESS</p><h3>See your momentum</h3><p>Track your year level, skill progress, tasks, and the next step in your learning arc.</p><button class="arc-link" data-view="grades">View progress →</button></article></section><section class="arc-paths"><div class="arc-section-heading"><div><p class="eyebrow">YOUR LEARNING PATHS</p><h2>Choose your next build.</h2></div><button class="arc-link" data-view="courses">See all paths →</button></div><div class="arc-track-grid"><button class="arc-track track-coral" data-action="track"><span>01</span><strong>Web &amp; Interface<br>Development</strong><small>2nd Year · 8 modules</small><b>72% <i style="width:72%"></i></b></button><button class="arc-track track-navy" data-action="track"><span>02</span><strong>Data &amp; Database<br>Systems</strong><small>2nd Year · 10 modules</small><b>48% <i style="width:48%"></i></b></button><button class="arc-track track-lime" data-action="track"><span>03</span><strong>Networks &amp;<br>Infrastructure</strong><small>2nd Year · 9 modules</small><b>84% <i style="width:84%"></i></b></button></div></section><section class="arc-bottom-line"><strong>CIT Learning Arc</strong><span>Computer Industrial Technology · First Semester 2026–2027</span><button class="arc-link" data-view="syllabus">Open syllabus →</button></section>`,
  syllabus: `<section class="view-header"><div><p class="eyebrow">ACADEMIC GUIDE</p><h1>Syllabus</h1><p class="subtitle">Your semester guide for subjects, outcomes, and course requirements.</p></div><button class="primary-button" data-action="download">↓ <span>Download PDF</span></button></section><section class="syllabus-banner"><div class="course-color coral"><span>BSIT</span></div><div><span class="course-code">FIRST SEMESTER 2026–2027</span><h2>Bachelor of Science in Information Technology</h2><p>College of Industrial Technology · 2nd Year · 21 academic units</p></div></section><div class="syllabus-grid"><section class="panel syllabus-subjects"><div class="panel-heading"><h2>Course subjects</h2><span class="course-code">4 subjects</span></div><div class="syllabus-subject"><span class="subject-number">01</span><div><strong>IT 204 · Web Development</strong><small>2nd Year · 3 units · Prof. Maria Santos</small></div><span class="subject-status complete">72%</span></div><div class="syllabus-subject"><span class="subject-number">02</span><div><strong>IT 206 · Database Management</strong><small>2nd Year · 3 units · Prof. Carlo Reyes</small></div><span class="subject-status progress">48%</span></div><div class="syllabus-subject"><span class="subject-number">03</span><div><strong>IT 208 · Computer Networking</strong><small>2nd Year · 3 units · Prof. Anna Lim</small></div><span class="subject-status complete">84%</span></div><div class="syllabus-subject"><span class="subject-number">04</span><div><strong>IT 210 · Human-Computer Interaction</strong><small>2nd Year · 3 units · Prof. Leo Garcia</small></div><span class="subject-status progress">63%</span></div></section><section class="panel outcomes-panel"><div class="panel-heading"><h2>Learning outcomes</h2></div><ol><li>Design and develop responsive information systems.</li><li>Apply database concepts to practical technology solutions.</li><li>Configure and troubleshoot basic network environments.</li><li>Evaluate user experience and accessibility in digital products.</li></ol></section></div><section class="panel grading-panel"><div class="panel-heading"><h2>Grading breakdown</h2><span class="course-code">All subjects</span></div><div class="grading-bars"><div><span>Activities & exercises</span><b>20%</b><i style="width:20%"></i></div><div><span>Projects & practical work</span><b>35%</b><i style="width:35%"></i></div><div><span>Quizzes & examinations</span><b>30%</b><i style="width:30%"></i></div><div><span>Participation & attendance</span><b>15%</b><i style="width:15%"></i></div></div></section>`,
  courses: `<section class="view-header"><div><p class="eyebrow">ACADEMIC WORKSPACE</p><h1>My courses</h1><p class="subtitle">Track your enrolled subjects and continue where you left off.</p></div><button class="primary-button" data-action="browse">+ <span>Browse courses</span></button></section><section class="view-toolbar"><strong>Current semester · 2nd Year</strong><button class="filter-button">First Semester 2026–2027 <span>⌄</span></button></section><div class="course-view-grid"><article class="large-course-card"><div class="course-color coral"><span>WD</span></div><div><span class="course-code">IT 204</span><span class="year-badge year-2">2nd Year</span><h2>Web Development</h2><p>Prof. Maria Santos · 8 learning modules</p><div class="progress-line"><i style="width:72%"></i></div><small>72% complete · Next: Responsive layouts</small></div><button class="arrow-button" data-action="course">↗</button></article><article class="large-course-card"><div class="course-color navy"><span>DB</span></div><div><span class="course-code">IT 206</span><span class="year-badge year-2">2nd Year</span><h2>Database Management</h2><p>Prof. Carlo Reyes · 10 learning modules</p><div class="progress-line"><i style="width:48%"></i></div><small>48% complete · Next: SQL normalization</small></div><button class="arrow-button" data-action="course">↗</button></article><article class="large-course-card"><div class="course-color lime"><span>NW</span></div><div><span class="course-code">IT 208</span><span class="year-badge year-2">2nd Year</span><h2>Computer Networking</h2><p>Prof. Anna Lim · 9 learning modules</p><div class="progress-line"><i style="width:84%"></i></div><small>84% complete · Next: Practical quiz</small></div><button class="arrow-button" data-action="course">↗</button></article><article class="large-course-card"><div class="course-color" style="background:#fff0c9;color:#ad8d37"><span>UI</span></div><div><span class="course-code">IT 210</span><span class="year-badge year-2">2nd Year</span><h2>Human-Computer Interaction</h2><p>Prof. Leo Garcia · 7 learning modules</p><div class="progress-line"><i style="width:63%;background:var(--yellow)"></i></div><small>63% complete · Next: Usability testing</small></div><button class="arrow-button" data-action="course">↗</button></article></div>`,
  calendar: `<section class="view-header"><div><p class="eyebrow">PLAN YOUR WEEK</p><h1>Calendar</h1><p class="subtitle">Classes, deadlines, and CIT activities in one place.</p></div><button class="primary-button" data-action="schedule">+ <span>Add event</span></button></section><section class="calendar-panel"><div class="calendar-top"><button class="filter-button">‹ &nbsp; September 2026 &nbsp; ›</button><div class="calendar-legend"><span><i class="legend-dot coral-dot"></i>Class</span><span><i class="legend-dot blue-dot"></i>Deadline</span><span><i class="legend-dot lime-dot"></i>Activity</span></div></div><div class="calendar-week"><span>MON<br><b>28</b></span><span>TUE<br><b>29</b></span><span class="today">WED<br><b>30</b></span><span>THU<br><b>01</b></span><span>FRI<br><b>02</b></span><span>SAT<br><b>03</b></span><span>SUN<br><b>04</b></span></div><div class="calendar-events"><div class="calendar-event coral-event"><b>09:00</b><strong>Web Development</strong><small>Room ICT-302 · Lecture</small></div><div class="calendar-event blue-event"><b>13:30</b><strong>Database Management</strong><small>Room ICT-205 · Laboratory</small></div><div class="calendar-event lime-event"><b>16:00</b><strong>Student consultation hour</strong><small>CIT Learning Hub</small></div></div></section>`,
  grades: `<section class="view-header"><div><p class="eyebrow">ACADEMIC PERFORMANCE</p><h1>Grades</h1><p class="subtitle">Your current standing for the first semester.</p></div><button class="filter-button">First Semester 2026–2027 <span>⌄</span></button></section><section class="grade-summary"><div><span>Current average</span><strong>1.62</strong><small>Equivalent: Very good</small></div><div><span>Units completed</span><strong>12 / 21</strong><small>57% of semester load</small></div><div><span>Attendance</span><strong>94%</strong><small>Excellent standing</small></div></section><section class="panel grade-panel"><div class="panel-heading"><h2>Subject performance</h2><span class="course-code">Updated Sept 26</span></div><div class="grade-row"><strong>IT 204 · Web Development</strong><span>1.50</span><i style="width:88%"></i></div><div class="grade-row"><strong>IT 206 · Database Management</strong><span>1.75</span><i style="width:81%"></i></div><div class="grade-row"><strong>IT 208 · Computer Networking</strong><span>1.50</span><i style="width:86%"></i></div><div class="grade-row"><strong>IT 210 · Human-Computer Interaction</strong><span>1.75</span><i style="width:78%"></i></div></section>`,
  announcements: '',
  messages: `<section class="view-header"><div><p class="eyebrow">CIT COMMUNITY</p><h1>Messages</h1><p class="subtitle">Connect with your instructors and classmates.</p></div><button class="primary-button" data-action="message">+ <span>New message</span></button></section><section class="panel message-list"><div class="message-row"><div class="avatar">MS</div><div><strong>Prof. Maria Santos</strong><p>Your portfolio outline looks good. Please add the accessibility checklist.</p></div><time>10:42 AM</time></div><div class="message-row"><div class="avatar" style="background:#789bc2">CR</div><div><strong>Prof. Carlo Reyes</strong><p>Reminder: SQL exercises are due this Friday.</p></div><time>Yesterday</time></div><div class="message-row"><div class="avatar" style="background:#9db270">AL</div><div><strong>Prof. Anna Lim</strong><p>The subnetting practical quiz has been posted.</p></div><time>Sep 26</time></div></section>`,
  settings: `<section class="view-header"><div><p class="eyebrow">PERSONALIZE YOUR HUB</p><h1>Settings</h1><p class="subtitle">Manage your profile, profile picture, and notification preferences.</p></div><button class="filter-button" data-view="overview">← Back to dashboard</button></section><section class="settings-grid"><section class="panel settings-card"><h2>Profile</h2><div class="avatar-upload"><div class="avatar-preview" id="settingsAvatarPreview">＋</div><div class="avatar-upload-fields"><label for="settingsProfilePicture">Change profile picture</label><input id="settingsProfilePicture" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small>PNG, JPG, WEBP, or GIF · up to 5 MB</small><div class="avatar-upload-actions"><button class="text-button" id="settingsAvatarUpload" type="button">Upload picture</button><button class="auth-link" id="settingsAvatarRemove" type="button">Remove</button></div></div></div><p class="reset-status" id="settingsAvatarStatus" aria-live="polite"></p></section><section class="panel settings-card"><h2>Account</h2><label>Full name<input id="settingsFullName" readonly></label><label>Account ID<input id="settingsAccountId" readonly></label><label>Role<input id="settingsRole" readonly></label></section><section class="panel settings-card"><h2>Notifications</h2><label class="toggle-row">Assignment reminders <input type="checkbox" checked><i></i></label><label class="toggle-row">Course announcements <input type="checkbox" checked><i></i></label><label class="toggle-row">Message alerts <input type="checkbox" checked><i></i></label></section></section>`
};

delete viewMarkup.syllabus;

const dashboardData = {
  student: {
    description: 'Continue your classes, check deadlines, and keep your learning moving.',
    action: 'browse', actionLabel: 'Find a classroom',
    stats: [['Enrolled classes', '0', 'approved classrooms'], ['Overall progress', '—', 'join a class to begin'], ['Due this week', '0', 'class assignments'], ['Join requests', '0', 'awaiting approval']],
    classesTitle: 'Your classes', classesEyebrow: 'MY LEARNING',
    activityTitle: 'Upcoming work', activityEyebrow: 'NEXT DEADLINES', linkView: 'courses', linkLabel: 'Open my subjects',
    activities: []
  },
  instructor: {
    description: 'Manage your classes, review submissions, and keep students on track.',
    action: 'browse', actionLabel: 'Open assigned subjects',
    stats: [['My classrooms', '0', 'created by you'], ['Join requests', '0', 'awaiting your review'], ['Students', '0', 'approved memberships'], ['Assignments', '0', 'across your classes']],
    classesTitle: 'Classes you teach', classesEyebrow: 'TEACHING SPACE',
    activityTitle: 'Needs your attention', activityEyebrow: 'REVIEW QUEUE', linkView: 'gradebook', linkLabel: 'Open gradebook',
    activities: []
  },
  programchair: {
    description: 'Manage subjects and monitor learning across your assigned program.',
    action: 'browse', actionLabel: 'Open program subjects',
    stats: [['Subjects', '0', 'in your program'], ['Enrolled students', '0', 'across subjects'], ['Modules', '0', 'uploaded by instructors'], ['Activities', '0', 'assigned to students']],
    classesTitle: 'Your program subjects', classesEyebrow: 'PROGRAM WORKSPACE',
    activityTitle: 'Teaching activity', activityEyebrow: 'PROGRAM MONITORING', linkView: 'courses', linkLabel: 'Review subjects',
    activities: []
  },
  dean: {
    description: 'Review department activity, course coverage, and academic progress.',
    action: 'export-report', actionLabel: '↓ Export overview',
    stats: [['Programs', '0', 'active programs'], ['Courses', '0', 'across programs'], ['Faculty', '0', 'teaching staff'], ['Students', '0', 'enrolled in classes']],
    classesTitle: 'Academic activity', classesEyebrow: 'COLLEGE OVERVIEW',
    activityTitle: 'Subject pulse', activityEyebrow: 'AT A GLANCE', linkView: 'reports', linkLabel: 'View reports',
    activities: []
  },
};

const roleViewMarkup = {
  assignments: `<section class="view-header"><div><p class="eyebrow">TEACHING WORKSPACE</p><h1>Activities</h1><p class="subtitle">Every activity across your subjects, with who submitted and who has not.</p></div><button class="filter-button" data-action="refresh-activities">Refresh</button></section><div id="activitiesBody"><div class="empty-state"><strong>Loading activities</strong><p>Gathering submissions from your subjects.</p></div></div>`,
  gradebook: `<section class="view-header"><div><p class="eyebrow">TEACHING WORKSPACE</p><h1>Gradebook</h1><p class="subtitle">Review class progress and outstanding grading.</p></div><button class="filter-button">All classes <span>⌄</span></button></section><section class="panel"><div class="panel-heading"><h2>Class progress</h2><span class="course-code">DEMO DATA</span></div><div class="workspace-row"><div><strong>Web Development · IT 204</strong><small>32 students · Latest activity: Portfolio checkpoint</small></div><span class="subject-status progress">8 pending</span><button class="text-button" data-action="review-work">Open →</button></div><div class="workspace-row"><div><strong>Database Management · IT 206</strong><small>28 students · Latest activity: SQL practice</small></div><span class="subject-status progress">6 pending</span><button class="text-button" data-action="review-work">Open →</button></div><div class="workspace-row"><div><strong>Computer Networking · IT 208</strong><small>34 students · Latest activity: Lab report</small></div><span class="subject-status complete">4 pending</span><button class="text-button" data-action="review-work">Open →</button></div></section>`,
  departments: `<section class="view-header"><div><p class="eyebrow">ACADEMIC WORKSPACE</p><h1>Departments</h1><p class="subtitle">A college-wide view of programs and current teaching activity.</p></div><button class="filter-button">Academic year 2026–2027 <span>⌄</span></button></section><section class="workspace-card-grid"><article class="workspace-card"><span class="eyebrow">01 · PROGRAM</span><h2>Information Technology</h2><p>18 courses · 420 students · 16 faculty</p><button class="text-button" data-view="courses">View courses →</button></article><article class="workspace-card"><span class="eyebrow">02 · PROGRAM</span><h2>Electronics Technology</h2><p>12 courses · 336 students · 12 faculty</p><button class="text-button" data-view="courses">View courses →</button></article><article class="workspace-card"><span class="eyebrow">03 · PROGRAM</span><h2>Computer Technology</h2><p>12 courses · 492 students · 20 faculty</p><button class="text-button" data-view="courses">View courses →</button></article></section>`,
  reports: `<section class="view-header"><div><p class="eyebrow">ACADEMIC INSIGHTS</p><h1>Reports</h1><p class="subtitle">Live indicators for enrollment, teaching activity, and grading across your scope.</p></div><button class="primary-button" data-action="export-report">↓ <span>Export report</span></button></section><div id="reportsBody"><div class="empty-state"><strong>Loading report</strong><p>Computing live figures from programs, subjects, and submissions.</p></div></div>`,
  users: `<section class="view-header"><div><p class="eyebrow">ADMINISTRATION</p><h1>User management</h1><p class="subtitle">Review sample accounts and access roles in the learning hub.</p></div><button class="primary-button" data-action="invite-user">＋ <span>Add user</span></button></section><section class="panel"><div class="panel-heading"><h2>Accounts</h2><button class="filter-button">All roles <span>⌄</span></button></div><div class="workspace-row"><div><strong>Maria Santos</strong><small>INS-014 · Instructor</small></div><span class="subject-status complete">Active</span><button class="dots-button" aria-label="More account actions">•••</button></div><div class="workspace-row"><div><strong>Juan Dela Cruz</strong><small>2024-01482 · Student</small></div><span class="subject-status complete">Active</span><button class="dots-button" aria-label="More account actions">•••</button></div><div class="workspace-row"><div><strong>Carlo Reyes</strong><small>INS-021 · Instructor</small></div><span class="subject-status progress">Review</span><button class="dots-button" aria-label="More account actions">•••</button></div></section>`
};

function renderRoleDashboard(role) {
  const dashboard = dashboardData[role] || dashboardData.student;
  const stats = dashboard.stats.map(([label, value, note], index) => `<article class="stat-card accent-${['coral', 'lime', 'blue', 'yellow'][index]}"><div class="stat-top"><span>${label}</span><span class="stat-symbol">${['◒', '↗', '◷', '✦'][index]}</span></div><strong>${value}</strong><small>${note}</small></article>`).join('');
  const classes = `<div class="empty-state"><span class="empty-state-mark">▦</span><strong>Loading classrooms</strong><p>Getting your classroom list.</p></div>`;
  const activities = dashboard.activities.map(([title, detail, status]) => `<article class="dashboard-activity"><span class="activity-marker"></span><div><strong>${title}</strong><small>${detail}</small></div><span class="activity-status">${status}</span></article>`).join('');

  return `<section class="welcome-row"><div><p class="eyebrow">ACADEMIC YEAR 2026–2027 · CLASSROOM WORKSPACE</p><h1 id="greeting">Welcome back.</h1><p class="subtitle">${dashboard.description}</p>${role === 'student' ? `<p class="year-dashboard-label">${escapeHtml(yearSelector.value)} dashboard · showing only ${escapeHtml(yearSelector.value)} subjects</p>` : ''}</div><button class="primary-button" data-action="${dashboard.action}">${dashboard.actionLabel}</button></section><section class="stats-grid" aria-label="Workspace summary">${stats}</section><section class="dashboard-layout"><div class="dashboard-main"><div class="dashboard-heading"><div><p class="eyebrow">${dashboard.classesEyebrow}</p><h2>${role === 'student' ? `${escapeHtml(yearSelector.value)} subjects` : dashboard.classesTitle}</h2></div><button class="text-button" data-view="courses">View all <span>→</span></button></div><div class="classroom-grid" id="dashboardClassrooms">${classes}</div></div><aside class="dashboard-side"><section class="panel dashboard-activity-panel"><div class="panel-heading"><div><p class="eyebrow">${dashboard.activityEyebrow}</p><h2>${dashboard.activityTitle}</h2></div></div><div id="dashboardActivity">${activities || '<p class="empty-copy">Nothing to show yet.</p>'}</div><button class="full-link" data-view="${dashboard.linkView}">${dashboard.linkLabel}<span>→</span></button></section><section class="dashboard-note"><span class="eyebrow">CIT LEARNING HUB</span><strong>One place for the work that moves learning forward.</strong><button data-view="announcements">View announcements →</button></section></aside></section>`;
}

function configureRoleWorkspace(role) {
  const normalizedRole = roleNavigation[role] ? role : 'student';
  const navigation = roleNavigation[normalizedRole];
  document.querySelector('.main-nav').innerHTML = `<p class="nav-label">Workspace</p>${navigation.map(([view, icon, label]) => `<button class="nav-item" data-view="${view}"><span class="nav-icon">${icon}</span>${label}</button>`).join('')}`;
  const name = appShell.dataset.userName || 'CIT account';
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileRole').textContent = normalizedRole === 'programchair' ? 'Program Chair' : normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);
  refreshProfileAvatars();
  yearSelector.hidden = normalizedRole !== 'student';
  document.querySelector('.topbar-year-label').hidden = normalizedRole !== 'student';
  if (normalizedRole === 'student') {
    const savedYear = window.localStorage.getItem('lms-student-year');
    if (yearLevels.includes(savedYear)) yearSelector.value = savedYear;
    updateYearLevel(yearSelector.value);
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${authToken}` }
    });
  } catch {
    throw new Error('Cannot reach the server. Make sure the backend is running.');
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (response.status === 404) throw new Error(`Server route not found for ${path}. Restart the backend server.`);
    throw new Error('The server returned an unexpected response. Make sure the backend is running.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'The request could not be completed.');
  return data;
}

function classroomCard(classroom, action, statusText, extraAction = '') {
  const colors = ['coral', 'navy', 'lime', 'yellow'];
  const color = colors[Number(classroom.id) % colors.length];
  const status = statusText ? `<span class="subject-status ${statusText === 'Accepted' ? 'complete' : 'progress'}">${escapeHtml(statusText)}</span>` : '';
  const coursePath = classroom.programCourseName ? `<small class="classroom-course-path">${escapeHtml(classroom.programCourseName)}${classroom.subjectType ? ` · ${escapeHtml(classroom.subjectType)}` : ''}</small>` : '';
  return `<article class="classroom-card"><div class="classroom-banner ${color}"><span>${escapeHtml(classroom.courseCode)}</span><span>${classroom.studentCount ?? 0} students</span></div><div class="classroom-body"><h3>${escapeHtml(classroom.name)}</h3>${coursePath}<p>${escapeHtml(classroom.instructorName || classroom.description || '')}</p><div class="classroom-footer">${status}<button class="text-button" data-action="${action}" data-class-id="${classroom.id}">${action === 'request-join' ? 'Request to join →' : action === 'open-class' ? 'Open classroom →' : 'View requests →'}</button>${extraAction}</div></div></article>`;
}

function renderClassroomHierarchy(classrooms, renderSubject, programGroups = [], renderCourseAction = null) {
  const programs = new Map();

  programGroups.forEach((item) => {
    const programKey = `program:${item.id}`;
    if (!programs.has(programKey)) programs.set(programKey, { id: item.id, name: item.name, courses: new Map() });
    item.courses.forEach((course) => {
      programs.get(programKey).courses.set(`course:${course.id}`, {
        id: course.id,
        programId: item.id,
        name: course.name,
        description: course.description,
        subjects: new Map()
      });
    });
  });

  classrooms.forEach((classroom) => {
    const programKey = classroom.programId == null ? `unassigned:${classroom.programName || ''}` : `program:${classroom.programId}`;
    if (!programs.has(programKey)) {
      programs.set(programKey, {
        id: classroom.programId ?? null,
        name: classroom.programName || 'Unassigned program',
        courses: new Map()
      });
    }

    const program = programs.get(programKey);
    const courseKey = classroom.programCourseId == null ? 'uncategorized' : `course:${classroom.programCourseId}`;
    if (!program.courses.has(courseKey)) {
      program.courses.set(courseKey, {
        id: classroom.programCourseId ?? null,
        programId: classroom.programId ?? null,
        name: classroom.programCourseName || 'Uncategorized course',
        subjects: new Map()
      });
    }

    const course = program.courses.get(courseKey);
    const subjectType = ['Major', 'Minor'].includes(classroom.subjectType) ? classroom.subjectType : 'Uncategorized subjects';
    if (!course.subjects.has(subjectType)) course.subjects.set(subjectType, []);
    course.subjects.get(subjectType).push(classroom);
  });

  if (!programs.size) return '';

  return `<div class="classroom-hierarchy">${[...programs.values()].sort((a, b) => a.name.localeCompare(b.name)).map((program) => {
    const subjects = [...program.courses.values()].flatMap((course) => [...course.subjects.values()].flat()).length;
    const courses = [...program.courses.values()].filter((course) => course.id != null).length;
    const courseGroups = [...program.courses.values()].sort((a, b) => a.name.localeCompare(b.name)).map((course) => {
      const courseSubjects = [...course.subjects.values()].flat().length;
      const subjectGroups = ['Major', 'Minor', 'Uncategorized subjects']
        .filter((type) => course.subjects.has(type))
        .map((type) => {
          const items = course.subjects.get(type);
          return `<section class="hierarchy-subject-group"><h4>${escapeHtml(type)} <span>${items.length}</span></h4><div class="classroom-grid">${items.map(renderSubject).join('')}</div></section>`;
        }).join('');
      const emptyCourse = courseSubjects ? '' : '<p class="empty-copy">Add Major and Minor subjects to this course.</p>';
      const courseDetails = `<details class="classroom-hierarchy-course"><summary><span>${escapeHtml(course.name)}</span><span class="hierarchy-count">${courseSubjects} ${courseSubjects === 1 ? 'subject' : 'subjects'}</span></summary><div class="hierarchy-course-content">${subjectGroups || emptyCourse}</div></details>`;
      return renderCourseAction ? `<div class="classroom-hierarchy-course-row">${courseDetails}${renderCourseAction(course)}</div>` : courseDetails;
    }).join('');
    const emptyProgram = courseGroups ? '' : '<p class="empty-copy">No courses have been added to this program yet.</p>';
    return `<details class="classroom-hierarchy-program"><summary><span class="hierarchy-program-name">${escapeHtml(program.name)}</span><span class="hierarchy-count">${courses} ${courses === 1 ? 'course' : 'courses'} · ${subjects} ${subjects === 1 ? 'subject' : 'subjects'}</span></summary><div class="hierarchy-program-content">${courseGroups || emptyProgram}</div></details>`;
  }).join('')}</div>`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2300);
}

function setView(view) {
  window.clearInterval(chatPollTimer);
  window.clearInterval(modulePollTimer);
  chatPollTimer = undefined;
  modulePollTimer = undefined;
  activeChatClassId = undefined;
  activeView = view;
  const title = view === 'courses' && appShell.dataset.role === 'dean'
    ? 'All programs'
    : view === 'courses' && appShell.dataset.role === 'programchair'
      ? 'All subjects'
      : viewNames[view] || 'Overview';
  pageTitle.textContent = title;
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  pageContainer.innerHTML = view === 'overview' ? renderRoleDashboard(appShell.dataset.role || 'student') : view === 'announcements' ? '<section class="view-header"><div><p class="eyebrow">STAY INFORMED</p><h1>Announcements</h1><p class="subtitle">Updates posted by instructors in your subjects.</p></div><button class="filter-button" data-action="refresh-announcements">Refresh</button></section><section class="panel announcements-page" id="announcementsFeed"><p class="empty-copy">Loading announcements...</p></section>' : viewMarkup[view] || roleViewMarkup[view] || overviewMarkup;
  if (view === 'learning-arc') {
    const syllabusLink = pageContainer.querySelector('[data-view="syllabus"]');
    if (syllabusLink) {
      syllabusLink.dataset.view = 'courses';
      syllabusLink.textContent = 'View my subjects';
    }
  }
  if (view === 'overview') {
    const dashboardGreeting = pageContainer.querySelector('#greeting');
    if (dashboardGreeting) dashboardGreeting.textContent = `Welcome, ${appShell.dataset.userName || 'learner'}!`;
  }
  updateYearLevel(yearSelector.value);
  if (view === 'settings') initSettingsView();
  if (view !== 'overview' && !appShell.hidden) showToast(`${title} opened`);
  bindDynamicActions();
  sidebar.classList.remove('open');
  loadRoleView(view);
}

function emptyState(title, detail, actionLabel, view) {
  return `<div class="empty-state"><span class="empty-state-mark">▦</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p>${actionLabel ? `<button class="primary-button" data-view="${view}">${escapeHtml(actionLabel)}</button>` : ''}</div>`;
}

async function renderClassroomsView() {
  const role = appShell.dataset.role;
  if (role === 'student') {
    const yearClassrooms = classroomsForSelectedYear();
    const accepted = yearClassrooms.filter((classroom) => classroom.membershipStatus === 'Accepted');
    const pending = yearClassrooms.filter((classroom) => classroom.membershipStatus === 'Pending');
    const hierarchy = renderClassroomHierarchy(accepted, (classroom) => classroomCard(classroom, 'open-class', 'Accepted', `<button class="text-button leave-class-button" data-action="leave-class" data-class-id="${classroom.id}">Leave</button>`));
    const pendingRows = pending.map((classroom) => `<article class="workspace-row"><div><strong>${escapeHtml(classroom.name)}</strong><small>${escapeHtml(classroom.courseCode)} · ${escapeHtml(classroom.instructorName)}</small></div><span class="subject-status progress">Awaiting approval</span></article>`).join('');
    pageContainer.innerHTML = `<section class="view-header"><div><p class="eyebrow">STUDENT WORKSPACE · ${escapeHtml(yearSelector.value.toUpperCase())}</p><h1>My classrooms</h1><p class="subtitle">Your ${escapeHtml(yearSelector.value)} subjects, grouped by program, course, and Major or Minor classification.</p></div><button class="primary-button" data-view="catalog">Find a classroom</button></section>${hierarchy || emptyState('No classrooms yet', `Your ${yearSelector.value} class materials and modules will appear here after an instructor accepts your request.`, 'Find a classroom', 'catalog')}${pendingRows ? `<section class="panel pending-panel"><div class="panel-heading"><h2>Requests waiting for approval</h2></div>${pendingRows}</section>` : ''}`;
    return;
  }

  if (role === 'programchair') {
    renderProgramChairSubjects();
    return;
  }

  if (role === 'dean') {
    pageContainer.innerHTML = '<div class="empty-state"><strong>Loading programs</strong><p>Getting programs, courses, and subjects.</p></div>';
    try {
      const [programResult, courseResult] = await Promise.all([
        apiRequest('/api/programs'),
        apiRequest('/api/program-courses')
      ]);
      if (activeView !== 'courses' || appShell.dataset.role !== 'dean') return;
      const programs = programResult.programs || [];
      const programCourses = courseResult.courses || [];
      const programGroups = programs.map((program) => ({
        id: program.id,
        name: program.name,
        courses: programCourses
          .filter((course) => String(course.programId) === String(program.id))
          .map((course) => ({ id: course.id, name: course.name, description: course.description }))
      }));
      const hierarchy = renderClassroomHierarchy(
        classroomCache,
        (classroom) => classroomCard(classroom, 'open-class', `${classroom.studentCount || 0} students`),
        programGroups
      );
      pageContainer.innerHTML = `<section class="view-header"><div><p class="eyebrow">COLLEGE OVERSIGHT</p><h1>All programs</h1><p class="subtitle">Browse all programs, courses, and their Major or Minor subjects.</p></div><button class="primary-button" data-view="programs">Manage programs</button></section>${hierarchy || emptyState('No programs yet', 'Create a program to see it listed here.', 'Manage programs', 'programs')}`;
    } catch (error) {
      showToast(error.message || 'Could not load all programs.');
    }
    return;
  }

  const hierarchy = renderClassroomHierarchy(classroomCache, (classroom) => classroomCard(classroom, 'open-class', 'Open subject'));
  pageContainer.innerHTML = `<section class="view-header"><div><p class="eyebrow">INSTRUCTOR WORKSPACE</p><h1>My classrooms</h1><p class="subtitle">Browse your subjects by program, course, and Major or Minor classification.</p></div></section>${hierarchy || emptyState('No subjects assigned yet', 'Your Program Chair will assign subjects to your instructor account.', '', '')}`;
}

async function renderProgramChairSubjects() {
  try {
    const [programResult, instructorResult, programCourseResult] = await Promise.all([apiRequest('/api/programs'), apiRequest('/api/instructors'), apiRequest('/api/program-courses')]);
    if (activeView !== 'courses') return;
    const programs = programResult.programs || [];
    const instructors = instructorResult.instructors || [];
    const programCourses = programCourseResult.courses || [];
    const programOptions = programs.map((program) => `<option value="${program.id}" data-department-id="${program.departmentId}">${escapeHtml(program.name)}</option>`).join('');
    const instructorOptions = instructors.map((instructor) => `<option value="${escapeHtml(instructor.userId)}">${escapeHtml(instructor.name)} · ${escapeHtml(instructor.userId)}</option>`).join('');
    const yearOptions = yearLevels.map((year) => `<option value="${year}">${year}</option>`).join('');
    const yearLevelSelect = (selectedYear, label) => `<select name="yearLevel" aria-label="${escapeHtml(label)}" required><option value="">Choose year level</option>${yearLevels.map((year) => `<option value="${year}" ${selectedYear === year ? 'selected' : ''}>${year}</option>`).join('')}</select>`;
    const uncategorized = classroomCache.filter((subject) => !subject.programCourseId);
    const renderSubject = (subject) => {
      const removeButton = `<button class="text-button remove-program-subject-button" data-action="remove-program-subject" data-program-id="${subject.programId}" data-class-id="${subject.id}" data-subject-label="${escapeHtml(`${subject.courseCode} · ${subject.name}`)}">Remove</button>`;
      const availableGroups = programCourses.filter((course) => String(course.programId) === String(subject.programId));
      const editGroupOptions = availableGroups.map((course) => `<option value="${course.id}" ${String(course.id) === String(subject.programCourseId) ? 'selected' : ''}>${escapeHtml(course.name)}</option>`).join('');
      const subjectTypeOptions = ['Major', 'Minor'].map((type) => `<option value="${type}" ${subject.subjectType === type ? 'selected' : ''}>${type}</option>`).join('');
      const instructorEditOptions = instructors.map((instructor) => `<option value="${escapeHtml(instructor.userId)}" ${instructor.userId === subject.instructorUserId ? 'selected' : ''}>${escapeHtml(instructor.name)} · ${escapeHtml(instructor.userId)}</option>`).join('');
      const editForm = `<form class="subject-edit-form academic-form" data-class-id="${subject.id}" data-program-id="${subject.programId}" hidden><label>Subject code<input name="courseCode" value="${escapeHtml(subject.courseCode)}" maxlength="30" required></label><label>Subject name<input name="name" value="${escapeHtml(subject.name)}" maxlength="120" required></label><label>Course<select name="programCourseId" required><option value="">Choose a course</option>${editGroupOptions}</select></label><label>Type<select name="subjectType" required><option value="">Choose type</option>${subjectTypeOptions}</select></label><label>Year level${yearLevelSelect(subject.yearLevel, `Year level for ${subject.name}`)}</label><label>Instructor<select name="instructorUserId" required><option value="">Choose instructor</option>${instructorEditOptions}</select></label><label>Description<input name="description" value="${escapeHtml(subject.description || '')}" maxlength="500"></label><button class="primary-button" type="submit">Save subject</button><button class="text-button" type="button" data-action="cancel-subject-edit">Cancel</button></form>`;
      return `<article class="workspace-row hierarchy-subject-row ${subject.programCourseId ? '' : 'uncategorized-subject'}"><div><strong>${escapeHtml(subject.courseCode)} · ${escapeHtml(subject.name)}</strong><small>${escapeHtml(subject.yearLevel || 'Year level not set')} · ${escapeHtml(subject.instructorName || '')} · ${subject.studentCount || 0} students</small></div><div class="hierarchy-subject-actions"><button class="text-button" data-action="edit-subject">Edit subject</button><button class="text-button" data-action="open-class" data-class-id="${subject.id}">Open subject →</button>${removeButton}</div>${editForm}</article>`;
    };
    const subjectHierarchy = renderClassroomHierarchy(classroomCache, renderSubject, programs.map((program) => ({
      id: program.id,
      name: program.name,
      courses: programCourses
        .filter((course) => String(course.programId) === String(program.id))
        .map((course) => ({ id: course.id, name: course.name }))
    })), (course) => `<div class="hierarchy-course-actions"><button class="text-button" data-action="edit-program-course">Edit course</button><button class="text-button remove-program-course-button" data-action="remove-program-course" data-program-id="${course.programId}" data-course-id="${course.id}" data-course-label="${escapeHtml(course.name)}">Delete course</button><form class="program-course-edit-form academic-form" data-program-id="${course.programId}" data-course-id="${course.id}" hidden><label>Course name<input name="name" value="${escapeHtml(course.name)}" maxlength="120" required></label><label>Description<input name="description" value="${escapeHtml(course.description || '')}" maxlength="500"></label><button class="primary-button" type="submit">Save course</button><button class="text-button" type="button" data-action="cancel-course-edit">Cancel</button></form></div>`);
    pageContainer.innerHTML = `<section class="view-header"><div><p class="eyebrow">PROGRAM CHAIR WORKSPACE</p><h1>All subjects</h1><p class="subtitle">Manage program courses and subjects. Choose a year level when assigning each subject so students see only subjects for their selected year.</p></div></section><form class="classroom-form academic-form" id="programCourseForm"><label>Program<select name="programId" required>${programOptions}</select></label><label>Course name<input name="name" maxlength="120" placeholder="e.g. Computer Technology" required></label><label>Description<input name="description" maxlength="500" placeholder="Optional course description"></label><button class="primary-button" type="submit" ${programs.length ? '' : 'disabled'}>＋ Add course to program</button></form><form class="classroom-form academic-form" id="programSubjectForm"><label>Program<select name="programId" required>${programOptions}</select></label><label>Course<input name="programCourseSearch" list="programCourseChoices" placeholder="Type or choose a course" autocomplete="off" required><datalist id="programCourseChoices"></datalist><input type="hidden" name="programCourseId"></label><label>Subject code<input name="courseCode" maxlength="30" placeholder="e.g. CT1134" required></label><label>Subject name<input name="name" maxlength="120" placeholder="e.g. Objective Oriented Programming" required></label><label>Year level<select name="yearLevel" required><option value="">Choose year level</option>${yearOptions}</select></label><label>Type<select name="subjectType" required><option value="">Major or Minor</option><option>Major</option><option>Minor</option></select></label><label>Instructor<select name="instructorUserId" required><option value="">Choose instructor</option>${instructorOptions}</select></label><label>Description<input name="description" maxlength="500" placeholder="Optional subject details"></label><button class="primary-button" type="submit">＋ Add subject</button><p class="empty-copy" id="programSubjectAvailability" hidden></p></form>${subjectHierarchy || '<p class="empty-copy">No course groups yet. Add a course such as Computer Technology to get started.</p>'}${uncategorized.length ? '<p class="hierarchy-help">Move uncategorized subjects into a course, mark each one as Major or Minor, and assign its year level.</p>' : ''}`;

    const subjectForm = document.getElementById('programSubjectForm');
    const subjectProgramSelect = subjectForm.elements.programId;
    const programCourseInput = subjectForm.elements.programCourseSearch;
    const programCourseIdInput = subjectForm.elements.programCourseId;
    const programCourseList = document.getElementById('programCourseChoices');
    const updateSuggestedValue = (input, hiddenInput, choices, getLabels, getId, message) => {
      const value = input.value.trim().toLocaleLowerCase();
      const matches = value
        ? choices.filter((item) => getLabels(item).some((label) => label.toLocaleLowerCase() === value))
        : [];
      const choice = matches.length === 1 ? matches[0] : null;
      hiddenInput.value = choice ? getId(choice) : '';
      input.setCustomValidity(input.value && !choice ? message : '');
    };
    const filterSubjectOptions = () => {
      const availableProgramCourses = programCourses.filter((course) => String(course.programId) === subjectProgramSelect.value);
      programCourseList.innerHTML = availableProgramCourses.map((course) => `<option value="${escapeHtml(course.name)}"></option>`).join('');
      const availabilityMessages = [];
      if (!availableProgramCourses.length) availabilityMessages.push('Add a course to this program first.');
      if (!instructors.length) availabilityMessages.push('An instructor account is required before assigning a subject.');
      const availability = document.getElementById('programSubjectAvailability');
      const submitButton = subjectForm.querySelector('button[type="submit"]');
      submitButton.disabled = availabilityMessages.length > 0;
      availability.textContent = availabilityMessages.join(' ');
      availability.hidden = !availabilityMessages.length;
      programCourseInput.value = '';
      programCourseIdInput.value = '';
      programCourseInput.setCustomValidity('');
    };
    programCourseInput.addEventListener('input', () => updateSuggestedValue(
      programCourseInput,
      programCourseIdInput,
      programCourses.filter((course) => String(course.programId) === subjectProgramSelect.value),
      (course) => [course.name],
      (course) => course.id,
      'Choose a course from the suggestions.'
    ));
    subjectProgramSelect.addEventListener('change', filterSubjectOptions);
    filterSubjectOptions();
    const groupProgramSelect = document.getElementById('programCourseForm').elements.programId;
    const sharedProgramSelect = subjectProgramSelect;
    const syncProgramSelection = () => { groupProgramSelect.value = sharedProgramSelect.value; };
    sharedProgramSelect.addEventListener('change', syncProgramSelection);
    groupProgramSelect.addEventListener('change', () => { sharedProgramSelect.value = groupProgramSelect.value; filterSubjectOptions(); });
  } catch (error) {
    showToast(error.message || 'Could not load program subjects.');
  }
}

async function renderProgramsView() {
  try {
    const isDean = appShell.dataset.role === 'dean';
    const [programResult, candidateResult, courseResult] = await Promise.all([
      apiRequest('/api/programs'),
      isDean ? apiRequest('/api/program-chair-candidates') : Promise.resolve({ candidates: [] }),
      isDean ? Promise.resolve({ courses: [] }) : apiRequest('/api/department-courses')
    ]);
    if (activeView !== 'programs') return;
    const programs = programResult.programs || [];
    const candidates = candidateResult.candidates || [];
    const courses = courseResult.courses || [];
    const candidateOptions = (selectedId) => candidates.map((candidate) => `<option value="${escapeHtml(candidate.userId)}" ${candidate.userId === selectedId ? 'selected' : ''}>${escapeHtml(candidate.name)} · ${escapeHtml(candidate.userId)}</option>`).join('');
    const rows = programs.map((program) => `<article class="workspace-row program-row"><div><strong>${escapeHtml(program.name)}</strong><small>${escapeHtml(program.departmentCode)} · ${escapeHtml(program.programChairName || (isDean ? 'No Program Chair assigned' : 'Your assigned program'))} · ${program.subjectCount} subjects</small></div>${isDean ? `<div class="program-row-actions"><form class="program-chair-assignment-form" data-program-id="${program.id}"><label class="sr-only" for="chair-${program.id}">Program Chair</label><select id="chair-${program.id}" name="programChairUserId" required><option value="">Choose chair</option>${candidateOptions(program.programChairUserId)}</select><button class="text-button" type="submit">Save</button></form><button class="text-button remove-program-button" data-action="remove-program" data-program-id="${program.id}" data-program-label="${escapeHtml(program.name)}">Delete program</button></div>` : `<span class="subject-status complete">Assigned</span>`}</article>`).join('');
    const candidateFormOptions = candidateOptions('');
    const courseRows = courses.map((course) => `<article class="workspace-row"><div><strong>${escapeHtml(course.courseCode)} · ${escapeHtml(course.name)}</strong><small>${escapeHtml(course.description || 'CIT department course')}</small></div><span class="subject-status complete">CIT</span></article>`).join('');
    const coursePanel = isDean ? '' : `<section class="panel department-courses-panel"><div class="panel-heading"><div><p class="eyebrow">CIT DEPARTMENT</p><h2>Course catalog</h2></div><span class="course-code">${courses.length} courses</span></div><form class="classroom-form academic-form" id="departmentCourseForm"><label>Course code<input name="courseCode" maxlength="30" placeholder="e.g. IT 204" required></label><label>Course name<input name="name" maxlength="120" placeholder="e.g. Web Development" required></label><label>Description<input name="description" maxlength="500" placeholder="Optional course details"></label><button class="primary-button" type="submit">＋ Add CIT course</button></form>${courseRows || '<p class="empty-copy">No courses are available for this CIT program.</p>'}</section>`;
    pageContainer.innerHTML = `<section class="view-header"><div><p class="eyebrow">${isDean ? 'DEAN WORKSPACE' : 'PROGRAM CHAIR WORKSPACE'}</p><h1>${isDean ? 'Programs and CIT courses' : 'Program details'}</h1><p class="subtitle">${isDean ? 'Manage CIT programs. Assign only existing Program Chair accounts.' : 'Manage courses for your assigned CIT program.'}</p></div></section>${isDean ? `<form class="classroom-form academic-form" id="programForm"><label>Program name<input name="name" maxlength="120" placeholder="e.g. Information Technology" required></label><label>Program Chair<select name="programChairUserId"><option value="">Assign later</option>${candidateFormOptions}</select></label><button class="primary-button" type="submit">＋ Create program</button></form>` : ''}<section class="panel"><div class="panel-heading"><h2>${isDean ? 'Programs across the college' : 'Your assigned programs'}</h2><span class="course-code">${programs.length} programs</span></div>${rows || '<p class="empty-copy">No programs have been assigned yet.</p>'}</section>${coursePanel}`;
  } catch (error) {
    showToast(error.message || 'Could not load programs.');
  }
}

function renderClassCatalog() {
  const hierarchy = renderClassroomHierarchy(classroomsForSelectedYear(), (classroom) => {
    const status = classroom.membershipStatus;
    const action = status === 'Accepted'
      ? '<span class="subject-status complete">Joined</span>'
      : status === 'Pending'
        ? '<span class="subject-status progress">Pending approval</span>'
        : `<button class="text-button" data-action="request-join" data-class-id="${classroom.id}">Request to join →</button>`;
    return `<article class="classroom-card"><div class="classroom-banner coral"><span>${escapeHtml(classroom.courseCode)}</span><span>CIT CLASS</span></div><div class="classroom-body"><h3>${escapeHtml(classroom.name)}</h3><p>${escapeHtml(classroom.instructorName || 'Instructor-led classroom')}</p><div class="classroom-footer"><small>${escapeHtml(classroom.description || 'Instructor-led classroom')}</small>${action}</div></div></article>`;
  });
  pageContainer.innerHTML = `<section class="view-header"><div><p class="eyebrow">CLASS DIRECTORY · ${escapeHtml(yearSelector.value.toUpperCase())}</p><h1>Find classrooms</h1><p class="subtitle">Browse ${escapeHtml(yearSelector.value)} subjects by program, course, and Major or Minor classification. Request to join an instructor's classroom; its materials unlock after approval.</p></div></section>${hierarchy || emptyState(`No ${yearSelector.value} classrooms available`, 'Your instructors have not created classrooms for this year yet. Check back later.', '', '')}`;
}

function renderJoinRequests(requests) {
  const rows = requests.map((request) => `<article class="workspace-row request-row"><div><strong>${escapeHtml(request.studentName)}</strong><small>${escapeHtml(request.studentUserId)} · ${escapeHtml(request.className)} · ${escapeHtml(request.courseCode)}</small></div><span class="subject-status progress">Pending</span><button class="primary-button" data-action="accept-request" data-request-id="${request.id}">Accept</button></article>`).join('');
  pageContainer.innerHTML = `<section class="view-header"><div><p class="eyebrow">CLASSROOM ACCESS</p><h1>Join requests</h1><p class="subtitle">Accept a student to add them officially to your classroom.</p></div><button class="filter-button" data-action="refresh-requests">Refresh requests</button></section><section class="panel"><div class="panel-heading"><h2>Waiting for approval</h2><span class="course-code">${requests.length} pending</span></div>${rows || '<p class="empty-copy">No students are waiting to join your classrooms.</p>'}</section>`;
}

function profilePictureUrl(filename) {
  if (!filename) return '';
  if (/^https?:\/\//i.test(filename)) return filename;
  return `${apiBaseUrl}/uploads/avatars/${encodeURIComponent(filename)}`;
}

function initialsFor(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '?'.repeat(1);
}

function applyAvatar(element, name, pictureUrl) {
  if (!element) return;
  if (pictureUrl) {
    element.textContent = '';
    element.style.backgroundImage = `url('${pictureUrl.replace(/'/g, "%27")}')`;
    element.classList.add('avatar-photo');
  } else {
    element.style.backgroundImage = '';
    element.classList.remove('avatar-photo');
    element.textContent = initialsFor(name);
  }
}

async function initSettingsView() {
  const preview = document.getElementById('settingsAvatarPreview');
  const fileInput = document.getElementById('settingsProfilePicture');
  const uploadButton = document.getElementById('settingsAvatarUpload');
  const removeButton = document.getElementById('settingsAvatarRemove');
  const status = document.getElementById('settingsAvatarStatus');
  if (!preview || !fileInput) return;

  const name = appShell.dataset.userName || 'CIT account';
  document.getElementById('settingsFullName').value = name;
  document.getElementById('settingsAccountId').value = appShell.dataset.userId || '';
  document.getElementById('settingsRole').value = document.getElementById('profileRole').textContent || '';
  applyAvatar(preview, name, appShell.dataset.profilePicture ? profilePictureUrl(appShell.dataset.profilePicture) : '');
  preview.classList.toggle('avatar-preview-large', true);
  status.textContent = '';

  try {
    const me = await apiRequest('/api/me');
    if (!preview.isConnected) return;
    if (me.name) appShell.dataset.userName = me.name;
    appShell.dataset.userId = me.userId || appShell.dataset.userId || '';
    appShell.dataset.profilePicture = me.profilePicture || '';
    document.getElementById('settingsFullName').value = me.name || name;
    document.getElementById('settingsAccountId').value = me.userId || '';
    document.getElementById('settingsRole').value = (me.role || appShell.dataset.role || '').charAt(0).toUpperCase() + (me.role || '').slice(1);
    applyAvatar(preview, me.name, me.profilePicture ? profilePictureUrl(me.profilePicture) : '');
    refreshProfileAvatars();
  } catch (error) {
    if (status.isConnected) status.textContent = error.message || 'Could not load your profile.';
  }

  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      preview.style.backgroundImage = `url('${reader.result}')`;
      preview.textContent = '';
      preview.classList.add('avatar-photo');
      status.textContent = 'Ready to upload. Click “Upload picture”.';
    };
    reader.readAsDataURL(file);
  };

  uploadButton.onclick = async () => {
    const file = fileInput.files[0];
    if (!file) {
      status.textContent = 'Choose an image file first.';
      return;
    }
    uploadButton.disabled = true;
    status.textContent = 'Uploading picture...';
    try {
      const payload = new FormData();
      payload.append('profilePicture', file);
      const result = await apiRequest('/api/profile/picture', { method: 'POST', body: payload });
      appShell.dataset.profilePicture = result.profilePicture || '';
      applyAvatar(preview, appShell.dataset.userName, profilePictureUrl(result.profilePicture));
      fileInput.value = '';
      refreshProfileAvatars();
      status.textContent = 'Profile picture updated.';
      showToast('Profile picture updated.');
    } catch (error) {
      status.textContent = error.message || 'Could not update your profile picture.';
    } finally {
      uploadButton.disabled = false;
    }
  };

  removeButton.onclick = async () => {
    removeButton.disabled = true;
    status.textContent = 'Removing picture...';
    try {
      await apiRequest('/api/profile/picture', { method: 'DELETE' });
      appShell.dataset.profilePicture = '';
      fileInput.value = '';
      applyAvatar(preview, appShell.dataset.userName, '');
      refreshProfileAvatars();
      status.textContent = 'Profile picture removed.';
      showToast('Profile picture removed.');
    } catch (error) {
      status.textContent = error.message || 'Could not remove your profile picture.';
    } finally {
      removeButton.disabled = false;
    }
  };
}

function refreshProfileAvatars() {
  const name = appShell.dataset.userName || 'CIT account';
  const picture = appShell.dataset.profilePicture ? profilePictureUrl(appShell.dataset.profilePicture) : '';
  applyAvatar(document.getElementById('profileAvatar'), name, picture);
  applyAvatar(document.getElementById('topbarAvatar'), name, picture);
}

async function renderAssignments() {
  const body = document.getElementById('activitiesBody');
  if (!body) return;
  body.innerHTML = '<div class="empty-state"><strong>Loading activities</strong><p>Gathering submissions from your subjects.</p></div>';
  try {
    const result = await apiRequest('/api/instructor/activities');
    if (activeView !== 'assignments' || !body.isConnected) return;
    const activities = result.activities || [];
    const summary = result.summary || {};

    const statCards = [
      ['Activities', String(summary.activities || 0), 'posted across your subjects', 'coral', '✓'],
      ['Submissions', String(summary.submissions || 0), 'received so far', 'lime', '↗'],
      ['To grade', String(summary.pending || 0), 'awaiting your review', 'yellow', '◒'],
      ['Not submitted', String(summary.missing || 0), 'students yet to submit', 'blue', '◷']
    ].map(([label, value, note, accent, symbol]) => `<article class="stat-card accent-${accent}"><div class="stat-top"><span>${label}</span><span class="stat-symbol">${symbol}</span></div><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join('');

    const rows = activities.map((activity) => {
      const dueAt = activity.dueAt ? new Date(activity.dueAt) : null;
      const hasDue = dueAt && !Number.isNaN(dueAt.getTime());
      const isPastDue = hasDue && dueAt.getTime() <= Date.now();
      const dueLabel = hasDue ? `Due ${dueAt.toLocaleDateString()}${isPastDue ? ' · Closed' : ''}` : 'No due date';
      const missing = Math.max(0, activity.studentCount - activity.submissionCount);
      const statusClass = activity.submissionCount === 0 ? 'progress' : activity.pendingCount > 0 ? 'progress' : 'complete';
      const statusLabel = activity.submissionCount === 0 ? 'No submissions yet' : activity.pendingCount > 0 ? `${activity.pendingCount} to grade` : 'All graded';
      return `<article class="workspace-row activity-row"><div><strong>${escapeHtml(activity.title)}</strong><small>${escapeHtml(activity.courseCode)} · ${escapeHtml(activity.className)} · ${escapeHtml(activity.activityType)} · ${escapeHtml(dueLabel)}</small><small class="activity-row-detail">${activity.submissionCount} of ${activity.studentCount} submitted · ${activity.gradedCount} graded · ${missing} not submitted</small></div><span class="subject-status ${statusClass}">${escapeHtml(statusLabel)}</span><button class="text-button" data-action="review-submissions" data-class-id="${activity.classId}" data-activity-id="${activity.id}">Review →</button></article>`;
    }).join('');

    body.innerHTML = `<section class="stats-grid" aria-label="Activity summary">${statCards}</section><section class="panel"><div class="panel-heading"><h2>Posted activities</h2><span class="course-code">${activities.length} total</span></div>${rows || '<p class="empty-copy">You have not posted any activities yet. Open a subject and create one from its Activities section.</p>'}<div id="instructorActivitySubmissions"></div></section>`;
  } catch (error) {
    if (activeView === 'assignments' && body.isConnected) {
      body.innerHTML = `<div class="empty-state"><strong>Could not load activities</strong><p>${escapeHtml(error.message || 'Please try again.')}</p></div>`;
    }
  }
}

async function renderReports() {
  const body = document.getElementById('reportsBody');
  if (!body) return;
  body.innerHTML = '<div class="empty-state"><strong>Loading report</strong><p>Computing live figures from programs, subjects, and submissions.</p></div>';
  try {
    const report = await apiRequest('/api/reports');
    if (activeView !== 'reports' || !body.isConnected) return;
    const summary = report.summary || {};
    const programs = report.programs || [];
    const courses = report.courses || [];
    const scopedToChair = report.scope === 'programchair';
    const generatedAt = report.generatedAt ? new Date(report.generatedAt) : null;
    const generatedLabel = generatedAt && !Number.isNaN(generatedAt.getTime()) ? generatedAt.toLocaleString() : 'just now';
    const pct = (value) => `${Math.max(0, Math.min(100, Number(value) || 0))}%`;

    const statCards = [
      ['Completion', pct(summary.completionRate), 'graded out of all expected work', 'coral', '◒'],
      ['Submission rate', pct(summary.submissionRate), `${summary.submissionsReceived || 0} of ${summary.expectedSubmissions || 0} expected`, 'lime', '↗'],
      ['Grading rate', pct(summary.gradingRate), `${summary.pendingGrading || 0} awaiting a grade`, 'yellow', '✦'],
      ['Active courses', String(summary.activeCourses || 0), `across ${summary.activePrograms || 0} programs`, 'blue', '▦']
    ].map(([label, value, note, accent, symbol]) => `<article class="stat-card accent-${accent}"><div class="stat-top"><span>${label}</span><span class="stat-symbol">${symbol}</span></div><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join('');

    const programRows = programs.map((program) => {
      const hasActivity = program.submissionCount > 0;
      const detail = `${program.courseCount} course${program.courseCount === 1 ? '' : 's'} · ${program.subjectCount} subject${program.subjectCount === 1 ? '' : 's'} · ${program.studentCount} student${program.studentCount === 1 ? '' : 's'} · ${program.facultyCount} faculty`;
      return `<div class="report-progress"><span>${escapeHtml(program.name)}<small class="report-progress-detail">${escapeHtml(detail)}</small></span><div class="progress-line"><i style="width:${Math.max(0, Math.min(100, program.gradingProgress))}%"></i></div><strong>${hasActivity ? pct(program.gradingProgress) : '—'}</strong></div>`;
    }).join('');

    const courseRows = courses.map((course) => {
      const gradedPct = course.submissionCount > 0 ? Math.round((course.gradedCount / course.submissionCount) * 100) : 0;
      const statusClass = course.submissionCount === 0 ? 'progress' : gradedPct >= 100 ? 'complete' : 'progress';
      const statusLabel = course.submissionCount === 0 ? 'No work yet' : gradedPct >= 100 ? 'Graded' : `${course.submissionCount - course.gradedCount} to grade`;
      return `<div class="workspace-row"><div><strong>${escapeHtml(course.name)} · ${escapeHtml(course.courseCode)}</strong><small>${escapeHtml(course.programName)} · ${escapeHtml(course.instructorName || 'Unassigned')} · ${course.studentCount} student${course.studentCount === 1 ? '' : 's'} · ${course.moduleCount} module${course.moduleCount === 1 ? '' : 's'}</small></div><span class="subject-status ${statusClass}">${escapeHtml(statusLabel)}</span><small class="report-course-detail">${course.activityCount} activit${course.activityCount === 1 ? 'y' : 'ies'} · ${course.submissionCount} submission${course.submissionCount === 1 ? '' : 's'}</small></div>`;
    }).join('');

    const scopeNote = scopedToChair
      ? 'Showing only the program you chair.'
      : `College-wide figures across ${summary.activePrograms || 0} active program${(summary.activePrograms || 0) === 1 ? '' : 's'}.`;

    body.innerHTML = `<p class="report-meta">${escapeHtml(scopeNote)} · ${summary.activeFaculty || 0} teaching faculty · ${summary.enrolledStudents || 0} enrolled students · ${summary.pastDueActivities || 0} past-due activities · Updated ${escapeHtml(generatedLabel)}</p><section class="stats-grid" aria-label="Report metrics">${statCards}</section><section class="panel"><div class="panel-heading"><h2>Program progress</h2><span class="course-code">GRADING COMPLETE</span></div>${programRows || '<p class="empty-copy">No CIT programs are set up yet.</p>'}</section><section class="panel"><div class="panel-heading"><h2>Subject activity</h2><span class="course-code">LIVE DATA</span></div>${courseRows || '<p class="empty-copy">No subjects have been created for your scope yet.</p>'}</section>`;
  } catch (error) {
    if (activeView === 'reports' && body.isConnected) {
      body.innerHTML = `<div class="empty-state"><strong>Report unavailable</strong><p>${escapeHtml(error.message || 'Could not load the academic report.')}</p></div>`;
    }
  }
}

async function exportAcademicReport(button) {
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = 'Preparing…';
  try {
    const report = await apiRequest('/api/reports');
    const summary = report.summary || {};
    const rows = [
      ['Generated', new Date(report.generatedAt || Date.now()).toLocaleString()],
      ['Scope', report.scope === 'programchair' ? 'Program Chair' : 'College-wide'],
      ['Active programs', summary.activePrograms || 0],
      ['Active courses', summary.activeCourses || 0],
      ['Active faculty', summary.activeFaculty || 0],
      ['Enrolled students', summary.enrolledStudents || 0],
      ['Expected submissions', summary.expectedSubmissions || 0],
      ['Submissions received', summary.submissionsReceived || 0],
      ['Submissions graded', summary.gradedSubmissions || 0],
      ['Pending grading', summary.pendingGrading || 0],
      ['Submission rate', `${summary.submissionRate || 0}%`],
      ['Grading rate', `${summary.gradingRate || 0}%`],
      ['Completion rate', `${summary.completionRate || 0}%`],
      ['Average class size', summary.averageClassSize || 0]
    ];
    const programLines = (report.programs || []).map((program) => `${program.name},${program.courseCount},${program.subjectCount},${program.studentCount},${program.facultyCount},${program.gradingProgress}%`);
    const csv = [
      'CIT Learning Hub — Academic Report',
      rows.map(([label, value]) => `${label},${value}`).join('\n'),
      '',
      'Program,Courses,Subjects,Students,Faculty,Grading progress',
      ...programLines
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cit-academic-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Academic report exported as CSV.');
  } catch (error) {
    showToast(error.message || 'Could not export the report.');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

function renderAnnouncements(announcements) {
  const feed = document.getElementById('announcementsFeed');
  if (!feed) return;
  feed.innerHTML = announcements.length ? announcements.map((announcement, index) => {
    const postedAt = new Date(announcement.postedAt);
    const date = Number.isNaN(postedAt.getTime()) ? '' : postedAt.toLocaleString();
    const colors = ['coral-dot', 'blue-dot', 'lime-dot'];
    const coursePath = [announcement.programName, announcement.programCourseName, announcement.subjectType].filter(Boolean).join(' · ');
    return `<article class="announcement full-announcement"><span class="announcement-dot ${colors[index % colors.length]}"></span><div><strong>${escapeHtml(announcement.title)}</strong><p>${escapeHtml(announcement.message)}</p><time>${escapeHtml(announcement.postedBy)} · ${escapeHtml(announcement.subjectName)} · ${escapeHtml(announcement.courseCode)}${coursePath ? ` · ${escapeHtml(coursePath)}` : ''}${date ? ` · ${escapeHtml(date)}` : ''}</time></div></article>`;
  }).join('') : '<p class="empty-copy">No announcements have been posted for your subjects yet.</p>';
}

function renderPasswordResetRequests(requests) {
  const rows = requests.map((request) => `<article class="workspace-row reset-request-row" data-request-id="${request.id}"><div><strong>${escapeHtml(request.name)}</strong><small>${escapeHtml(request.userId)} · ${escapeHtml(request.role)} · ${escapeHtml(new Date(request.requestedAt).toLocaleString())}</small></div><button class="text-button" data-action="issue-password-reset" data-request-id="${request.id}">Verify and issue code</button><button class="text-button reset-reject-button" data-action="reject-password-reset" data-request-id="${request.id}">Reject</button></article>`).join('');
  pageContainer.innerHTML = `<section class="view-header"><div><p class="eyebrow">ACCOUNT SECURITY</p><h1>Password reset requests</h1><p class="subtitle">Verify the person's identity through your established school process before issuing a one-time code.</p></div><button class="filter-button" data-action="refresh-password-resets">Refresh requests</button></section><div id="issuedResetCodePanel" class="issued-reset-code" hidden></div><section class="panel"><div class="panel-heading"><h2>Waiting for verification</h2><span class="course-code">${requests.length} pending</span></div>${rows || '<p class="empty-copy">No password reset requests are waiting.</p>'}</section>`;
}

function renderSignupRequests(requests) {
  const role = appShell.dataset.role;
  const isDean = role === 'dean';
  const rows = requests.map((request) => `<article class="workspace-row signup-request-row"><div><strong>${escapeHtml(request.firstName)} ${escapeHtml(request.lastName)}</strong><small>${escapeHtml(request.requestedRole)} · ${escapeHtml(request.userId)} · ${escapeHtml(request.programName)} · ${escapeHtml(new Date(request.requestedAt).toLocaleString())}</small></div><button class="text-button" data-action="approve-signup" data-request-id="${request.id}">Approve account</button><button class="text-button reset-reject-button" data-action="reject-signup" data-request-id="${request.id}">Reject</button></article>`).join('');
  pageContainer.innerHTML = `<section class="view-header"><div><p class="eyebrow">ACCOUNT REVIEW</p><h1>Account signup approvals</h1><p class="subtitle">${isDean ? 'Review student and instructor account requests. Instructor requests require Dean approval.' : 'Review student account requests for your program.'}</p></div><button class="filter-button" data-action="refresh-signups">Refresh</button></section><section class="panel"><div class="panel-heading"><h2>Waiting for approval</h2><span class="course-code">${requests.length} pending</span></div>${rows || '<p class="empty-copy">No account signup requests are waiting.</p>'}</section>`;
}

async function loadRoleView(view) {
  const role = appShell.dataset.role;
  if (!authToken || !['student', 'instructor', 'programchair', 'dean'].includes(role)) return;
  if (!['overview', 'courses', 'catalog', 'requests', 'programs', 'reports', 'assignments', 'password-resets', 'signup-requests', 'announcements'].includes(view)) return;

  try {
    const result = await apiRequest('/api/classrooms');
    classroomCache = result.classrooms || [];
    if (activeView !== view) return;

    if (view === 'announcements') {
      const announcementResult = await apiRequest('/api/announcements');
      if (activeView === view) renderAnnouncements(announcementResult.announcements || []);
      return;
    }

    if (view === 'programs' && ['dean', 'programchair'].includes(role)) {
      await renderProgramsView();
      return;
    }
    if (view === 'reports' && ['dean', 'programchair'].includes(role)) {
      await renderReports();
      return;
    }
    if (view === 'assignments') {
      await renderAssignments();
      return;
    }
    if (view === 'password-resets' && role === 'dean') {
      const resetResult = await apiRequest('/api/password-reset-requests');
      if (activeView === view) renderPasswordResetRequests(resetResult.requests || []);
      return;
    }
    if (view === 'signup-requests' && ['dean', 'programchair'].includes(role)) {
      const signupResult = await apiRequest('/api/signup-requests');
      if (activeView === view) renderSignupRequests(signupResult.requests || []);
      return;
    }

    if (view === 'catalog' && role === 'student') {
      renderClassCatalog();
      return;
    }
    if (view === 'courses') {
      await renderClassroomsView();
      if (showClassroomFormOnLoad) {
        showClassroomFormOnLoad = false;
        const form = document.getElementById('createClassroomForm');
        if (form) {
          form.hidden = false;
          form.querySelector('input')?.focus();
        }
      }
      return;
    }
    if (view === 'requests' && role === 'instructor') {
      const requestResult = await apiRequest('/api/classroom-requests');
      if (activeView === view) renderJoinRequests(requestResult.requests || []);
      return;
    }
    if (view !== 'overview') return;

    if (role === 'programchair' || role === 'dean') {
      const stats = pageContainer.querySelectorAll('.stat-card > strong');
      const classGrid = pageContainer.querySelector('#dashboardClassrooms');
      const activity = pageContainer.querySelector('#dashboardActivity');
      const enrolledStudents = classroomCache.reduce((total, classroom) => total + Number(classroom.studentCount || 0), 0);
      if (role === 'dean') {
        const [programResult, instructorResult] = await Promise.all([apiRequest('/api/programs'), apiRequest('/api/instructors')]);
        if (stats[0]) stats[0].textContent = String(programResult.programs.length);
        if (stats[1]) stats[1].textContent = String(classroomCache.length);
        if (stats[2]) stats[2].textContent = String(instructorResult.instructors.length);
        if (stats[3]) stats[3].textContent = String(enrolledStudents);
      } else {
        if (stats[0]) stats[0].textContent = String(classroomCache.length);
        if (stats[1]) stats[1].textContent = String(enrolledStudents);
        if (stats[2]) stats[2].textContent = String(classroomCache.reduce((total, classroom) => total + Number(classroom.moduleCount || 0), 0));
        if (stats[3]) stats[3].textContent = String(classroomCache.reduce((total, classroom) => total + Number(classroom.activityCount || 0), 0));
      }
      if (classGrid) classGrid.innerHTML = classroomCache.slice(0, 4).map((classroom) => classroomCard(classroom, 'open-class', `${classroom.studentCount || 0} students`)).join('') || emptyState('No subjects to monitor', 'Subjects assigned to this scope will appear here.', role === 'dean' ? 'Manage programs' : 'Open program subjects', role === 'dean' ? 'programs' : 'courses');
      if (activity) activity.innerHTML = classroomCache.length ? classroomCache.slice(0, 5).map((classroom) => `<article class="dashboard-activity"><span class="activity-marker"></span><div><strong>${escapeHtml(classroom.name)}</strong><small>${escapeHtml(classroom.programName || classroom.courseCode)} · ${escapeHtml(classroom.instructorName || '')}</small></div><span class="activity-status">${classroom.moduleCount || 0} modules</span></article>`).join('') : '<p class="empty-copy">No subjects assigned to this scope yet.</p>';
      return;
    }

    const stats = pageContainer.querySelectorAll('.stat-card > strong');
    const classGrid = pageContainer.querySelector('#dashboardClassrooms');
    const activity = pageContainer.querySelector('#dashboardActivity');
    if (role === 'student') {
      const yearClassrooms = classroomsForSelectedYear();
      const accepted = yearClassrooms.filter((classroom) => classroom.membershipStatus === 'Accepted');
      const pending = yearClassrooms.filter((classroom) => classroom.membershipStatus === 'Pending');
      const greeting = pageContainer.querySelector('#greeting');
      if (greeting) greeting.textContent = `Welcome, ${appShell.dataset.userName || 'learner'} · ${yearSelector.value}`;
      if (stats[0]) stats[0].textContent = String(accepted.length);
      if (stats[1]) stats[1].textContent = accepted.length ? '—' : '—';
      if (stats[2]) stats[2].textContent = '0';
      if (stats[3]) stats[3].textContent = String(pending.length);
      if (classGrid) classGrid.innerHTML = accepted.length ? accepted.map((classroom) => classroomCard(classroom, 'open-class', 'Accepted', `<button class="text-button leave-class-button" data-action="leave-class" data-class-id="${classroom.id}">Leave</button>`)).join('') : emptyState(`No ${yearSelector.value} classrooms yet`, `Your ${yearSelector.value} Major and Minor subjects will appear here after you join and your instructor accepts your request.`, 'Find a classroom', 'catalog');
      if (activity) activity.innerHTML = pending.length ? pending.map((classroom) => `<article class="dashboard-activity"><span class="activity-marker"></span><div><strong>${escapeHtml(classroom.name)}</strong><small>${escapeHtml(classroom.instructorName)}</small></div><span class="activity-status">Pending</span></article>`).join('') : `<p class="empty-copy">${accepted.length ? 'No assignments have been posted to your classrooms yet.' : 'No class activity until you join a classroom.'}</p>`;
      return;
    }

    const requestResult = await apiRequest('/api/classroom-requests');
    if (activeView !== view) return;
    const requests = requestResult.requests || [];
    const students = classroomCache.reduce((total, classroom) => total + Number(classroom.studentCount || 0), 0);
    if (stats[0]) stats[0].textContent = String(classroomCache.length);
    if (stats[1]) stats[1].textContent = String(requests.length);
    if (stats[2]) stats[2].textContent = String(students);
    if (stats[3]) stats[3].textContent = '0';
    if (classGrid) classGrid.innerHTML = classroomCache.map((classroom) => classroomCard(classroom, 'view-requests', `${classroom.pendingCount || 0} pending`)).join('') || emptyState('No classrooms created', 'Create a classroom to start receiving student join requests.', 'Create classroom', 'courses');
    if (activity) activity.innerHTML = requests.length ? requests.slice(0, 4).map((request) => `<article class="dashboard-activity"><span class="activity-marker"></span><div><strong>${escapeHtml(request.studentName)}</strong><small>${escapeHtml(request.className)}</small></div><button class="activity-accept" data-action="accept-request" data-request-id="${request.id}">Accept</button></article>`).join('') : '<p class="empty-copy">No pending join requests.</p>';
  } catch (error) {
    if (activeView === view) showToast(error.message || 'Could not load classroom data.');
  }
}

function openClassroom(classId) {
  const classroom = classroomCache.find((item) => String(item.id) === String(classId));
  if (!classroom || (appShell.dataset.role === 'student' && classroom.membershipStatus !== 'Accepted')) {
    showToast('Only approved classroom members can open class materials.');
    return;
  }

  const role = appShell.dataset.role;
  const isInstructor = role === 'instructor';
  const leaveClassAction = role === 'student' ? `<button class="text-button leave-class-button" data-action="leave-class" data-class-id="${classroom.id}">Leave classroom</button>` : '';
  window.clearInterval(chatPollTimer);
  window.clearInterval(modulePollTimer);
  activeChatClassId = classroom.id;
  activeView = 'class-detail';
  pageTitle.textContent = classroom.name;
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => item.classList.toggle('active', item.dataset.view === 'courses'));
  const uploadForm = isInstructor ? `<form class="module-upload-form" id="moduleUploadForm"><div class="module-upload-fields"><label>Module title<input name="title" maxlength="120" placeholder="e.g. Week 1 learning guide" required></label><label>Description <span>(optional)</span><textarea name="description" maxlength="500" rows="2" placeholder="Add a short note for students"></textarea></label></div><label>Module file<input name="moduleFile" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp,.zip" required></label><div class="module-upload-footer"><small>PDF, Office, text, image, or ZIP · up to 20 MB</small><button class="primary-button" type="submit">Upload module</button></div></form>` : '';
  const activityForm = isInstructor ? `<form class="classroom-form academic-form" id="activityForm"><label>Activity title<input name="title" maxlength="160" placeholder="e.g. Network addressing exercise" required></label><label>Type<select name="activityType"><option>Assignment</option><option>Quiz</option></select></label><label>Instructions or question<textarea name="instructions" maxlength="2000" rows="3" required></textarea></label><div class="module-upload-fields"><label>Due date<input name="dueAt" type="datetime-local"></label><label>Points<input name="points" type="number" min="1" max="1000" value="100" required></label></div><button class="primary-button" type="submit">＋ Create activity</button></form>` : '';
  const announcementForm = isInstructor ? `<form class="classroom-form academic-form" id="announcementForm"><label>Announcement title<input name="title" maxlength="160" required></label><label>Message<textarea name="message" maxlength="2000" rows="3" required></textarea></label><button class="primary-button" type="submit">Post announcement</button></form>` : '';
  const rosterForm = isInstructor ? `<form class="roster-add-form" id="addStudentForm"><label for="studentAccountId">Add existing student account</label><div><input id="studentAccountId" name="studentUserId" maxlength="50" placeholder="Student account ID" required><button class="filter-button" type="submit">Add student</button></div><small>Students can also request to join this subject from Find classrooms.</small></form>` : '';
  const chatComposer = ['student', 'instructor'].includes(role) ? `<form class="chat-compose" id="classChatForm"><label for="classChatInput">Message to the class</label><textarea id="classChatInput" name="message" maxlength="2000" rows="2" placeholder="Write a message to your class..." required></textarea><button class="primary-button" type="submit">Send message</button></form>` : '<p class="empty-copy">Read-only monitoring view.</p>';
  pageContainer.innerHTML = `<section class="view-header"><div><p class="eyebrow">${escapeHtml(classroom.programName || 'PROGRAM')}${classroom.programCourseName ? ` · ${escapeHtml(classroom.programCourseName)}` : ''}${classroom.subjectType ? ` · ${escapeHtml(classroom.subjectType)}` : ''} · ${escapeHtml(classroom.courseCode)} · ${escapeHtml(classroom.instructorName || '')}</p><h1>${escapeHtml(classroom.name)}</h1><p class="subtitle">${escapeHtml(classroom.description || 'Subject materials, activities, announcements, and class discussion.')}</p></div><div class="classroom-header-actions">${leaveClassAction}<button class="filter-button" data-view="courses">← Back to subjects</button></div></section><section class="panel uploaded-modules-panel"><div class="panel-heading"><div><p class="eyebrow">SUBJECT MATERIALS</p><h2>Modules</h2></div></div><div class="uploaded-module-list" id="uploadedModulesList"><p class="empty-copy">Loading modules...</p></div>${uploadForm}</section><section class="panel subject-activities-panel"><div class="panel-heading"><div><p class="eyebrow">LEARNING WORK</p><h2>Activities and submissions</h2></div></div>${activityForm}<div id="classroomActivities"><p class="empty-copy">Loading activities...</p></div></section><section class="panel subject-announcements-panel"><div class="panel-heading"><div><p class="eyebrow">SUBJECT UPDATES</p><h2>Announcements</h2></div></div>${announcementForm}<div id="classroomAnnouncements"><p class="empty-copy">Loading announcements...</p></div></section>${rosterForm ? `<section class="panel roster-panel"><div class="panel-heading"><div><p class="eyebrow">CLASS ROSTER</p><h2>Enrolled students</h2></div></div>${rosterForm}<div id="classroomRoster"><p class="empty-copy">Loading roster...</p></div></section>` : ''}<section class="panel class-chat"><div class="panel-heading"><div><p class="eyebrow">CLASSROOM CHAT</p><h2>${escapeHtml(classroom.name)} · ${escapeHtml(classroom.courseCode)}</h2></div><span class="course-code">Refreshes every 5 seconds</span></div><div class="chat-messages" id="classChatMessages" aria-live="polite"><p class="empty-copy">Loading messages...</p></div>${chatComposer}</section>`;
  loadClassChat(classroom.id);
  loadClassroomModules(classroom.id);
  loadClassroomActivities(classroom.id);
  loadClassroomAnnouncements(classroom.id);
  loadClassroomRoster(classroom.id);
  chatPollTimer = window.setInterval(() => loadClassChat(classroom.id, true), 5000);
  modulePollTimer = window.setInterval(() => {
    loadClassroomModules(classroom.id, true);
    loadClassroomActivities(classroom.id, true);
    loadClassroomAnnouncements(classroom.id, true);
    loadClassroomRoster(classroom.id, true);
  }, 15000);
}

async function loadClassroomActivities(classId, quiet = false) {
  const activityList = document.getElementById('classroomActivities');
  if (activeView !== 'class-detail' || !activityList) return;
  const role = appShell.dataset.role;

  try {
    const result = await apiRequest(`/api/classrooms/${classId}/activities`);
    if (activeView !== 'class-detail' || activeChatClassId !== classId || !activityList.isConnected) return;
    const activities = result.activities || [];
    activityList.innerHTML = activities.length ? activities.map((activity) => {
      const dueAt = activity.dueAt ? new Date(activity.dueAt) : null;
      const hasValidDueDate = dueAt && !Number.isNaN(dueAt.getTime());
      const isPastDue = hasValidDueDate && dueAt.getTime() <= Date.now();
      const due = hasValidDueDate ? `${dueAt.toLocaleString()}${isPastDue ? ' · Closed' : ''}` : 'No due date';
      const isStudent = role === 'student';
      const studentWork = isStudent ? `<form class="activity-submission-form" data-activity-id="${activity.id}"><label>Your answer<textarea name="answer" maxlength="12000" rows="4" ${isPastDue ? 'disabled' : 'required'}>${escapeHtml(activity.answer || '')}</textarea></label><div class="activity-submit-footer">${activity.grade !== null ? `<span class="subject-status complete">Graded: ${escapeHtml(activity.grade)} / ${escapeHtml(activity.points)}</span>` : activity.submittedAt ? '<span class="subject-status progress">Submitted</span>' : '<span></span>'}${isPastDue ? '<button class="text-button" type="button" disabled>Closed</button>' : `<button class="text-button" type="submit">${activity.answer ? 'Update answer' : 'Submit answer'}</button>`}</div>${isPastDue ? '<p class="activity-feedback">The due date has passed. Answers can no longer be submitted or edited.</p>' : ''}${activity.feedback ? `<p class="activity-feedback">Instructor feedback: ${escapeHtml(activity.feedback)}</p>` : ''}</form>` : '';
      const instructorAction = ['instructor', 'dean', 'programchair'].includes(role) ? `<button class="text-button" data-action="review-submissions" data-activity-id="${activity.id}">Review ${activity.submissionCount} submissions</button><div class="activity-submissions" id="activitySubmissions-${activity.id}"></div>` : '';
      const monitorInfo = ['dean', 'programchair'].includes(role) ? `<small>${activity.submissionCount} student submissions</small>` : '';
      return `<article class="classroom-activity"><div class="activity-heading"><div><span class="subject-status ${activity.activityType === 'Quiz' ? 'progress' : 'complete'}">${escapeHtml(activity.activityType)}</span><h3>${escapeHtml(activity.title)}</h3></div><small>${escapeHtml(due)} · ${escapeHtml(activity.points)} points</small></div><p>${escapeHtml(activity.instructions)}</p>${studentWork}${instructorAction}${monitorInfo}</article>`;
    }).join('') : '<p class="empty-copy">No activities have been posted for this subject yet.</p>';
  } catch (error) {
    if (!quiet && activeView === 'class-detail') showToast(error.message || 'Could not load activities.');
  }
}

async function loadActivitySubmissions(classId, activityId, resultAreaId) {
  const resultArea = document.getElementById(resultAreaId || `activitySubmissions-${activityId}`);
  if (!resultArea) return;
  resultArea.innerHTML = '<p class="empty-copy">Loading submissions...</p>';
  resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  try {
    const result = await apiRequest(`/api/classrooms/${classId}/activities/${activityId}/submissions`);
    if (!resultArea.isConnected) return;
    const submissions = result.submissions || [];
    resultArea.innerHTML = submissions.length ? submissions.map((submission) => `<article class="student-submission"><div><strong>${escapeHtml(submission.studentName)} · ${escapeHtml(submission.studentUserId)}</strong><small>Submitted ${escapeHtml(new Date(submission.submittedAt).toLocaleString())}</small></div><p>${escapeHtml(submission.answer)}</p>${appShell.dataset.role === 'instructor' ? `<form class="grade-submission-form" data-activity-id="${activityId}" data-class-id="${classId}" data-submission-id="${submission.id}"><label>Grade<input name="grade" type="number" min="0" max="${escapeHtml(submission.points)}" step="0.01" value="${submission.grade === null ? '' : escapeHtml(submission.grade)}" required></label><label>Feedback<input name="feedback" maxlength="1000" value="${escapeHtml(submission.feedback || '')}"></label><button class="text-button" type="submit">Save grade</button></form>` : `<small>${submission.grade === null ? 'Not graded' : `Grade: ${escapeHtml(submission.grade)} / ${escapeHtml(submission.points)}`}${submission.feedback ? ` · ${escapeHtml(submission.feedback)}` : ''}</small>`}</article>`).join('') : '<p class="empty-copy">No submissions yet.</p>';
  } catch (error) {
    resultArea.innerHTML = `<p class="empty-copy">${escapeHtml(error.message)}</p>`;
  }
}

async function loadClassroomAnnouncements(classId, quiet = false) {
  const announcementList = document.getElementById('classroomAnnouncements');
  if (activeView !== 'class-detail' || !announcementList) return;

  try {
    const result = await apiRequest(`/api/classrooms/${classId}/announcements`);
    if (activeView !== 'class-detail' || activeChatClassId !== classId || !announcementList.isConnected) return;
    const announcements = result.announcements || [];
    announcementList.innerHTML = announcements.length ? announcements.map((announcement) => `<article class="subject-announcement"><div><strong>${escapeHtml(announcement.title)}</strong><small>${escapeHtml(announcement.postedBy)} · ${escapeHtml(new Date(announcement.postedAt).toLocaleString())}</small></div><p>${escapeHtml(announcement.message)}</p></article>`).join('') : '<p class="empty-copy">No announcements have been posted for this subject yet.</p>';
  } catch (error) {
    if (!quiet && activeView === 'class-detail') showToast(error.message || 'Could not load announcements.');
  }
}

async function loadClassroomRoster(classId, quiet = false) {
  const roster = document.getElementById('classroomRoster');
  if (activeView !== 'class-detail' || !roster) return;
  try {
    const result = await apiRequest(`/api/classrooms/${classId}/students`);
    if (activeView !== 'class-detail' || activeChatClassId !== classId || !roster.isConnected) return;
    const students = result.students || [];
    roster.innerHTML = students.length ? students.map((student) => `<article class="workspace-row"><div><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.userId)}</small></div><span class="subject-status complete">Enrolled</span><button class="text-button remove-student-button" data-action="remove-student" data-class-id="${classId}" data-student-id="${escapeHtml(student.userId)}">Remove</button></article>`).join('') : '<p class="empty-copy">No students are enrolled in this subject yet.</p>';
  } catch (error) {
    if (!quiet && activeView === 'class-detail') showToast(error.message || 'Could not load the subject roster.');
  }
}

async function loadClassChat(classId, quiet = false) {
  if (activeView !== 'class-detail' || !document.getElementById('classChatMessages')) return;
  const messageList = document.getElementById('classChatMessages');
  const wasAtBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 40;

  try {
    const result = await apiRequest(`/api/classrooms/${classId}/messages`);
    if (activeView !== 'class-detail' || !messageList.isConnected) return;
    const messages = result.messages || [];
    messageList.innerHTML = messages.length ? messages.map((message) => {
      const sentAt = new Date(message.sentAt);
      const time = Number.isNaN(sentAt.getTime()) ? '' : sentAt.toLocaleString();
      return `<article class="chat-message"><div><strong>${escapeHtml(message.senderName)}</strong><time>${escapeHtml(time)}</time></div><p>${escapeHtml(message.message)}</p></article>`;
    }).join('') : '<p class="empty-copy">No messages yet. Start the conversation.</p>';
    if (wasAtBottom || !messages.length) messageList.scrollTop = messageList.scrollHeight;
  } catch (error) {
    if (!quiet && activeView === 'class-detail') showToast(error.message || 'Could not load class chat.');
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadClassroomModules(classId, quiet = false) {
  const moduleList = document.getElementById('uploadedModulesList');
  if (activeView !== 'class-detail' || !moduleList) return;

  try {
    const result = await apiRequest(`/api/classrooms/${classId}/modules`);
    if (activeView !== 'class-detail' || activeChatClassId !== classId || !moduleList.isConnected) return;
    const modules = result.modules || [];
    moduleList.innerHTML = modules.length ? modules.map((module) => {
      const uploadedAt = new Date(module.uploadedAt);
      const date = Number.isNaN(uploadedAt.getTime()) ? '' : uploadedAt.toLocaleDateString();
      return `<article class="uploaded-module-row"><div class="uploaded-module-icon" aria-hidden="true">↓</div><div class="uploaded-module-copy"><strong>${escapeHtml(module.title)}</strong><p>${escapeHtml(module.description || module.fileName)}</p><small>${escapeHtml(module.fileName)} · ${formatFileSize(Number(module.fileSize))}${date ? ` · ${escapeHtml(date)}` : ''}</small></div><button class="text-button" data-action="download-module" data-class-id="${classId}" data-module-id="${module.id}" data-file-name="${escapeHtml(module.fileName)}">Download</button></article>`;
    }).join('') : '<p class="empty-copy">No modules have been uploaded for this subject yet.</p>';
  } catch (error) {
    if (!quiet && activeView === 'class-detail') showToast(error.message || 'Could not load classroom modules.');
  }
}

async function downloadClassroomModule(button) {
  button.disabled = true;
  try {
    const response = await fetch(`${apiBaseUrl}/api/classrooms/${button.dataset.classId}/modules/${button.dataset.moduleId}/download`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Could not download module.');
    }
    const fileUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = button.dataset.fileName || 'class-module';
    link.click();
    URL.revokeObjectURL(fileUrl);
  } catch (error) {
    showToast(error.message || 'Could not download module.');
  } finally {
    if (button.isConnected) button.disabled = false;
  }
}

function bindDynamicActions() {
  showingOpenTasks = false;
}

const moduleCatalog = {
  web: { title: 'Web Development', code: 'IT 204', color: 'coral', instructor: 'Prof. Maria Santos', progress: 72, modules: ['Web foundations and the browser', 'Semantic HTML structure', 'CSS layout systems', 'Responsive interface patterns', 'JavaScript interactions', 'Accessible components', 'Portfolio project', 'Final deployment checklist'] },
  database: { title: 'Database Management', code: 'IT 206', color: 'navy', instructor: 'Prof. Carlo Reyes', progress: 48, modules: ['Database concepts and models', 'Entity relationship diagrams', 'Relational table design', 'SQL queries and filtering', 'Joins and aggregate functions', 'Normalization exercises', 'Transactions and security', 'Database project'] },
  networking: { title: 'Computer Networking', code: 'IT 208', color: 'lime', instructor: 'Prof. Anna Lim', progress: 84, modules: ['Network foundations', 'OSI and TCP/IP models', 'IP addressing basics', 'Subnetting practice', 'Switching and VLANs', 'Routing fundamentals', 'Network security basics', 'Troubleshooting lab', 'Practical assessment'] },
  hci: { title: 'Human-Computer Interaction', code: 'IT 210', color: 'yellow', instructor: 'Prof. Leo Garcia', progress: 63, modules: ['Introduction to user experience', 'User research methods', 'Personas and journey maps', 'Information architecture', 'Interface prototyping', 'Usability testing', 'Accessibility principles'] }
};

const yearModuleCatalog = {
  '1st Year': {
    web: ['Digital technology foundations', 'HTML and page structure', 'CSS styling basics', 'Intro to responsive design', 'JavaScript fundamentals'],
    database: ['Information and data concepts', 'Tables and records', 'Basic data types', 'Intro to SQL', 'Simple database activity'],
    networking: ['Computer hardware essentials', 'Network devices', 'Internet and web basics', 'IP address introduction', 'Basic connectivity lab'],
    hci: ['People and technology', 'User needs and empathy', 'Design thinking basics', 'Wireframe introduction', 'Simple usability check']
  },
  '2nd Year': {
    web: ['Web foundations and the browser', 'Semantic HTML structure', 'CSS layout systems', 'Responsive interface patterns', 'JavaScript interactions', 'Accessible components', 'Portfolio project', 'Final deployment checklist'],
    database: ['Database concepts and models', 'Entity relationship diagrams', 'Relational table design', 'SQL queries and filtering', 'Joins and aggregate functions', 'Normalization exercises', 'Transactions and security', 'Database project'],
    networking: ['Network foundations', 'OSI and TCP/IP models', 'IP addressing basics', 'Subnetting practice', 'Switching and VLANs', 'Routing fundamentals', 'Network security basics', 'Troubleshooting lab', 'Practical assessment'],
    hci: ['Introduction to user experience', 'User research methods', 'Personas and journey maps', 'Information architecture', 'Interface prototyping', 'Usability testing', 'Accessibility principles']
  },
  '3rd Year': {
    web: ['Full-stack application architecture', 'API design and integration', 'Authentication and sessions', 'Frontend state management', 'Testing web applications', 'Performance optimization', 'Cloud deployment', 'Industry web project'],
    database: ['Advanced SQL patterns', 'Stored procedures and views', 'Database administration', 'Indexing and optimization', 'Distributed databases', 'Data warehousing', 'Backup and recovery', 'Enterprise data project'],
    networking: ['Advanced routing protocols', 'Wireless network design', 'Network monitoring', 'Server and service management', 'Virtual networks', 'Cybersecurity operations', 'Network automation', 'Infrastructure deployment'],
    hci: ['Interaction design systems', 'Product discovery', 'Inclusive design research', 'Advanced prototyping', 'Design evaluation methods', 'Service blueprinting', 'HCI case study']
  },
  '4th Year': {
    web: ['Software project planning', 'Scalable web architecture', 'DevOps delivery workflow', 'Secure application review', 'Industry code quality', 'Client requirements workshop', 'Capstone implementation', 'Capstone presentation'],
    database: ['Enterprise data architecture', 'Data governance', 'Analytics pipeline design', 'High availability systems', 'Privacy and compliance', 'Business intelligence project', 'Capstone database build', 'Technical documentation'],
    networking: ['Enterprise infrastructure planning', 'Cloud and hybrid networks', 'Security architecture', 'Disaster recovery planning', 'Network audit and compliance', 'Professional troubleshooting', 'Industry practicum', 'Capstone infrastructure defense'],
    hci: ['Human-centered product strategy', 'Ethics in technology design', 'Research portfolio', 'Advanced usability study', 'Design leadership', 'Industry case presentation', 'Capstone experience design']
  }
};

function openCourseModules(courseKey) {
  const baseCourse = moduleCatalog[courseKey];
  const selectedYear = yearSelector.value;
  const course = { ...baseCourse, modules: yearModuleCatalog[selectedYear][courseKey] || baseCourse.modules };
  if (!course) return;
  activeCourse = course;
  activeCourseYear = selectedYear;
  const completed = Math.round(course.modules.length * course.progress / 100);
  pageTitle.textContent = course.title;
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => item.classList.toggle('active', item.dataset.view === 'courses'));
  pageContainer.innerHTML = `<section class="module-header"><button class="back-link" data-view="courses">← Back to My courses</button><div class="module-title-row"><div class="course-color ${course.color}"><span>${course.code.slice(-2)}</span></div><div><p class="eyebrow">2ND YEAR · ${course.code}</p><h1>${course.title}</h1><p>${course.instructor} · ${course.modules.length} learning modules</p></div></div><div class="module-progress"><div><strong>${course.progress}% complete</strong><span>${completed} of ${course.modules.length} modules finished</span></div><div class="progress-line"><i style="width:${course.progress}%"></i></div></div></section><section class="module-layout"><div class="module-list"><div class="section-heading"><div><p class="eyebrow">COURSE CONTENT</p><h2>Learning modules</h2></div><span class="course-code">${course.modules.length} modules</span></div>${course.modules.map((module, index) => { const done = index < completed; return `<article class="module-row ${done ? 'module-done' : ''}"><span class="module-number">${String(index + 1).padStart(2, '0')}</span><div class="module-copy"><strong>${module}</strong><small>${done ? 'Completed' : index === completed ? 'Next up · 20 min' : 'Lesson · 20 min'}</small></div><span class="module-state">${done ? '✓' : index === completed ? 'Start' : 'Locked'}</span><button class="module-open" data-action="lesson" data-module="${module}">${done ? 'Review' : index === completed ? 'Open' : 'View'} →</button></article>`; }).join('')}</div><aside class="module-side"><section class="panel"><p class="eyebrow">AT A GLANCE</p><h2>Build your skill set.</h2><p class="module-note">Complete each module to unlock the next practical activity.</p><div class="module-stat"><strong>${course.progress}%</strong><span>overall progress</span></div><div class="module-stat"><strong>${course.modules.length * 20} min</strong><span>estimated course time</span></div></section><section class="quote-card"><p>Small modules. Real practice. Visible progress.</p><small>CIT Learning Arc</small></section></aside></section>`;
  pageContainer.querySelectorAll('[data-action="lesson"]').forEach((button) => {
    button.dataset.action = 'module-pdf';
    button.textContent = 'Preview →';
  });
  const moduleEyebrow = pageContainer.querySelector('.module-header .eyebrow');
  if (moduleEyebrow) moduleEyebrow.textContent = `${selectedYear.toUpperCase()} · ${course.code}`;
  sidebar.classList.remove('open');
}

menuButton.addEventListener('click', () => sidebar.classList.toggle('open'));

const signupPanel = document.getElementById('signupPanel');
const signupForm = document.getElementById('signupForm');
const signupRole = document.getElementById('signupRole');

function updateSignupRolePresentation() {
  document.querySelector('#signupPanel > .eyebrow').textContent = `${signupRole.value.toUpperCase()} REGISTRATION`;
  document.getElementById('signupApprovalMessage').textContent = signupRole.value === 'Instructor'
    ? 'Instructor accounts need approval from the Dean.'
    : 'Student accounts need approval from the Dean or Program Chair.';
}

signupRole.addEventListener('change', updateSignupRolePresentation);

const signupAvatarPreview = document.getElementById('signupAvatarPreview');
const signupAvatarClear = document.getElementById('signupAvatarClear');

document.getElementById('signupProfilePicture').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) {
    signupAvatarPreview.style.backgroundImage = '';
    signupAvatarPreview.textContent = '＋';
    signupAvatarClear.hidden = true;
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    signupAvatarPreview.style.backgroundImage = `url('${reader.result}')`;
    signupAvatarPreview.textContent = '';
    signupAvatarClear.hidden = false;
  };
  reader.readAsDataURL(file);
});

signupAvatarClear.addEventListener('click', () => {
  document.getElementById('signupProfilePicture').value = '';
  signupAvatarPreview.style.backgroundImage = '';
  signupAvatarPreview.textContent = '＋';
  signupAvatarClear.hidden = true;
});

document.getElementById('showSignup').addEventListener('click', async () => {
  loginForm.hidden = true;
  passwordRecoveryPanel.hidden = true;
  signupPanel.hidden = false;
  const programSelect = document.getElementById('signupProgram');
  const submitButton = signupForm.querySelector('button[type="submit"]');
  try {
    const response = await fetch(`${apiBaseUrl}/api/signup/programs`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Could not load programs.');
    programSelect.innerHTML = result.programs.length
      ? `<option value="">Choose your program</option>${result.programs.map((program) => `<option value="${program.id}">${escapeHtml(program.departmentCode)} · ${escapeHtml(program.name)}</option>`).join('')}`
      : '<option value="">No programs are available yet</option>';
    submitButton.disabled = !result.programs.length;
    document.getElementById('signupStatus').textContent = result.programs.length ? '' : 'The Dean must create a program before student registration is available.';
  } catch (error) {
    programSelect.innerHTML = '<option value="">Could not load programs</option>';
    submitButton.disabled = true;
    document.getElementById('signupStatus').textContent = error.message || 'Could not load programs.';
  }
  document.getElementById('signupFirstName').focus();
});

document.getElementById('backFromSignup').addEventListener('click', () => {
  signupPanel.hidden = true;
  signupForm.reset();
  signupRole.value = 'Student';
  updateSignupRolePresentation();
  signupAvatarPreview.style.backgroundImage = '';
  signupAvatarPreview.textContent = '＋';
  signupAvatarClear.hidden = true;
  document.getElementById('signupStatus').textContent = '';
  loginForm.hidden = false;
  document.getElementById('loginAccountId').focus();
});

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = signupForm.querySelector('button[type="submit"]');
  const status = document.getElementById('signupStatus');
  const pictureInput = document.getElementById('signupProfilePicture');
  const values = Object.fromEntries(new FormData(signupForm).entries());
  submitButton.disabled = true;
  status.textContent = 'Sending account request...';
  try {
    const payload = new FormData();
    payload.append('role', values.role || signupRole.value);
    payload.append('firstName', values.firstName || '');
    payload.append('lastName', values.lastName || '');
    payload.append('userId', values.userId || '');
    payload.append('programId', values.programId || '');
    payload.append('password', values.password || '');
    if (pictureInput.files[0]) payload.append('profilePicture', pictureInput.files[0]);
    const response = await fetch(`${apiBaseUrl}/api/signup`, { method: 'POST', body: payload });
    const result = await response.json();
    status.textContent = result.message || 'Account request sent for approval.';
    if (response.ok) {
      signupForm.reset();
      signupRole.value = 'Student';
      updateSignupRolePresentation();
      signupAvatarPreview.style.backgroundImage = '';
      signupAvatarPreview.textContent = '＋';
      signupAvatarClear.hidden = true;
    }
  } catch {
    status.textContent = 'Could not connect to the server. Please try again later.';
  } finally {
    submitButton.disabled = false;
  }
});

const passwordRecoveryPanel = document.getElementById('passwordRecoveryPanel');
const passwordResetRequestForm = document.getElementById('passwordResetRequestForm');
const completePasswordResetForm = document.getElementById('completePasswordResetForm');

document.getElementById('showForgotPassword').addEventListener('click', () => {
  loginForm.hidden = true;
  passwordRecoveryPanel.hidden = false;
  document.getElementById('resetRequestAccountId').value = document.getElementById('loginAccountId').value.trim();
  document.getElementById('resetRequestAccountId').focus();
});

document.getElementById('showResetCodeForm').addEventListener('click', () => {
  passwordResetRequestForm.hidden = true;
  completePasswordResetForm.hidden = false;
  document.getElementById('showResetCodeForm').hidden = true;
  document.getElementById('resetCodeAccountId').value = document.getElementById('resetRequestAccountId').value.trim();
  document.getElementById('resetCodeAccountId').focus();
});

document.getElementById('backToLogin').addEventListener('click', () => {
  passwordRecoveryPanel.hidden = true;
  loginForm.hidden = false;
  passwordResetRequestForm.hidden = false;
  completePasswordResetForm.hidden = true;
  document.getElementById('showResetCodeForm').hidden = false;
  document.getElementById('resetRequestStatus').textContent = '';
  document.getElementById('completeResetStatus').textContent = '';
});

passwordResetRequestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = passwordResetRequestForm.querySelector('button[type="submit"]');
  const status = document.getElementById('resetRequestStatus');
  submitButton.disabled = true;
  status.textContent = 'Sending request...';
  try {
    const response = await fetch(`${apiBaseUrl}/api/password-reset-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: passwordResetRequestForm.elements.userId.value.trim() })
    });
    const result = await response.json();
    status.textContent = result.message || 'If the account matches, the request has been sent for verification.';
    passwordResetRequestForm.reset();
  } catch {
    status.textContent = 'Could not connect to the server. Please try again later.';
  } finally {
    submitButton.disabled = false;
  }
});

completePasswordResetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = completePasswordResetForm.querySelector('button[type="submit"]');
  const status = document.getElementById('completeResetStatus');
  submitButton.disabled = true;
  status.textContent = 'Updating password...';
  try {
    const response = await fetch(`${apiBaseUrl}/api/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(completePasswordResetForm).entries()))
    });
    const result = await response.json();
    status.textContent = result.message || 'Could not reset the password.';
    if (response.ok) {
      completePasswordResetForm.reset();
      document.getElementById('loginAccountId').value = document.getElementById('resetCodeAccountId').value;
      window.setTimeout(() => document.getElementById('backToLogin').click(), 1800);
    }
  } catch {
    status.textContent = 'Could not connect to the server. Please try again later.';
  } finally {
    submitButton.disabled = false;
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const accountId = document.getElementById('loginAccountId').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch(`${apiBaseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: accountId, password })
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      showToast(data.message || 'Invalid account ID or password.');
      return;
    }

    const role = String(data.role || '').trim();
    if (!role) {
      showToast('The account does not have a valid role.');
      return;
    }
    if (!data.token) {
      showToast('The server did not create a login session.');
      return;
    }

    authToken = data.token;
    appShell.dataset.role = role.toLowerCase();
    appShell.dataset.userName = data.name || accountId;
    appShell.dataset.userId = accountId;
    appShell.dataset.profilePicture = data.profilePicture || '';
    configureRoleWorkspace(appShell.dataset.role);
    setView('overview');
    authScreen.hidden = true;
    appShell.hidden = false;
    showToast(`Signed in as ${role}`);
  } catch (error) {
    console.error('Login request failed:', error);
    showToast('Could not connect to the server. Make sure the backend is running.');
  }
});

document.getElementById('logoutButton').addEventListener('click', () => {
  if (authToken) fetch(`${apiBaseUrl}/api/logout`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } });
  window.clearInterval(chatPollTimer);
  window.clearInterval(modulePollTimer);
  authToken = '';
  classroomCache = [];
  appShell.hidden = true;
  authScreen.hidden = false;
  loginForm.reset();
  delete appShell.dataset.role;
  delete appShell.dataset.userName;
  delete appShell.dataset.userId;
  delete appShell.dataset.profilePicture;
});

document.querySelector('.sidebar-bottom .nav-item').addEventListener('click', () => setView('settings'));

function downloadModulePdf(moduleTitle) {
  if (!activeCourse) return;
  const lines = [
    'CIT LEARNING HUB',
    `${activeCourse.title} · ${activeCourse.code}`,
    `${activeCourseYear} · Computer Industrial Technology`,
    '',
    `LEARNING MODULE: ${moduleTitle}`,
    '',
    'MODULE OVERVIEW',
    `This module is part of the ${activeCourse.title} learning path. Study the lesson, complete the practical activity, and record your output in your learning notes.`,
    '',
    'LEARNING OBJECTIVES',
    `Understand the key concepts covered in ${moduleTitle}.`,
    'Apply the lesson through a practical technology activity.',
    'Explain the result using clear technical documentation.',
    '',
    'PRACTICAL OUTPUT',
    'Submit your activity, screenshots, notes, or working prototype to complete this module.',
    '',
    'CIT Learning Arc · Computer Industrial Technology'
  ];
  const escapePdfText = (text) => text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
  const stream = ['BT', '/F1 16 Tf', '50 750 Td', `(${escapePdfText(lines[0])}) Tj`, '/F1 12 Tf', '0 -25 Td', `(${escapePdfText(lines[1])}) Tj`, '/F1 10 Tf', '0 -20 Td', ...lines.slice(2).map((line) => `(${escapePdfText(line)}) Tj 0 -16 Td`), 'ET'].join('\n');
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  link.download = `${activeCourse.code}-${activeCourseYear}-${moduleTitle.replaceAll(' ', '-')}.pdf`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Learning module PDF downloaded');
}

function showModulePreview(moduleTitle) {
  if (!activeCourse) return;
  document.querySelector('.module-preview-overlay')?.remove();
  const preview = document.createElement('div');
  preview.className = 'module-preview-overlay';
  preview.innerHTML = `<section class="module-preview" role="dialog" aria-modal="true" aria-labelledby="previewTitle"><button class="preview-close" aria-label="Close module preview">×</button><p class="eyebrow">${activeCourseYear.toUpperCase()} · ${activeCourse.code} · ${activeCourse.title.toUpperCase()}</p><h2 id="previewTitle">${moduleTitle}</h2><p class="preview-lead">A practical learning module in the ${activeCourse.title} path.</p><div class="preview-block"><strong>Module overview</strong><p>Study the core ideas, follow the guided examples, and apply the lesson through a focused technology activity.</p></div><div class="preview-block"><strong>Learning objectives</strong><ul><li>Understand the key concepts covered in this lesson.</li><li>Apply the lesson through a practical activity.</li><li>Explain the result using clear technical documentation.</li></ul></div><div class="preview-block"><strong>Practical output</strong><p>Submit your activity, screenshots, notes, or working prototype to complete this module.</p></div><div class="preview-actions"><button class="filter-button preview-close-action">Close preview</button><button class="primary-button preview-download">↓ Download PDF</button></div></section>`;
  const lessons = [
    { number: 'Lesson 01', title: `Understand ${moduleTitle}`, detail: 'Key concepts, terminology, and a short guided reading.', duration: '15 min' },
    { number: 'Lesson 02', title: `Practice ${moduleTitle}`, detail: 'Follow a worked example and apply the technique step by step.', duration: '25 min' },
    { number: 'Lesson 03', title: `Apply ${moduleTitle}`, detail: 'Complete a hands-on checkpoint and document your result.', duration: '30 min' }
  ];
  preview.querySelector('.preview-lead').insertAdjacentHTML('afterend', `<div class="preview-lessons"><div class="preview-lessons-heading"><strong>Module lessons</strong><span>3 lessons · 70 min</span></div>${lessons.map((lesson) => `<article class="preview-lesson"><span>${lesson.number}</span><div><strong>${lesson.title}</strong><p>${lesson.detail}</p></div><small>${lesson.duration}</small></article>`).join('')}</div>`);
  document.body.appendChild(preview);
  preview.querySelectorAll('.preview-close, .preview-close-action').forEach((button) => button.addEventListener('click', () => preview.remove()));
  preview.querySelector('.preview-download').addEventListener('click', () => downloadModulePdf(moduleTitle));
  preview.addEventListener('click', (event) => { if (event.target === preview) preview.remove(); });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  const item = event.target.closest('.course-card, .task-row, .large-course-card, .announcement');
  if (item && !button) {
    if (item.classList.contains('large-course-card')) {
      const title = item.querySelector('h2')?.textContent || '';
      const key = Object.keys(moduleCatalog).find((catalogKey) => moduleCatalog[catalogKey].title === title);
      if (key) openCourseModules(key);
      return;
    }
    if (item.dataset.course) {
      openCourseModules(item.dataset.course);
      return;
    }
    showToast('Item selected - detail view coming next');
    return;
  }
  if (!button) return;
  if (button.dataset.view === 'grades') {
    setView('courses');
    return;
  }
  if (button.dataset.view) {
    setView(button.dataset.view);
    return;
  }
  if (button.dataset.action === 'browse') {
    setView(appShell.dataset.role === 'student' ? 'catalog' : 'courses');
    return;
  }
  if (button.dataset.action === 'show-classroom-form') {
    const form = document.getElementById('createClassroomForm');
    if (form) {
      form.hidden = false;
      form.querySelector('input')?.focus();
    } else {
      showClassroomFormOnLoad = true;
      setView('courses');
    }
    return;
  }
  if (button.dataset.action === 'request-join') {
    button.disabled = true;
    apiRequest(`/api/classrooms/${button.dataset.classId}/join`, { method: 'POST' })
      .then(() => { showToast('Join request sent to the instructor.'); loadRoleView(activeView); })
      .catch((error) => { showToast(error.message); button.disabled = false; });
    return;
  }
  if (button.dataset.action === 'accept-request') {
    button.disabled = true;
    apiRequest(`/api/classroom-requests/${button.dataset.requestId}/accept`, { method: 'POST' })
      .then(() => { showToast('Student accepted into your classroom.'); loadRoleView(activeView); })
      .catch((error) => { showToast(error.message); button.disabled = false; });
    return;
  }
  if (button.dataset.action === 'leave-class') {
    if (!window.confirm('Leave this classroom? You will lose access to its modules, activities, announcements, and chat.')) return;
    const returnView = activeView;
    button.disabled = true;
    apiRequest(`/api/classrooms/${button.dataset.classId}/membership`, { method: 'DELETE' })
      .then(() => { showToast('You left the classroom.'); setView(returnView === 'class-detail' ? 'courses' : returnView); })
      .catch((error) => { showToast(error.message || 'Could not leave the classroom.'); button.disabled = false; });
    return;
  }
  if (button.dataset.action === 'remove-student') {
    if (!window.confirm(`Remove ${button.dataset.studentId} from this classroom?`)) return;
    button.disabled = true;
    apiRequest(`/api/classrooms/${button.dataset.classId}/students/${encodeURIComponent(button.dataset.studentId)}`, { method: 'DELETE' })
      .then(() => { showToast('Student removed from the classroom.'); loadClassroomRoster(button.dataset.classId); })
      .catch((error) => { showToast(error.message || 'Could not remove the student.'); button.disabled = false; });
    return;
  }
  if (button.dataset.action === 'edit-program-course') {
    const form = button.closest('.classroom-hierarchy-course-row')?.querySelector('.program-course-edit-form');
    if (form) {
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector('input')?.focus();
    }
    return;
  }
  if (button.dataset.action === 'cancel-course-edit' || button.dataset.action === 'cancel-subject-edit') {
    button.closest('form').hidden = true;
    return;
  }
  if (button.dataset.action === 'edit-subject') {
    const form = button.closest('.hierarchy-subject-row')?.querySelector('.subject-edit-form');
    if (form) {
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector('input')?.focus();
    }
    return;
  }
  if (button.dataset.action === 'remove-program-course') {
    const courseLabel = button.dataset.courseLabel || 'this course';
    if (!window.confirm(`Permanently delete ${courseLabel} and all Major/Minor subjects in it? Classroom enrollments, activities and submissions, announcements, chat messages, and uploaded modules will also be deleted.`)) return;
    button.disabled = true;
    apiRequest(`/api/programs/${button.dataset.programId}/courses/${button.dataset.courseId}`, { method: 'DELETE' })
      .then((result) => {
        setView('courses');
        showToast(result.cleanupWarning ? 'Course deleted, but some module files could not be cleaned up. Check the server logs.' : 'Course and its subjects deleted.');
      })
      .catch((error) => { showToast(error.message || 'Could not delete the course.'); button.disabled = false; });
    return;
  }
  if (button.dataset.action === 'remove-program') {
    const programLabel = button.dataset.programLabel || 'this program';
    if (!window.confirm(`Permanently delete ${programLabel}? All program courses, Major/Minor subjects, classroom records, student submissions, announcements, messages, module files, and pending signup requests for this program will also be deleted.`)) return;
    button.disabled = true;
    apiRequest(`/api/programs/${button.dataset.programId}`, { method: 'DELETE' })
      .then((result) => {
        setView('programs');
        showToast(result.cleanupWarning ? 'Program deleted, but some module files could not be cleaned up. Check the server logs.' : 'Program and its associated records deleted.');
      })
      .catch((error) => { showToast(error.message || 'Could not delete the program.'); button.disabled = false; });
    return;
  }
  if (button.dataset.action === 'remove-department-course') {
    const courseLabel = button.dataset.courseLabel || 'this CIT course';
    if (!window.confirm(`Remove ${courseLabel} from the CIT department course catalog? If a classroom still uses it, the catalog entry will be hidden while the existing classroom and its data are preserved.`)) return;
    button.disabled = true;
    apiRequest(`/api/department-courses/${button.dataset.courseId}`, { method: 'DELETE' })
      .then((result) => {
        renderProgramsView();
        showToast(result.classroomPreserved ? 'Course removed from the catalog; its existing classroom and data were preserved.' : 'Course removed from the CIT catalog.');
      })
      .catch((error) => { showToast(error.message || 'Could not remove the department course.'); button.disabled = false; });
    return;
  }
  if (button.dataset.action === 'remove-program-subject') {
    const subjectLabel = button.dataset.subjectLabel || 'this subject';
    if (!window.confirm(`Permanently remove ${subjectLabel} from this program? This also deletes its classroom, enrolled-student records, activities and submissions, announcements, chat messages, and module files. This cannot be undone.`)) return;
    button.disabled = true;
    apiRequest(`/api/programs/${button.dataset.programId}/classrooms/${button.dataset.classId}`, { method: 'DELETE' })
      .then((result) => {
        setView('courses');
        showToast(result.cleanupWarning ? 'Subject removed, but some module files could not be cleaned up. Check the server logs.' : 'Subject and its classroom records removed.');
      })
      .catch((error) => { showToast(error.message || 'Could not remove the subject.'); button.disabled = false; });
    return;
  }
  if (button.dataset.action === 'view-requests') {
    setView('requests');
    return;
  }
  if (button.dataset.action === 'open-class') {
    openClassroom(button.dataset.classId);
    return;
  }
  if (button.dataset.action === 'download-module') {
    downloadClassroomModule(button);
    return;
  }
  if (button.dataset.action === 'review-submissions') {
    const reviewClassId = button.dataset.classId || activeChatClassId;
    const resultAreaId = button.dataset.classId ? 'instructorActivitySubmissions' : `activitySubmissions-${button.dataset.activityId}`;
    loadActivitySubmissions(reviewClassId, button.dataset.activityId, resultAreaId);
    return;
  }
  if (button.dataset.action === 'refresh-activities') {
    loadRoleView('assignments');
    return;
  }
  if (button.dataset.action === 'refresh-requests') {
    loadRoleView('requests');
    return;
  }
  if (button.dataset.action === 'refresh-announcements') {
    loadRoleView('announcements');
    return;
  }
  if (button.dataset.action === 'refresh-password-resets') {
    loadRoleView('password-resets');
    return;
  }
  if (button.dataset.action === 'refresh-signups') {
    loadRoleView('signup-requests');
    return;
  }
  if (button.dataset.action === 'approve-signup') {
    button.disabled = true;
    apiRequest(`/api/signup-requests/${button.dataset.requestId}/approve`, { method: 'POST' })
      .then((result) => {
        button.closest('.signup-request-row')?.remove();
        showToast(`Student account ${result.userId} approved and created.`);
      })
      .catch((error) => { showToast(error.message || 'Could not approve signup.'); button.disabled = false; });
    return;
  }
  if (button.dataset.action === 'reject-signup') {
    button.disabled = true;
    apiRequest(`/api/signup-requests/${button.dataset.requestId}/reject`, { method: 'POST' })
      .then(() => { button.closest('.signup-request-row')?.remove(); showToast('Signup request rejected.'); })
      .catch((error) => { showToast(error.message || 'Could not reject signup.'); button.disabled = false; });
    return;
  }
  if (button.dataset.action === 'issue-password-reset') {
    button.disabled = true;
    apiRequest(`/api/password-reset-requests/${button.dataset.requestId}/issue`, { method: 'POST' })
      .then((result) => {
        const panel = document.getElementById('issuedResetCodePanel');
        const requestRow = button.closest('.reset-request-row');
        if (requestRow) requestRow.remove();
        if (panel) {
          panel.hidden = false;
          panel.innerHTML = `<strong>One-time reset code for ${escapeHtml(result.userId)}</strong><code>${escapeHtml(result.resetCode)}</code><p>Valid for ${result.expiresInMinutes} minutes. Verify the user first, then share this code privately. It will not be shown again.</p><button class="filter-button" data-action="copy-reset-code" data-code="${escapeHtml(result.resetCode)}">Copy code</button>`;
        }
      })
      .catch((error) => { showToast(error.message || 'Could not issue reset code.'); button.disabled = false; });
    return;
  }
  if (button.dataset.action === 'reject-password-reset') {
    button.disabled = true;
    apiRequest(`/api/password-reset-requests/${button.dataset.requestId}/reject`, { method: 'POST' })
      .then(() => { button.closest('.reset-request-row')?.remove(); showToast('Reset request rejected.'); })
      .catch((error) => { showToast(error.message || 'Could not reject request.'); button.disabled = false; });
    return;
  }
  if (button.dataset.action === 'copy-reset-code') {
    navigator.clipboard.writeText(button.dataset.code)
      .then(() => showToast('Reset code copied. Share it privately after verifying the user.'))
      .catch(() => showToast('Could not copy the reset code.'));
    return;
  }

  if (button.dataset.action === 'invite-user') {
    showToast('New user invitation form is ready');
    return;
  }
  if (button.dataset.action === 'export-report') {
    exportAcademicReport(button);
    return;
  }
  if (button.dataset.action === 'review-work') {
    showToast('Submission review opened');
    return;
  }
  if (button.dataset.action === 'save') {
    showToast('Settings saved for this session');
    return;
  }
  if (button.dataset.action === 'schedule') {
    showToast('Event form is ready for your next class schedule');
    return;
  }
  if (button.dataset.action === 'message') {
    showToast('New message form is ready');
    return;
  }
  if (button.dataset.action === 'course') {
    const card = button.closest('.large-course-card');
    const title = card?.querySelector('h2')?.textContent || '';
    const key = button.dataset.course || Object.keys(moduleCatalog).find((catalogKey) => moduleCatalog[catalogKey].title === title);
    if (key) openCourseModules(key);
    else showToast('Course module opened');
    return;
  }
  if (button.dataset.action === 'lesson') {
    showToast(`${button.dataset.module} opened`);
    return;
  }
  if (button.dataset.action === 'module-pdf') {
    showModulePreview(button.dataset.module);
    return;
  }
  if (button.dataset.action === 'explore' || button.dataset.action === 'discover') {
    setView('courses');
    return;
  }
  if (button.dataset.action === 'practice') {
    showToast('Practice lab opened');
    return;
  }
  if (button.dataset.action === 'track') {
    showToast('Learning path opened');
    return;
  }
  if (button.id === 'quickAction') {
    showToast('Quick action menu opened: add task or announcement');
    return;
  }
  if (button.id === 'filterButton') {
    showingOpenTasks = !showingOpenTasks;
    button.innerHTML = showingOpenTasks ? 'Open tasks <span>⌄</span>' : 'All tasks <span>⌄</span>';
    document.querySelectorAll('.task-row').forEach((task, index) => {
      task.style.display = showingOpenTasks && index === 2 ? 'none' : 'flex';
    });
    showToast(showingOpenTasks ? 'Showing tasks due this week' : 'Showing all tasks');
    return;
  }
  if (button.closest('.help-card')) {
    showToast('CIT Help Desk: helpdesk@cit.edu.ph');
    return;
  }
  if (button.classList.contains('arrow-button')) {
    showToast('Course module opened');
    return;
  }
  if (button.classList.contains('more-button')) {
    showToast('Task options opened');
    return;
  }
  if (button.classList.contains('dots-button')) {
    showToast('More options opened');
    return;
  }
  if (button.classList.contains('filter-button')) {
    showToast('Filter options opened');
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (form.matches('.program-course-edit-form')) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    await submitJsonForm(form, `/api/programs/${form.dataset.programId}/courses/${form.dataset.courseId}`, values, 'Program course updated.', () => setView('courses'), false, 'PUT');
    return;
  }
  if (form.matches('.subject-edit-form')) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    await submitJsonForm(form, `/api/programs/${form.dataset.programId}/classrooms/${form.dataset.classId}`, values, 'Subject updated.', () => setView('courses'), false, 'PUT');
    return;
  }
  if (form.matches('.program-chair-assignment-form')) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    await submitJsonForm(form, `/api/programs/${form.dataset.programId}/chair`, values, 'Program Chair assignment saved.', () => setView('programs'), false, 'PUT');
    return;
  }
  if (form.id === 'programForm') {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    await submitJsonForm(form, '/api/programs', values, 'Program created and chair assigned.', () => setView('programs'));
    return;
  }
  if (form.id === 'programCourseForm') {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const { programId, ...course } = values;
    await submitJsonForm(form, `/api/programs/${programId}/courses`, course, 'Course added inside the program.', () => setView('courses'));
    return;
  }
  if (form.id === 'departmentCourseForm') {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    await submitJsonForm(form, '/api/department-courses', values, 'Course added to the department catalog.', () => renderProgramsView());
    return;
  }
  if (form.id === 'programSubjectForm') {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    if (!values.programCourseId) {
      showToast('Type a course and choose it from the suggestions.');
      return;
    }
    const { programId, ...subject } = values;
    delete subject.programCourseSearch;
    await submitJsonForm(form, `/api/programs/${programId}/classrooms`, subject, 'Subject added and instructor assigned.', () => setView('courses'));
    return;
  }
  if (form.matches('.categorize-subject-form')) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    await submitJsonForm(form, `/api/programs/${form.dataset.programId}/classrooms/${form.dataset.classId}/course`, values, 'Existing subject moved into the selected course.', () => setView('courses'), false, 'PUT');
    return;
  }
  if (form.matches('.subject-year-form')) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    await submitJsonForm(form, `/api/programs/${form.dataset.programId}/classrooms/${form.dataset.classId}/year-level`, values, 'Subject year level updated.', () => setView('courses'), false, 'PUT');
    return;
  }
  if (form.id === 'addStudentForm') {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    await submitJsonForm(form, `/api/classrooms/${activeChatClassId}/students`, values, 'Student enrolled in this subject.', () => loadClassroomRoster(activeChatClassId));
    return;
  }
  if (form.id === 'activityForm') {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    values.dueAt = values.dueAt || null;
    await submitJsonForm(form, `/api/classrooms/${activeChatClassId}/activities`, values, 'Activity posted for enrolled students.', () => loadClassroomActivities(activeChatClassId));
    return;
  }
  if (form.matches('.activity-submission-form')) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    await submitJsonForm(form, `/api/classrooms/${activeChatClassId}/activities/${form.dataset.activityId}/submissions`, values, 'Answer submitted.', () => loadClassroomActivities(activeChatClassId));
    return;
  }
  if (form.id === 'announcementForm') {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    await submitJsonForm(form, `/api/classrooms/${activeChatClassId}/announcements`, values, 'Announcement posted to this subject.', () => loadClassroomAnnouncements(activeChatClassId));
    return;
  }
  if (form.matches('.grade-submission-form')) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const activityId = form.dataset.activityId;
    const gradeClassId = form.dataset.classId || activeChatClassId;
    const gradeAreaId = form.dataset.classId ? 'instructorActivitySubmissions' : `activitySubmissions-${activityId}`;
    await submitJsonForm(form, `/api/classrooms/${gradeClassId}/activities/${activityId}/submissions/${form.dataset.submissionId}/grade`, values, 'Grade saved.', async () => {
      if (!form.dataset.classId) await loadClassroomActivities(gradeClassId);
      await loadActivitySubmissions(gradeClassId, activityId, gradeAreaId);
    }, false);
    return;
  }
  if (event.target.id === 'moduleUploadForm') {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const classId = activeChatClassId;
    submitButton.disabled = true;
    submitButton.textContent = 'Uploading...';
    try {
      await apiRequest(`/api/classrooms/${classId}/modules`, {
        method: 'POST',
        body: new FormData(form)
      });
      form.reset();
      await loadClassroomModules(classId);
      showToast('Module uploaded for this classroom.');
    } catch (error) {
      showToast(error.message || 'Could not upload module.');
    } finally {
      if (submitButton.isConnected) {
        submitButton.disabled = false;
        submitButton.textContent = 'Upload module';
      }
    }
    return;
  }
  if (form.id === 'classChatForm') {
    event.preventDefault();
    const form = event.target;
    const input = form.elements.message;
    const submitButton = form.querySelector('button[type="submit"]');
    const message = input.value.trim();
    if (!message || !activeChatClassId) return;
    submitButton.disabled = true;
    try {
      await apiRequest(`/api/classrooms/${activeChatClassId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      input.value = '';
      await loadClassChat(activeChatClassId);
    } catch (error) {
      showToast(error.message || 'Could not send message.');
    } finally {
      submitButton.disabled = false;
      input.focus();
    }
    return;
  }
  if (form.id !== 'createClassroomForm') return;
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const formData = new FormData(form);
    await apiRequest('/api/classrooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.get('name'),
        courseCode: formData.get('courseCode'),
        description: formData.get('description')
      })
    });
    showToast('Classroom created. Students can now request to join.');
    setView('courses');
  } catch (error) {
    showToast(error.message);
    submitButton.disabled = false;
  }
});

async function submitJsonForm(form, endpoint, payload, successMessage, afterSuccess, reset = true, method = 'POST') {
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    await apiRequest(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (reset) form.reset();
    showToast(successMessage);
    await afterSuccess?.();
  } catch (error) {
    showToast(error.message || 'Could not save changes.');
  } finally {
    if (submitButton?.isConnected) submitButton.disabled = false;
  }
}

setView('learning-arc');

yearSelector.addEventListener('change', () => {
  updateYearLevel(yearSelector.value);
  if (appShell.dataset.role !== 'student') return;
  window.localStorage.setItem('lms-student-year', yearSelector.value);
  setView('overview');
  showToast(`Showing ${yearSelector.value} dashboard and subjects.`);
});
