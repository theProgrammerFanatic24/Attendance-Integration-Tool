import { useState } from 'react';
import './App.css';

function App() {
  const [csvUpload, setCsvUpload] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[][]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [formattedData, setFormattedData] = useState<any[][]>([]);
  const [formattedHeaders, setFormattedHeaders] = useState<string[]>([]);
  const [missingDates, setMissingDates] = useState<any[][]>([]);
  const [missingHeaders, setMissingHeaders] = useState<string[]>([]);
  const [formattedGrades, setFormattedGrades] = useState<any[][]>([]);
  const [formattedGradesHeaders, setFormattedGradesHeaders] = useState<string[]>([]);
  const [missingGradesWithValues, setMissingGradesWithValues] = useState<any[][]>([]);
  const [missingGradesWithValuesHeaders, setMissingGradesWithValuesHeaders] = useState<string[]>([]);
  const [missingGradesNeither, setMissingGradesNeither] = useState<any[][]>([]);
  const [missingGradesNeitherHeaders, setMissingGradesNeitherHeaders] = useState<string[]>([]);
  const [singleClassView, setSingleClassView] = useState<any[][]>([]);
  const [singleClassHeaders, setSingleClassHeaders] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState('');



  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setCsvUpload(file);
    if (file) console.log('File uploaded:', file.name);
  };

  const fetchRawData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/rawdata');
      const { raw, missingDates } = await response.json(); // { raw: [...], missingDates: [...] }

      if (raw?.length > 0) {
        setRawHeaders(Object.keys(raw[0]));
        setRawData(raw.map((row: any) => Object.values(row)));
      } else {
        setRawHeaders([]);
        setRawData([]);
      }

      if (missingDates?.length > 0) {
        setMissingHeaders(Object.keys(missingDates[0]));
        setMissingDates(missingDates.map((row: any) => Object.values(row)));
      } else {
        setMissingHeaders([]);
        setMissingDates([]);
      }
    } catch (err) {
      console.error('❌ Failed to fetch raw attendance data:', err);
    }
  };

  const fetchFormattedData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/formatteddata');
      const data = await response.json(); // plain array
      if (data.length > 0) {
        setFormattedHeaders(Object.keys(data[0]));
        setFormattedData(data.map((row: any) => Object.values(row)));
      } else {
        setFormattedHeaders([]);
        setFormattedData([]);
      }
    } catch (err) {
      console.error('❌ Failed to fetch formatted data:', err);
    }
  };

  const fetchRawGradeData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/rawdataGrades');
      const data = await response.json();

      // show cleaned in Raw Table (so buttons appear)
      if (Array.isArray(data.cleaned) && data.cleaned.length > 0) {
        setRawHeaders(Object.keys(data.cleaned[0]));
        setRawData(data.cleaned.map((row: any) => Object.values(row)));
      } else {
        setRawHeaders([]);
        setRawData([]);
      }

      if (Array.isArray(data.missingGradesWithValues) && data.missingGradesWithValues.length > 0) {
        setMissingGradesWithValuesHeaders(Object.keys(data.missingGradesWithValues[0]));
        setMissingGradesWithValues(data.missingGradesWithValues.map((r: any) => Object.values(r)));
      } else {
        setMissingGradesWithValuesHeaders([]);
        setMissingGradesWithValues([]);
      }

      if (Array.isArray(data.missingGradesNeither) && data.missingGradesNeither.length > 0) {
        setMissingGradesNeitherHeaders(Object.keys(data.missingGradesNeither[0]));
        setMissingGradesNeither(data.missingGradesNeither.map((r: any) => Object.values(r)));
      } else {
        setMissingGradesNeitherHeaders([]);
        setMissingGradesNeither([]);
      }

      // Optional: preview formatted here too
      if (Array.isArray(data.formatted) && data.formatted.length > 0) {
        setFormattedGradesHeaders(Object.keys(data.formatted[0]));
        setFormattedGrades(data.formatted.map((r: any) => Object.values(r)));
      }
    } catch (err) {
      console.error('❌ Failed to fetch raw grade data:', err);
    }
  };
  const downloadMissingWithValuesCSV = () => {
    const link = document.createElement('a');
    link.href = 'http://localhost:3001/api/export-missing-grades-csv';
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const fetchFormattedGrades = async () => {
    try {
      const resp = await fetch('http://localhost:3001/api/formatted-grades');
      const data = await resp.json();
      if (data?.length > 0) {
        setFormattedGradesHeaders(Object.keys(data[0]));
        setFormattedGrades(data.map((r: any) => Object.values(r)));
      } else {
        setFormattedGradesHeaders([]);
        setFormattedGrades([]);
      }
    } catch (err) {
      console.error('❌ Failed to fetch formatted grades:', err);
    }
  };

  const downloadCSV = () => {
    const link = document.createElement('a');
    link.href = 'http://localhost:3001/api/export-csv';
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadGradesCSV = () => {
    const link = document.createElement('a');
    link.href = 'http://localhost:3001/api/export-grades-csv';
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadGradesPDF = () => {
    const link = document.createElement('a');
    link.href = 'http://localhost:3001/api/export-grades-pdf';
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const fetchSingleClassView = async () => {
    try {
      const resp = await fetch(
        `http://localhost:3001/api/view-singleclass-attendance?course=${selectedClass}`
      );
      const data = await resp.json();

      if (data.length > 0) {
        setSingleClassHeaders(Object.keys(data[0]));
        setSingleClassView(data.map((row: any) => Object.values(row)));
      } else {
        setSingleClassHeaders([]);
        setSingleClassView([]);
      }
    } catch (err) {
      console.error('❌ Failed to fetch Single Class View:', err);
    }
  };
  const courseIndex = formattedHeaders.indexOf('CourseCallNumber');

  const courseOptions =
    courseIndex === -1
      ? []
      : Array.from(
        new Set(formattedData.map(row => row[courseIndex]))
      );
  const downloadSingleClassCSV = () => {
    if (!selectedClass) {
      alert('Please select a class first');
      return;
    }

    const link = document.createElement('a');
    link.href = `http://localhost:3001/api/export-singleclass-attendance-csv?course=${encodeURIComponent(selectedClass)}`;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  return (
    <>
      <h1>Use the tool below to convert D2L's spreadsheet to Anthology format</h1>

      <div>
        <label htmlFor="csvUpload">Upload your CSV file: </label>
        <input type="file" id="csvUpload" onChange={handleFileUpload} />
        {csvUpload && <p>File uploaded: {csvUpload.name}</p>}
      </div>

      <div style={{ marginTop: '20px' }}>
        <button onClick={fetchRawData}>Show Table from Attendance Database</button>
      </div>
      <div style={{ marginTop: '20px' }}>
        <button onClick={fetchRawGradeData}>Show Table from Grades Database</button>
      </div>

      {rawData.length > 0 && (
        <>
          <div className="tableWrapper">
            <h2>Raw Table</h2>
            <table className="scrollableTable">
              <thead>
                <tr>
                  {rawHeaders.map((header, index) => (
                    <th key={index}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawData.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '20px', marginBottom: '40px' }}>
            <button onClick={fetchFormattedData}>Show Formatted Data</button>
          </div>
          <div style={{ marginTop: '20px' }}>
            <button style={{ marginLeft: '10px' }} onClick={fetchFormattedGrades}>
              Show Formatted Grades
            </button>
          </div>
        </>
      )}

      {/* Attendance formatted + missing dates */}
      {formattedData.length > 0 && (
        <>
          <div className="tableWrapper">
            <h2>Formatted Table</h2>
            <table className="scrollableTable">
              <thead>
                <tr>
                  {formattedHeaders.map((header, index) => (
                    <th key={index}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {formattedData.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => {
                      const header = formattedHeaders[cellIndex];
                      let displayValue = cell;

                      if (header === 'AttendanceDate' && cell) {
                        const d = new Date(String(cell));
                        displayValue = isNaN(d.getTime())
                          ? String(cell)
                          : d.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          });
                      }

                      return <td key={cellIndex}>{displayValue}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {missingDates.length > 0 && (
            <div className="tableWrapper">
              <h2>Missing Dates</h2>
              <table className="scrollableTable">
                <thead>
                  <tr>
                    {missingHeaders.map((header, index) => (
                      <th key={index}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {missingDates.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ marginTop: '20px' }}>
            <button onClick={fetchSingleClassView}>VIEW SINGLE CLASS</button>

            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
            >
              <option value="">Choose...</option>

              {courseOptions.map(course => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>

            {singleClassView.length > 0 && (
              <>
                <div className="tableWrapper">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2>Single Class Attendance</h2>
                    <button onClick={downloadSingleClassCSV}>
                      Download CSV
                    </button>
                  </div>

                  <table className="scrollableTable">
                    <thead>
                      <tr>
                        {singleClassHeaders.map((header, index) => (
                          <th key={index}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {singleClassView.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Attendance export buttons */}
          <div style={{ marginTop: '20px' }}>
            <button onClick={downloadCSV}>Export to CSV</button>
            <button style={{ marginLeft: '10px' }}>Export to PDF</button>
          </div>
        </>
      )}
      {/* Grades — Missing (Released=false, with Adjusted/Calculated) */}
      {missingGradesWithValues.length > 0 && (
        <div className="tableWrapper">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2>Missing Grades – Pending Acceptance (Adjusted/Calculated present)</h2>
            <button onClick={downloadMissingWithValuesCSV}>Download CSV</button>
          </div>
          <table className="scrollableTable">
            <thead>
              <tr>
                {missingGradesWithValuesHeaders.map((h, i) => <th key={i}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {missingGradesWithValues.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Grades — Missing (Released=false, Neither present) */}
      {missingGradesNeither.length > 0 && (
        <div className="tableWrapper">
          <h2>Missing Grades – No Adjusted/Calculated Entered</h2>
          <table className="scrollableTable">
            <thead>
              <tr>
                {missingGradesNeitherHeaders.map((h, i) => <th key={i}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {missingGradesNeither.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Grades formatted (independent) */}
      {formattedGrades.length > 0 && (
        <div className="tableWrapper">
          <h2>Formatted Grades (Anthology)</h2>
          <table className="scrollableTable">
            <thead>
              <tr>
                {formattedGradesHeaders.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {formattedGrades.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Export buttons under the last visible table */}
      {formattedGrades.length > 0 ? (
        <div style={{ marginTop: '20px' }}>
          <button onClick={downloadGradesCSV}>Export Grades to CSV</button>
          <button style={{ marginLeft: '10px' }} onClick={downloadGradesPDF}>
            Export Grades to PDF
          </button>
        </div>
      ) : formattedData.length > 0 ? (
        <div style={{ marginTop: '20px' }}>
          <button onClick={downloadCSV}>Export to CSV</button>
          <button style={{ marginLeft: '10px' }}>Export to PDF</button>
        </div>
      ) : null}
    </>
  );
}

export default App;
