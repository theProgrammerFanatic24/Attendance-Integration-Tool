// db.js
import mysql from 'mysql2/promise';

export const connectionAttendance = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'd2l_integration_solution',
});

export const connectionGrades = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'd2l_integration_solution_grades',
});

console.log('✅ DB connected (from db.js)');

// DO NOT default-export a single connection.
// Export both named:
export default { connectionAttendance, connectionGrades };
