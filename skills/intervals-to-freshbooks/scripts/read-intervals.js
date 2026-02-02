// Intervals Read Entries Script
// Run via: chrome-devtools evaluate_script
// Reads weekly timesheet and aggregates by project+worktype

async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Parse the week dates from the header
  function parseWeekDates() {
    // Look for week navigation/header showing date range
    const weekHeader = document.querySelector('.week-nav, .date-range, [class*="week"]');
    const headerText = weekHeader?.textContent || '';

    // Also check the day headers in the table
    const dayHeaders = document.querySelectorAll('th[data-day], .day-header, thead th');
    const dates = [];

    dayHeaders.forEach(th => {
      const dateMatch = th.textContent.match(/(\d{1,2})\/(\d{1,2})/);
      if (dateMatch) {
        dates.push({ month: parseInt(dateMatch[1]), day: parseInt(dateMatch[2]) });
      }
    });

    // Determine year (current year, adjust if needed for Dec/Jan boundary)
    const now = new Date();
    let year = now.getFullYear();

    // If we're in January but see December dates, use previous year for those
    // If we're in December but see January dates, use next year for those

    return { dates, year, headerText };
  }

  // Parse date string like "01/06/2026" to Date object
  function parseDate(dateStr) {
    const [month, day, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  }

  // Get day of week: 0=Mon, 1=Tue, ..., 6=Sun (Intervals style)
  function getDayIndex(date) {
    const jsDay = date.getDay(); // 0=Sun, 1=Mon, ...
    return jsDay === 0 ? 6 : jsDay - 1; // Convert to Mon=0, Sun=6
  }

  // Find the time entries section
  function findEntriesTable() {
    // Look for the detail time entries table
    // It should contain columns: Client, Project, Work Type, Description, Date, Hours, Billable
    const tables = document.querySelectorAll('table');

    for (const table of tables) {
      const headers = table.querySelectorAll('th');
      const headerTexts = Array.from(headers).map(h => h.textContent.toLowerCase());

      // Check if this looks like the entries table
      if (headerTexts.some(h => h.includes('client')) &&
          headerTexts.some(h => h.includes('project')) &&
          headerTexts.some(h => h.includes('hours'))) {
        return table;
      }
    }

    // Fallback: look for specific class names
    return document.querySelector('.time-entries-table, .entries-list, [class*="entries"]');
  }

  // Extract entries from the table
  function extractEntries() {
    const entries = [];

    // Try multiple strategies to find entry rows

    // Strategy 1: Look for rows with time entry data attributes
    let rows = document.querySelectorAll('tr[data-time-id], tr[data-entry-id]');

    // Strategy 2: Look for rows in a tbody after "Time entries" heading
    if (rows.length === 0) {
      const heading = Array.from(document.querySelectorAll('h2, h3, .section-header'))
        .find(h => h.textContent.toLowerCase().includes('time entries'));
      if (heading) {
        const table = heading.nextElementSibling?.querySelector('table') ||
                      heading.parentElement?.querySelector('table');
        if (table) {
          rows = table.querySelectorAll('tbody tr');
        }
      }
    }

    // Strategy 3: Find table with specific structure
    if (rows.length === 0) {
      const table = findEntriesTable();
      if (table) {
        rows = table.querySelectorAll('tbody tr');
      }
    }

    // Strategy 4: Look for specific entry containers
    if (rows.length === 0) {
      rows = document.querySelectorAll('.time-entry-row, .entry-row, [class*="entry-"]');
    }

    // Process each row
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 4) return; // Skip rows without enough data

      // Try to extract data from cells
      // Common layouts: Client | Project | WorkType | Description | Date | Hours | Billable

      let client = '';
      let project = '';
      let workType = '';
      let description = '';
      let date = '';
      let hours = 0;
      let billable = false;

      // Look for specific data in cells
      cells.forEach((cell, idx) => {
        const text = cell.textContent.trim();
        const cellClass = cell.className.toLowerCase();

        // Check class names for hints
        if (cellClass.includes('client')) {
          client = text;
        } else if (cellClass.includes('project')) {
          project = cell.querySelector('a')?.textContent.trim() || text;
        } else if (cellClass.includes('worktype') || cellClass.includes('work-type')) {
          workType = text;
        } else if (cellClass.includes('description') || cellClass.includes('notes')) {
          description = text;
        } else if (cellClass.includes('date')) {
          date = text;
        } else if (cellClass.includes('hours') || cellClass.includes('time')) {
          hours = parseFloat(text) || 0;
        } else if (cellClass.includes('billable')) {
          billable = cell.querySelector('input[type="checkbox"]')?.checked ||
                     text.toLowerCase() === 'yes' ||
                     cell.querySelector('.checkmark, .checked') !== null;
        }

        // Fallback: try to infer from content
        if (!date && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
          date = text;
        }
        if (!hours && /^\d+(\.\d+)?$/.test(text) && parseFloat(text) <= 24) {
          // Likely hours if it's a small number
          const val = parseFloat(text);
          if (val > 0 && val <= 24) {
            hours = val;
          }
        }
      });

      // Also check for links that might be project names
      const projectLink = row.querySelector('a[href*="project"]');
      if (projectLink && !project) {
        project = projectLink.textContent.trim();
      }

      // Skip if we don't have essential data
      if (!project || !hours) return;

      entries.push({
        client,
        project,
        workType,
        description,
        date,
        hours,
        billable
      });
    });

    return entries;
  }

  // Aggregate entries by client+project+workType
  function aggregateEntries(entries) {
    const grouped = {};

    entries.forEach(entry => {
      const key = `${entry.client}|${entry.project}|${entry.workType}`;

      if (!grouped[key]) {
        grouped[key] = {
          client: entry.client,
          project: entry.project,
          workType: entry.workType,
          hours: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 },
          totalHours: 0,
          billable: entry.billable,
          descriptions: []
        };
      }

      // Add hours to the appropriate day
      if (entry.date) {
        const date = parseDate(entry.date);
        const dayIdx = getDayIndex(date);
        const dayNames = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        grouped[key].hours[dayNames[dayIdx]] += entry.hours;
      }

      grouped[key].totalHours += entry.hours;

      if (entry.description && !grouped[key].descriptions.includes(entry.description)) {
        grouped[key].descriptions.push(entry.description);
      }
    });

    return Object.values(grouped);
  }

  // Alternative: Read from the summary table (project rows with hours per day)
  function readSummaryTable() {
    const entries = [];

    // Look for the summary/grid table with projects as rows and days as columns
    const summaryRows = document.querySelectorAll('tr[data-project-row]');

    summaryRows.forEach(row => {
      const projectCell = row.querySelector('.col-time-multiple-clientproject');
      const worktypeCell = row.querySelector('.col-time-multiple-worktype');

      // Get current selections from dropdowns
      const projectHeader = projectCell?.querySelector('.dropt-header');
      const worktypeHeader = worktypeCell?.querySelector('.dropt-header');

      const project = projectHeader?.textContent.trim() || '';
      const workType = worktypeHeader?.textContent.trim() || '';

      if (!project || project === 'Select Project...') return;

      // Read hours for each day
      const hours = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

      for (let i = 0; i <= 6; i++) {
        const input = row.querySelector(`input[name*="[dates][${i}][time]"]`);
        if (input) {
          const val = parseFloat(input.value) || 0;
          hours[dayNames[i]] = val;
        }
      }

      const totalHours = Object.values(hours).reduce((a, b) => a + b, 0);

      if (totalHours > 0) {
        entries.push({
          client: '', // Summary table may not show client separately
          project,
          workType,
          hours,
          totalHours,
          billable: true
        });
      }
    });

    return entries;
  }

  // Determine week start/end dates
  function getWeekRange() {
    // Try to find week dates from the page
    const dateInputs = document.querySelectorAll('input[type="date"], input[name*="date"]');
    const weekSelect = document.querySelector('select[name*="week"], .week-selector');

    // Look for date in URL
    const urlMatch = window.location.href.match(/date=(\d{4}-\d{2}-\d{2})/);
    if (urlMatch) {
      const date = new Date(urlMatch[1]);
      // Calculate Monday of that week
      const dayOfWeek = date.getDay();
      const monday = new Date(date);
      monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      return {
        weekStart: monday.toISOString().split('T')[0],
        weekEnd: sunday.toISOString().split('T')[0]
      };
    }

    // Look for visible dates in headers
    const headers = document.querySelectorAll('th');
    const datePattern = /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/;
    const foundDates = [];

    headers.forEach(th => {
      const match = th.textContent.match(datePattern);
      if (match) {
        const month = parseInt(match[1]);
        const day = parseInt(match[2]);
        const year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
        foundDates.push(new Date(year, month - 1, day));
      }
    });

    if (foundDates.length >= 2) {
      foundDates.sort((a, b) => a - b);
      return {
        weekStart: foundDates[0].toISOString().split('T')[0],
        weekEnd: foundDates[foundDates.length - 1].toISOString().split('T')[0]
      };
    }

    // Default to current week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      weekStart: monday.toISOString().split('T')[0],
      weekEnd: sunday.toISOString().split('T')[0]
    };
  }

  // Main execution
  try {
    // First try reading from summary table (more reliable for weekly view)
    let entries = readSummaryTable();

    // If summary table is empty, try detail entries
    if (entries.length === 0) {
      const rawEntries = extractEntries();
      entries = aggregateEntries(rawEntries);
    }

    const { weekStart, weekEnd } = getWeekRange();

    return {
      success: true,
      weekStart,
      weekEnd,
      entries,
      totalEntries: entries.length,
      totalHours: entries.reduce((sum, e) => sum + e.totalHours, 0)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}
