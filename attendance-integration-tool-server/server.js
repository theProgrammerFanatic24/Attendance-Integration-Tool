//All Imports

import express from 'express';
import cors from 'cors';
import { connectionAttendance, connectionGrades } from './db.js';
import { Parser } from 'json2csv';

//Define Consts

//Server setup
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});

app.get('/', (req, res) => {
  res.send('Backend is running!');
});

app.get('/api/rawdata', async (req, res) => {
  try {
    // Drop tables in reverse dependency order
    await connectionAttendance.query('DROP TABLE IF EXISTS anthalogyrequestedformat');
    await connectionAttendance.query('DROP TABLE IF EXISTS attendance_records');
    await connectionAttendance.query('DROP TABLE IF EXISTS enrollments');
    await connectionAttendance.query('DROP TABLE IF EXISTS attendance_sessions');
    await connectionAttendance.query('DROP TABLE IF EXISTS attendance_registers');
    await connectionAttendance.query('DROP TABLE IF EXISTS courses');
    await connectionAttendance.query('DROP TABLE IF EXISTS students');

    // Create and insert logic follows
    // Create and insert logic follows
    const createStudentsTable = `
  CREATE TABLE IF NOT EXISTS students (
    org_defined_id VARCHAR(10) PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50)
  );
`;

    const insertStudents = `
  INSERT IGNORE INTO students (org_defined_id, first_name, last_name)
  SELECT DISTINCT \`Org Defined Id\`, \`First Name\`, \`Last Name\`
  FROM rawattendancedata;
`;

    const createCoursesTable = `
  CREATE TABLE IF NOT EXISTS courses (
    course_offering_id VARCHAR(20) PRIMARY KEY,
    course_offering_code VARCHAR(50),
    course_offering_name VARCHAR(100),
    semester_name VARCHAR(30)
  );
`;

    const insertCourses = `
  INSERT IGNORE INTO courses (semester_name, course_offering_id, course_offering_code, course_offering_name)
  SELECT DISTINCT \`Semester Name\`, \`Course Offering Id\`, \`Course Offering Code\`, \`Course Offering Name\`
  FROM rawattendancedata;
`;

    const createRegistersTable = `
  CREATE TABLE IF NOT EXISTS attendance_registers (
    attendance_register_id VARCHAR(20) PRIMARY KEY,
    course_offering_code VARCHAR(50)
  );
`;

    const insertRegisters = `
  INSERT IGNORE INTO attendance_registers (attendance_register_id, course_offering_code)
  SELECT DISTINCT \`Attendance Register Id\`, \`Course Offering Code\`
  FROM rawattendancedata;
`;

    const createSessionsTable = `
  CREATE TABLE IF NOT EXISTS attendance_sessions (
    attendance_session_id VARCHAR(20) PRIMARY KEY,
    attendance_register_id VARCHAR(20),
    attendance_session_name DATE
  );
`;

    const insertSessions = `
  INSERT IGNORE INTO attendance_sessions (
    attendance_session_id,
    attendance_register_id,
    attendance_session_name
  )
  SELECT DISTINCT
    r.\`Attendance Session Id\`,
    r.\`Attendance Register Id\`,
    CASE
      WHEN NULLIF(r.\`Attendance Session Name\`, '') IS NULL THEN NULL
      ELSE COALESCE(
        STR_TO_DATE(r.\`Attendance Session Name\`, '%Y-%m-%d'),
        STR_TO_DATE(r.\`Attendance Session Name\`, '%m/%d/%Y'),
        STR_TO_DATE(r.\`Attendance Session Name\`, '%m/%d/%y')
      )
    END AS session_date
  FROM rawattendancedata r
  JOIN mastercourses mc
  ON REPLACE(mc.\`Course Offering Code\`, ' ', '') =
     REPLACE(r.\`Course Offering Code\`, ' ', '')
  WHERE
    NULLIF(r.\`Attendance Session Name\`, '') IS NOT NULL
    AND COALESCE(
          STR_TO_DATE(r.\`Attendance Session Name\`, '%Y-%m-%d'),
          STR_TO_DATE(r.\`Attendance Session Name\`, '%m/%d/%Y'),
          STR_TO_DATE(r.\`Attendance Session Name\`, '%m/%d/%y')
        ) IS NOT NULL
    AND COALESCE(
          STR_TO_DATE(r.\`Attendance Session Name\`, '%Y-%m-%d'),
          STR_TO_DATE(r.\`Attendance Session Name\`, '%m/%d/%Y'),
          STR_TO_DATE(r.\`Attendance Session Name\`, '%m/%d/%y')
        ) BETWEEN
        COALESCE(STR_TO_DATE(mc.\`Semester Start Date\`, '%m/%d/%Y'), STR_TO_DATE(mc.\`Semester Start Date\`, '%m/%d/%y'))
        AND
        COALESCE(STR_TO_DATE(mc.\`Semester End Date\`, '%m/%d/%Y'), STR_TO_DATE(mc.\`Semester End Date\`, '%m/%d/%y'))
    AND COALESCE(
          STR_TO_DATE(r.\`Attendance Session Name\`, '%Y-%m-%d'),
          STR_TO_DATE(r.\`Attendance Session Name\`, '%m/%d/%Y'),
          STR_TO_DATE(r.\`Attendance Session Name\`, '%m/%d/%y')
        ) NOT IN (
          '2025-05-22','2025-05-26','2025-06-19',
          '2025-06-30','2025-07-01','2025-07-02','2025-07-03','2025-07-04','2025-07-05',
          '2025-08-26','2025-08-27','2025-08-28','2025-08-29'
        );
`;


    const createEnrollments = `
CREATE TABLE IF NOT EXISTS enrollments (
  org_defined_id VARCHAR(10),
  course_offering_code VARCHAR(50),
  course_offering_id VARCHAR(20),
  attendance_register_id VARCHAR(20),
  minutes_regular INT,
  minutes_clinical INT,
  PRIMARY KEY (org_defined_id, course_offering_id)
);
`;

    const insertEnrollments = `
INSERT IGNORE INTO enrollments (
  org_defined_id,
  course_offering_code,
  course_offering_id,
  attendance_register_id,
  minutes_regular,
  minutes_clinical
)
SELECT
  s.org_defined_id,
  c.course_offering_code,
  c.course_offering_id,
  ar.attendance_register_id,
  mc.\`Minutes Regular\`,
  CASE
    WHEN mc.\`Minutes Clinical\` IS NOT NULL AND mc.\`Minutes Clinical\` != 0
      THEN mc.\`Minutes Clinical\`
    ELSE NULL
  END
FROM students s
JOIN courses c ON EXISTS (
  SELECT 1 FROM rawattendancedata r
  WHERE r.\`Org Defined Id\` = s.org_defined_id
    AND r.\`Course Offering Code\` = c.course_offering_code
)
JOIN attendance_registers ar ON ar.course_offering_code = c.course_offering_code
JOIN mastercourses mc ON mc.\`Course Offering Code\` = c.course_offering_code;
`;

    const createAttendanceRecords = `
CREATE TABLE IF NOT EXISTS attendance_records (
  org_defined_id VARCHAR(10),
  attendance_session_id VARCHAR(20),
  symbol_id CHAR(1),
  PRIMARY KEY (org_defined_id, attendance_session_id),
  FOREIGN KEY (org_defined_id) REFERENCES students(org_defined_id),
  FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions(attendance_session_id),
  FOREIGN KEY (symbol_id) REFERENCES attendance_symbols(symbol_id)
);
`;

    const insertAttendanceRecords = `
INSERT IGNORE INTO attendance_records (org_defined_id, attendance_session_id, symbol_id)
SELECT \`Org Defined Id\`, \`Attendance Session Id\`, \`Symbol Value\`
FROM rawattendancedata
WHERE \`Symbol Value\` IN ('P','A','T');
`;

    const createAnthalogyRequestedTable = `
CREATE TABLE IF NOT EXISTS anthalogyrequestedformat (
  StudentIdentifier VARCHAR(10),
  CourseCallNumber VARCHAR(50),
  AttendanceDate DATE,
  MinutesAttended INT,
  MinutesAbsent INT,
  PRIMARY KEY (StudentIdentifier, CourseCallNumber, AttendanceDate)
);
`;

    const insertAnthalogyRequestedTable = `
INSERT IGNORE INTO anthalogyrequestedformat (
  StudentIdentifier, CourseCallNumber, AttendanceDate, MinutesAttended, MinutesAbsent
)
SELECT
  s.org_defined_id,
  c.course_offering_code,
  sess.attendance_session_name,
  CASE
    WHEN ar.symbol_id = 'P' THEN
      CASE
        WHEN FIND_IN_SET(DAYNAME(sess.attendance_session_name), mc.\`Clinical Days\`) > 0
             AND mc.\`Minutes Clinical\` IS NOT NULL AND mc.\`Minutes Clinical\` != 0
          THEN mc.\`Minutes Clinical\`
        ELSE mc.\`Minutes Regular\`
      END
    WHEN ar.symbol_id = 'T' THEN
      CASE
        WHEN FIND_IN_SET(DAYNAME(sess.attendance_session_name), mc.\`Clinical Days\`) > 0
             AND mc.\`Minutes Clinical\` IS NOT NULL AND mc.\`Minutes Clinical\` != 0
          THEN FLOOR(0.66 * mc.\`Minutes Clinical\`)
        ELSE FLOOR(0.66 * mc.\`Minutes Regular\`)
      END
    ELSE 0
  END AS MinutesAttended,
  CASE
    WHEN ar.symbol_id = 'P' THEN 0
    WHEN ar.symbol_id = 'T' THEN
      CASE
        WHEN FIND_IN_SET(DAYNAME(sess.attendance_session_name), mc.\`Clinical Days\`) > 0
             AND mc.\`Minutes Clinical\` IS NOT NULL AND mc.\`Minutes Clinical\` != 0
          THEN (mc.\`Minutes Clinical\` - FLOOR(0.66 * mc.\`Minutes Clinical\`))
        ELSE (mc.\`Minutes Regular\` - FLOOR(0.66 * mc.\`Minutes Regular\`))
      END
    WHEN ar.symbol_id = 'A' THEN
      CASE
        WHEN FIND_IN_SET(DAYNAME(sess.attendance_session_name), mc.\`Clinical Days\`) > 0
             AND mc.\`Minutes Clinical\` IS NOT NULL AND mc.\`Minutes Clinical\` != 0
          THEN mc.\`Minutes Clinical\`
        ELSE mc.\`Minutes Regular\`
      END
    ELSE 0
  END AS MinutesAbsent
FROM students s
JOIN enrollments e
  ON e.org_defined_id = s.org_defined_id
JOIN courses c
  ON c.course_offering_code = e.course_offering_code
JOIN attendance_registers reg
  ON reg.course_offering_code = c.course_offering_code
JOIN attendance_sessions sess
  ON sess.attendance_register_id = reg.attendance_register_id
JOIN attendance_records ar
  ON ar.org_defined_id = s.org_defined_id
 AND ar.attendance_session_id = sess.attendance_session_id
JOIN attendance_symbols sym
  ON sym.symbol_id = ar.symbol_id
JOIN mastercourses mc
  ON mc.\`Course Offering Code\` = c.course_offering_code
WHERE ar.symbol_id IN ('P','A','T')
  AND sess.attendance_session_name BETWEEN
      COALESCE(STR_TO_DATE(mc.\`Semester Start Date\`, '%m/%d/%Y'), STR_TO_DATE(mc.\`Semester Start Date\`, '%m/%d/%y'))
      AND
      COALESCE(STR_TO_DATE(mc.\`Semester End Date\`,   '%m/%d/%Y'), STR_TO_DATE(mc.\`Semester End Date\`,   '%m/%d/%y'))
  AND CURDATE() <= COALESCE(
        STR_TO_DATE(mc.\`Semester End Date\`, '%m/%d/%Y'),
        STR_TO_DATE(mc.\`Semester End Date\`, '%m/%d/%y')
      )
  AND sess.attendance_session_name NOT IN (
    '2025-05-22','2025-05-26','2025-06-19',
    '2025-06-30','2025-07-01','2025-07-02','2025-07-03','2025-07-04'
  );
`;
/*

LOCATION:
Inside filtered_missing CTE → the WHERE clause

----------------------------------------
WHAT YOU CURRENTLY HAVE: For 2 week at a time missing check
----------------------------------------

WHERE m.date <> '2025-05-14'
AND NOT (
  m.date = '2025-07-31'
  AND (
    mc2.`Course Offering Name` LIKE '%Evening%'
    OR m.course REGEXP '-2$'
  )
)

----------------------------------------
WHAT YOU MUST CHANGE:
----------------------------------------

You are NOT removing anything.

You are ONLY inserting a new condition
ABOVE your existing conditions.

----------------------------------------
FINAL RESULT SHOULD BE:
----------------------------------------

WHERE COALESCE(
  STR_TO_DATE(mc2.`Semester End Date`, '%m/%d/%Y'),
  STR_TO_DATE(mc2.`Semester End Date`, '%m/%d/%y')
) = CURDATE()

AND m.date <> '2025-05-14'

AND NOT (
  m.date = '2025-07-31'
  AND (
    mc2.`Course Offering Name` LIKE '%Evening%'
    OR m.course REGEXP '-2$'
  )
)

----------------------------------------
WHAT THIS DOES:
----------------------------------------

1. FIRST condition:
   Limits results to ONLY courses whose
   Semester End Date = TODAY

2. SECOND condition:
   Keeps your existing exclusion:
   remove 05/14

3. THIRD condition:
   Keeps your existing special exclusion logic
   for 07/31 evening / section -2

----------------------------------------
IMPORTANT:
----------------------------------------

/*

LOCATION:
Inside valid CTE → the WHERE clause

----------------------------------------
WHAT YOU CURRENTLY HAVE:
----------------------------------------

ad.date BETWEEN p.prev_mon AND p.prev_fri

----------------------------------------
WHAT YOU MUST CHANGE:
----------------------------------------

You are NOT removing anything else.

You are ONLY replacing the date window condition.

----------------------------------------
FINAL RESULT SHOULD BE:
----------------------------------------

ad.date BETWEEN ad.d_start AND ad.d_end

----------------------------------------
WHAT THIS DOES:
----------------------------------------

1. Removes the 2-week restriction (prev_mon / prev_fri)

2. Allows the query to evaluate ALL dates
   from course start → course end

3. Ensures today's session (final day)
   is included in expected

----------------------------------------
IMPORTANT:
----------------------------------------

- params block stays (DO NOT DELETE)
- exclusions stay (DO NOT TOUCH)
- only this line changes behavior
- without this, today will NEVER appear as missing

----------------------------------------

*/

    const missingDates = `
WITH RECURSIVE
spans AS (
  SELECT
    mc.\`Course Offering Code\` AS course,
    mc.\`Course Offering Name\` AS cname,
    COALESCE(
      STR_TO_DATE(mc.\`Semester Start Date\`, '%m/%d/%Y'),
      STR_TO_DATE(mc.\`Semester Start Date\`, '%m/%d/%y')
    ) AS d_start,
    COALESCE(
      STR_TO_DATE(mc.\`Semester End Date\`, '%m/%d/%Y'),
      STR_TO_DATE(mc.\`Semester End Date\`, '%m/%d/%y')
    ) AS d_end,
    mc.\`Day of Week Offered\` AS dow,
    mc.\`Clinical Days\` AS cd
  FROM mastercourses mc
  WHERE EXISTS (
    SELECT 1
    FROM rawattendancedata r
    WHERE r.\`Course Offering Code\` = mc.\`Course Offering Code\`
  )
),
all_dates AS (
  SELECT course, cname, d_start AS date, d_end, dow, cd FROM spans
  UNION ALL
  SELECT course, cname, DATE_ADD(date, INTERVAL 1 DAY), d_end, dow, cd
  FROM all_dates
  WHERE date < d_end
),
-- compute prior week's Monday and Friday relative to CURDATE()
params AS (
  SELECT
    DATE_SUB(
      DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY),
      INTERVAL 14 DAY
    ) AS prev_mon,
    DATE_ADD(
      DATE_SUB(
        DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY),
        INTERVAL 7 DAY
      ),
      INTERVAL 4 DAY
    ) AS prev_fri
),
valid AS (
  SELECT ad.course, ad.cname, ad.date, ad.dow, ad.cd, ad.d_end
  FROM all_dates ad
  CROSS JOIN params p
  WHERE ad.date <= ad.d_end
    AND ad.date NOT IN (
      '2025-05-22','2025-05-26','2025-06-19',
      '2025-06-30','2025-07-01','2025-07-02',
      '2025-07-03','2025-07-04','2025-10-13',
      '2025-11-27','2025-11-28','2026-02-16','2026-04-03'
    )
),
expected AS (
  SELECT course, date
  FROM valid
  WHERE
    (CASE
      WHEN dow IS NULL OR dow = '' THEN 0
      ELSE FIND_IN_SET(DAYNAME(date), dow)
     END) > 0
    OR
    (CASE
      WHEN cd IS NULL OR cd = '' THEN 0
      ELSE FIND_IN_SET(DAYNAME(date), cd)
     END) > 0
),
actual AS (
  SELECT DISTINCT
    CourseCallNumber AS course,
    AttendanceDate   AS date
  FROM anthalogyrequestedformat
),
missing_rows AS (
  SELECT e.course, e.date
  FROM expected e
  LEFT JOIN actual a
    ON a.course = e.course
   AND a.date   = e.date
  WHERE a.date IS NULL
),
filtered_missing AS (
  SELECT m.course, m.date
  FROM missing_rows m
  JOIN mastercourses mc2
    ON mc2.\`Course Offering Code\` = m.course
  WHERE COALESCE(
      STR_TO_DATE(mc2.\`Semester End Date\`, '%m/%d/%Y'),
      STR_TO_DATE(mc2.\`Semester End Date\`, '%m/%d/%y')
    ) = CURDATE()
    AND m.date <> '2025-05-14'
    AND NOT (
      m.date = '2025-07-31'
      AND (
        mc2.\`Course Offering Name\` LIKE '%Evening%'
        OR m.course REGEXP '-2$'
      )
    )
)
SELECT
  fm.course,
  GROUP_CONCAT(
    CONCAT(
      DATE_FORMAT(fm.date, '%m/%d/%Y'),
      ' (',
      DAYNAME(fm.date),
      ')'
    )
    ORDER BY fm.date
    SEPARATOR ', '
  ) AS MissingDatesAndDays
FROM filtered_missing fm
JOIN mastercourses mc2
  ON mc2.\`Course Offering Code\` = fm.course
GROUP BY fm.course, mc2.\`Course Offering Name\`
ORDER BY mc2.\`Course Offering Name\` ASC, fm.course ASC;
`;

    // Execute table creation & insert queries
    await connectionAttendance.query(createStudentsTable);
    await connectionAttendance.query(insertStudents);
    console.log('✅ students table ready');

    await connectionAttendance.query(createCoursesTable);
    await connectionAttendance.query(insertCourses);
    console.log('✅ courses table ready');

    await connectionAttendance.query(createRegistersTable);
    await connectionAttendance.query(insertRegisters);
    console.log('✅ attendance_registers table ready');

    await connectionAttendance.query(createSessionsTable);
    await connectionAttendance.query(insertSessions);
    console.log('✅ attendance_sessions table ready');

    await connectionAttendance.query(createEnrollments);
    await connectionAttendance.query(insertEnrollments);
    console.log('✅ enrollments table ready');

    await connectionAttendance.query(createAttendanceRecords);
    await connectionAttendance.query(insertAttendanceRecords);
    console.log('✅ attendance_records table ready');

    await connectionAttendance.query(createAnthalogyRequestedTable);
    await connectionAttendance.query(insertAnthalogyRequestedTable);
    console.log('✅ anthalogyrequestedformat table ready');


    // Console previews
    const [students] = await connectionAttendance.query('SELECT * FROM students');
    console.log('📦 Students:', students);

    const [courses] = await connectionAttendance.query('SELECT * FROM courses');
    console.log('📘 Courses:', courses);

    const [registers] = await connectionAttendance.query('SELECT * FROM attendance_registers');
    console.log('🗃️ Attendance Registers:', registers);

    const [sessions] = await connectionAttendance.query('SELECT * FROM attendance_sessions');
    console.log('📅 Attendance Sessions:', sessions);

    const [enrollments] = await connectionAttendance.query('SELECT * FROM enrollments');
    console.log('🧾 Enrollments:', enrollments);

    const [attendance_records] = await connectionAttendance.query('SELECT * FROM attendance_records');
    console.log('🧾 Attendance Records:', attendance_records);

    const [anthalogy] = await connectionAttendance.query('SELECT * FROM anthalogyrequestedformat');
    console.log('📄 Anthalogy Format:', anthalogy);

    const [missingDatesResult] = await connectionAttendance.query(missingDates);
    console.log('🚨 Missing Dates:', missingDatesResult);

    const [raw] = await connectionAttendance.query('SELECT * FROM rawattendancedata');
    res.json({ raw, missingDates: missingDatesResult });

  } catch (err) {
    console.error('❌ Error in /api/rawdata:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/rawdataGrades', async (req, res) => {
  try {
    await connectionGrades.query('DROP TABLE IF EXISTS anthalogyrequestedgradesformat');
    await connectionGrades.query('DROP TABLE IF EXISTS cleaned_grades');

    // 1) cleaned_grades
    const createCleanedTable = `
      CREATE TABLE IF NOT EXISTS cleaned_grades LIKE rawgrades;
    `;
    const insertCleanedSelect = `
      INSERT INTO cleaned_grades
      SELECT rg.*
      FROM rawgrades rg
      JOIN mastercourses mc
        ON mc.\`Course Offering Code\` = rg.\`Course Offering Code\`
      WHERE rg.\`Role Name\` = 'Learner'
        AND rg.\`Final Adjusted Grade Is Released?\` IN ('1', 1)
        AND rg.\`Semester Name\` LIKE '%2025-2026 SPRING%'
        AND COALESCE(
              STR_TO_DATE(mc.\`Semester End Date\`, '%m/%d/%Y'),
              STR_TO_DATE(mc.\`Semester End Date\`, '%m/%d/%y')
            )<= STR_TO_DATE('03/23/2026','%m/%d/%Y');
    `;
    await connectionGrades.query(createCleanedTable);
    await connectionGrades.query('TRUNCATE TABLE cleaned_grades');
    await connectionGrades.query(insertCleanedSelect);

    // 2) formatted table
    const createFormatted = `
      CREATE TABLE IF NOT EXISTS anthalogyrequestedgradesformat (
        StudentIdentifier VARCHAR(64) NOT NULL,
        CourseIdentifier  VARCHAR(128) NOT NULL,
        GradePostingDate  DATE        NOT NULL,
        GradeType         CHAR(1)     NOT NULL,
        GradeValueType    CHAR(1)     NOT NULL,
        LetterGrade       VARCHAR(4)  NULL,
        NumericGrade      DECIMAL(10,2) NOT NULL,
        PRIMARY KEY (StudentIdentifier, CourseIdentifier)
      );
    `;
    const insertFormatted = `
      INSERT INTO anthalogyrequestedgradesformat
      (
        StudentIdentifier, CourseIdentifier, GradePostingDate,
        GradeType, GradeValueType, LetterGrade, NumericGrade
      )
      SELECT
        cg.\`Org Defined Id\`,
        cg.\`Course Offering Code\`,
        DATE(
          COALESCE(
            CASE
              WHEN cg.\`Final Adjusted Grade Is Released?\` IN ('1',1)
                   AND NULLIF(cg.\`Final Adjusted Grade (Percentage)\`, '') IS NOT NULL
              THEN COALESCE(
                     STR_TO_DATE(REPLACE(REPLACE(cg.\`Final Adjusted Last Modified Date\`, 'T',' '),'Z',''), '%Y-%m-%d %H:%i:%s.%f'),
                     STR_TO_DATE(REPLACE(REPLACE(cg.\`Final Adjusted Last Modified Date\`, 'T',' '),'Z',''), '%Y-%m-%d %H:%i:%s'),
                     STR_TO_DATE(cg.\`Final Adjusted Last Modified Date\`, '%m/%d/%Y')
                   )
            END,
            CASE
              WHEN NULLIF(cg.\`Final Calculated Grade (Percentage)\`, '') IS NOT NULL
              THEN COALESCE(
                     STR_TO_DATE(REPLACE(REPLACE(cg.\`Final Calculated Grade Last Modified Date\`, 'T',' '),'Z',''), '%Y-%m-%d %H:%i:%s.%f'),
                     STR_TO_DATE(REPLACE(REPLACE(cg.\`Final Calculated Grade Last Modified Date\`, 'T',' '),'Z',''), '%Y-%m-%d %H:%i:%s'),
                     STR_TO_DATE(cg.\`Final Calculated Grade Last Modified Date\`, '%m/%d/%Y')
                   )
            END
          )
        ),
        'F','N','',
        CAST(
          COALESCE(
            CASE
              WHEN cg.\`Final Adjusted Grade Is Released?\` IN ('1',1)
                   AND NULLIF(cg.\`Final Adjusted Grade (Percentage)\`, '') IS NOT NULL
              THEN cg.\`Final Adjusted Grade (Percentage)\`
            END,
            NULLIF(cg.\`Final Calculated Grade (Percentage)\`, '')
          ) AS DECIMAL(10,2)
        )
      FROM cleaned_grades cg
      WHERE
        COALESCE(
          CASE
            WHEN cg.\`Final Adjusted Grade Is Released?\` IN ('1',1)
                 AND NULLIF(cg.\`Final Adjusted Grade (Percentage)\`, '') IS NOT NULL
            THEN cg.\`Final Adjusted Grade (Percentage)\`
          END,
          NULLIF(cg.\`Final Calculated Grade (Percentage)\`, '')
        ) IS NOT NULL;
    `;
    await connectionGrades.query(createFormatted);
    await connectionGrades.query('TRUNCATE TABLE anthalogyrequestedgradesformat');
    await connectionGrades.query(insertFormatted);
    const [cleanedPreview] = await connectionGrades.query('SELECT * FROM cleaned_grades');
    console.log('📘 cleaned_grades:', cleanedPreview);

    const [formattedPreview] = await connectionGrades.query('SELECT * FROM anthalogyrequestedgradesformat');
    console.log('📄 anthalogyrequestedgradesformat:', formattedPreview);

    // 3) “missing” tables

    //For capstone courses flip sign to >=
    //For everything else keep >
    const missingWithValuesSQL = `
      WITH base AS (
        SELECT
          rg.\`Org Defined Id\` AS OrgDefinedId,
          rg.\`First Name\`     AS FirstName,
          rg.\`Last Name\`      AS LastName,
          rg.\`Course Offering Code\` AS CourseOfferingCode,
          rg.\`Course Offering Name\` AS CourseName,
          rg.\`Semester Name\`  AS SemesterName,
          rg.\`Final Adjusted Grade Is Released?\` AS ReleasedFlag,
          NULLIF(rg.\`Final Adjusted Grade (Percentage)\`, '')   AS AdjustedPct,
          NULLIF(rg.\`Final Calculated Grade (Percentage)\`, '') AS CalculatedPct
        FROM rawgrades rg
        JOIN mastercourses mc
          ON mc.\`Course Offering Code\` = rg.\`Course Offering Code\`
        WHERE rg.\`Role Name\` = 'Learner'
          AND rg.\`Semester Name\` LIKE '%2025-2026 SPRING%'
          AND COALESCE(
                STR_TO_DATE(mc.\`Semester End Date\`, '%m/%d/%Y'),
                STR_TO_DATE(mc.\`Semester End Date\`, '%m/%d/%y')
              )> STR_TO_DATE('03/23/2026','%m/%d/%Y')
      )
      SELECT
        CourseOfferingCode, CourseName, SemesterName,
        OrgDefinedId, FirstName, LastName,
        CASE
          WHEN AdjustedPct IS NOT NULL AND CalculatedPct IS NOT NULL THEN 'Both Adjusted & Calculated'
          WHEN AdjustedPct IS NOT NULL AND CalculatedPct IS NULL THEN 'Adjusted only'
          WHEN AdjustedPct IS NULL AND CalculatedPct IS NOT NULL THEN 'Calculated only'
          ELSE 'Neither'
        END AS GradePresenceStatus
      FROM base
      WHERE (ReleasedFlag NOT IN ('1',1) OR ReleasedFlag IS NULL)
        AND (AdjustedPct IS NOT NULL OR CalculatedPct IS NOT NULL)
      ORDER BY CourseOfferingCode, LastName, FirstName;
    `;

    const missingNeitherSQL = `
      WITH base AS (
        SELECT
          rg.\`Org Defined Id\` AS OrgDefinedId,
          rg.\`First Name\`     AS FirstName,
          rg.\`Last Name\`      AS LastName,
          rg.\`Course Offering Code\` AS CourseOfferingCode,
          rg.\`Course Offering Name\` AS CourseName,
          rg.\`Semester Name\`  AS SemesterName,
          rg.\`Final Adjusted Grade Is Released?\` AS ReleasedFlag,
          NULLIF(rg.\`Final Adjusted Grade (Percentage)\`, '')   AS AdjustedPct,
          NULLIF(rg.\`Final Calculated Grade (Percentage)\`, '') AS CalculatedPct
        FROM rawgrades rg
        JOIN mastercourses mc
          ON mc.\`Course Offering Code\` = rg.\`Course Offering Code\`
        WHERE rg.\`Role Name\` = 'Learner'
          AND rg.\`Semester Name\` LIKE '%2025-2026 SPRING%'
          AND COALESCE(
                STR_TO_DATE(mc.\`Semester End Date\`, '%m/%d/%Y'),
                STR_TO_DATE(mc.\`Semester End Date\`, '%m/%d/%y')
              )> STR_TO_DATE('03/23/2026','%m/%d/%Y')
      )
      SELECT
        CourseOfferingCode, CourseName, SemesterName,
        OrgDefinedId, FirstName, LastName,
        'Neither Adjusted nor Calculated' AS GradePresenceStatus
      FROM base
      WHERE (ReleasedFlag NOT IN ('1',1) OR ReleasedFlag IS NULL)
        AND AdjustedPct IS NULL
        AND CalculatedPct IS NULL
      ORDER BY CourseOfferingCode, LastName, FirstName;
    `;

    const [missingWithValues] = await connectionGrades.query(missingWithValuesSQL);
    const [missingNeither] = await connectionGrades.query(missingNeitherSQL);

    const [cleaned] = await connectionGrades.query(`SELECT * FROM cleaned_grades`);
    console.log('📘 Cleaned Grades:', cleaned);

    const [formatted] = await connectionGrades.query(`SELECT * FROM anthalogyrequestedgradesformat`);
    console.log('📄 Anthology Grades Format:', formatted);

    console.log('🚨 Missing Grades With Values:', missingWithValues);
    console.log('🚨 Missing Grades Neither:', missingNeither);

    res.json({
      missingGradesWithValues: missingWithValues,
      missingGradesNeither: missingNeither,
      cleaned,
      formatted
    });

  } catch (err) {
    console.error('❌ Error in /api/rawdataGrades:', err);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/api/formatteddata', async (req, res) => {
  try {
    const [rows] = await connectionAttendance.query(`
      SELECT
        StudentIdentifier,
        CourseCallNumber,
        DATE_FORMAT(AttendanceDate, '%m/%d/%Y') AS AttendanceDate,
        MinutesAttended,
        MinutesAbsent
      FROM anthalogyrequestedformat
    `);
    res.json(rows);

  } catch (err) {
    console.error('❌ Error in /api/formatteddata:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Show Anthology-formatted grades from cleaned_grades

app.get('/api/export-missing-grades-csv', async (req, res) => {
  try {
    const sql = `
      WITH base AS (
        SELECT
          rg.\`Org Defined Id\`       AS oid,
          rg.\`Course Offering Code\` AS coc,
          CAST(NULLIF(rg.\`Final Adjusted Grade (Percentage)\`,   '') AS DECIMAL(10,2)) AS adj_pct,
          CAST(NULLIF(rg.\`Final Calculated Grade (Percentage)\`, '') AS DECIMAL(10,2)) AS calc_pct,
          COALESCE(
            STR_TO_DATE(REPLACE(REPLACE(rg.\`Final Adjusted Last Modified Date\`, 'T',' '), 'Z',''), '%Y-%m-%d %H:%i:%s.%f'),
            STR_TO_DATE(REPLACE(REPLACE(rg.\`Final Adjusted Last Modified Date\`, 'T',' '), 'Z',''), '%Y-%m-%d %H:%i:%s'),
            STR_TO_DATE(rg.\`Final Adjusted Last Modified Date\`, '%m/%d/%Y')
          ) AS adj_dt,
          COALESCE(
            STR_TO_DATE(REPLACE(REPLACE(rg.\`Final Calculated Grade Last Modified Date\`, 'T',' '), 'Z',''), '%Y-%m-%d %H:%i:%s.%f'),
            STR_TO_DATE(REPLACE(REPLACE(rg.\`Final Calculated Grade Last Modified Date\`, 'T',' '), 'Z',''), '%Y-%m-%d %H:%i:%s'),
            STR_TO_DATE(rg.\`Final Calculated Grade Last Modified Date\`, '%m/%d/%Y')
          ) AS calc_dt
        FROM rawgrades rg
        JOIN mastercourses mc
          ON mc.\`Course Offering Code\` = rg.\`Course Offering Code\`
        WHERE rg.\`Role Name\` = 'Learner'
          AND rg.\`Semester Name\` LIKE '%2025-2026 SPRING%'
          AND COALESCE(
                STR_TO_DATE(mc.\`Semester End Date\`, '%m/%d/%Y'),
                STR_TO_DATE(mc.\`Semester End Date\`, '%m/%d/%y')
              ) > STR_TO_DATE('03/23/2026','%m/%d/%Y')
      )
      SELECT
        b.oid AS StudentIdentifier,
        b.coc AS CourseIdentifier,
        DATE(
          CASE
            WHEN b.adj_pct IS NOT NULL AND (b.calc_pct IS NULL OR b.adj_pct >= b.calc_pct) THEN b.adj_dt
            WHEN b.calc_pct IS NOT NULL THEN b.calc_dt
            ELSE NULL
          END
        ) AS GradePostingDate,
        'F' AS GradeType,
        'N' AS GradeValueType,
        ''  AS LetterGrade,
        CASE
          WHEN b.adj_pct IS NOT NULL AND b.calc_pct IS NOT NULL THEN GREATEST(b.adj_pct, b.calc_pct)
          WHEN b.adj_pct IS NOT NULL THEN b.adj_pct
          WHEN b.calc_pct IS NOT NULL THEN b.calc_pct
          ELSE NULL
        END AS NumericGrade
      FROM base b
      WHERE (b.adj_pct IS NOT NULL OR b.calc_pct IS NOT NULL);
    `;

    const [rows] = await connectionGrades.query(sql);
    if (!rows || rows.length === 0) {
      return res.status(400).send('No grade data available to export.');
    }

    const json2csvParser = new Parser({ quote: '' });
    const csv = json2csvParser.parse(rows);

    res.header('Content-Type', 'text/csv');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.attachment(`${dateStr}_pending_acceptance_grades_export.csv`);
    res.send(csv);

  } catch (error) {
    console.error('❌ Failed to export missing-with-values CSV:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/formatted-grades', async (req, res) => {
  try {
    const [rows] = await connectionGrades.query(`
      SELECT
        rg.\`Org Defined Id\`       AS StudentIdentifier,
        rg.\`Course Offering Code\` AS CourseIdentifier,
        DATE_FORMAT(
          COALESCE(
            STR_TO_DATE(REPLACE(REPLACE(rg.\`Final Adjusted Last Modified Date\`, 'T',' '),'Z',''), '%Y-%m-%d %H:%i:%s.%f'),
            STR_TO_DATE(REPLACE(REPLACE(rg.\`Final Adjusted Last Modified Date\`, 'T',' '),'Z',''), '%Y-%m-%d %H:%i:%s'),
            STR_TO_DATE(rg.\`Final Adjusted Last Modified Date\`, '%m/%d/%Y'),
            STR_TO_DATE(REPLACE(REPLACE(rg.\`Final Calculated Grade Last Modified Date\`, 'T',' '),'Z',''), '%Y-%m-%d %H:%i:%s.%f'),
            STR_TO_DATE(REPLACE(REPLACE(rg.\`Final Calculated Grade Last Modified Date\`, 'T',' '),'Z',''), '%Y-%m-%d %H:%i:%s'),
            STR_TO_DATE(rg.\`Final Calculated Grade Last Modified Date\`, '%m/%d/%Y')
          ),
          '%m/%d/%Y'
        ) AS GradePostingDate,
        'F' AS GradeType,
        'N' AS GradeValueType,
        ''  AS LetterGrade,
        COALESCE(
          NULLIF(rg.\`Final Adjusted Grade (Percentage)\`, ''),
          rg.\`Final Calculated Grade (Percentage)\`
        ) AS NumericGrade
      FROM cleaned_grades rg
      ORDER BY rg.\`Course Offering Code\`, rg.\`Org Defined Id\`;
    `);

    res.json(rows);

  } catch (err) {
    console.error('❌ Error in /api/formatted-grades:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/view-singleclass-attendance', async (req, res) => {
  const viewsingleattendance = req.query.course;

  try {
    const [rows] = await connectionAttendance.query(`
      SELECT
        StudentIdentifier,
        CourseCallNumber,
        DATE_FORMAT(AttendanceDate, '%m/%d/%Y') AS AttendanceDate,
        MinutesAttended,
        MinutesAbsent
      FROM anthalogyrequestedformat
      WHERE CourseCallNumber = ?
    `, [viewsingleattendance]);

    res.json(rows);

  } catch (err) {
    console.error('❌ Error in /api/view-singleclass-attendance:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/export-csv', async (req, res) => {
  try {
    const [rows] = await connectionAttendance.query(`
      SELECT
        StudentIdentifier,
        CourseCallNumber,
        DATE_FORMAT(AttendanceDate, '%m/%d/%Y') AS AttendanceDate,
        MinutesAttended,
        MinutesAbsent
      FROM anthalogyrequestedformat
    `);

    if (rows.length === 0) {
      return res.status(400).send('No data available to export.');
    }

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(rows);

    res.header('Content-Type', 'text/csv');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.attachment(`${dateStr}_anthalogy_formatted_export.csv`);
    res.send(csv);

  } catch (error) {
    console.error('❌ Failed to export CSV:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/export-grades-csv', async (req, res) => {
  try {
    const [rows] = await connectionGrades.query(`
      SELECT
        StudentIdentifier,
        CourseIdentifier,
        DATE_FORMAT(GradePostingDate, '%m/%d/%Y') AS GradePostingDate,
        GradeType,
        GradeValueType,
        LetterGrade,
        NumericGrade
      FROM anthalogyrequestedgradesformat
    `);

    if (rows.length === 0) {
      return res.status(400).send('No grade data available to export.');
    }

    const json2csvParser = new Parser({ quote: '', escapedQuote: '' });
    const csv = json2csvParser.parse(rows);

    res.header('Content-Type', 'text/csv;charset=utf-8');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.attachment(`${dateStr}_anthalogy_grades_export.csv`);
    res.send("\uFEFF" + csv);

  } catch (error) {
    console.error('❌ Failed to export grades CSV:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/export-singleclass-attendance-csv', async (req, res) => {
  try {
    const course = req.query.course;

    if (!course) {
      return res.status(400).send('Course parameter is required');
    }

    const [rows] = await connectionAttendance.query(`
      SELECT
        StudentIdentifier,
        CourseCallNumber,
        DATE_FORMAT(AttendanceDate, '%m/%d/%Y') AS AttendanceDate,
        MinutesAttended,
        MinutesAbsent
      FROM anthalogyrequestedformat
      WHERE CourseCallNumber = ?
      ORDER BY StudentIdentifier, AttendanceDate
    `, [course]);

    if (!rows || rows.length === 0) {
      return res.status(400).send('No data available for this class.');
    }

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(rows);

    res.header('Content-Type', 'text/csv');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.attachment(`${dateStr}_${course}_attendance_export.csv`);
    res.send(csv);

  } catch (error) {
    console.error('❌ Failed to export single class attendance CSV:', error);
    res.status(500).send('Internal Server Error');
  }
});

