// FreshBooks Fill Entry Script
// Run via: chrome-devtools evaluate_script
// Fills one row in FreshBooks week view

async () => {
  // ============================================================
  // CONFIGURATION - Claude fills this from mapped entry
  // ============================================================

  const ENTRY = {
    client: "Technomic",        // FreshBooks client name
    service: "Development",     // FreshBooks service name
    // Hours per day (FreshBooks uses Sun-Sat order)
    hours: { sun: 0, mon: 4, tue: 6, wed: 5, thu: 4, fri: 3, sat: 0 }
  };

  // ============================================================
  // AUTOMATION FUNCTIONS - Do not modify
  // ============================================================

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Click the "New Row" button to add a new time entry row
  async function clickNewRow() {
    // Look for the "New Row" button - various possible selectors
    const selectors = [
      'button[data-testid="new-row"]',
      'button[data-testid="add-row"]',
      '.new-row-button',
      '.add-row-button',
      'button:has-text("New Row")',
      '[role="button"][aria-label*="new row" i]',
      '[role="button"][aria-label*="add row" i]'
    ];

    let button = null;
    for (const sel of selectors) {
      try {
        button = document.querySelector(sel);
        if (button) break;
      } catch (e) {
        // :has-text not supported, try text content search
      }
    }

    // Fallback: find by text content
    if (!button) {
      const buttons = document.querySelectorAll('button, [role="button"]');
      for (const btn of buttons) {
        const text = btn.textContent.toLowerCase();
        if (text.includes('new row') || text.includes('add row') || text === '+') {
          button = btn;
          break;
        }
      }
    }

    if (!button) {
      return { success: false, error: 'New Row button not found' };
    }

    button.click();
    await sleep(500);
    return { success: true };
  }

  // Select from a combobox/dropdown
  async function selectComboboxOption(combobox, searchText) {
    // FreshBooks uses searchable comboboxes
    // 1. Click to open
    // 2. Type to filter
    // 3. Click matching option

    // Find the input field in the combobox
    const input = combobox.querySelector('input') || combobox;

    // Focus and clear
    input.focus();
    input.value = '';
    await sleep(100);

    // Type the search text
    input.value = searchText;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(400); // Wait for search/filter

    // Find the dropdown/listbox
    const listbox = document.querySelector(
      '[role="listbox"], .dropdown-menu, .combobox-options, [class*="dropdown"], [class*="options"]'
    );

    if (!listbox) {
      return { success: false, error: 'Dropdown not found' };
    }

    // Find matching option
    const options = listbox.querySelectorAll('[role="option"], li, .option, [class*="option"]');
    let matchedOption = null;

    for (const opt of options) {
      const text = opt.textContent.toLowerCase();
      if (text.includes(searchText.toLowerCase())) {
        matchedOption = opt;
        break;
      }
    }

    // Also try exact match
    if (!matchedOption) {
      for (const opt of options) {
        const text = opt.textContent.trim().toLowerCase();
        if (text === searchText.toLowerCase()) {
          matchedOption = opt;
          break;
        }
      }
    }

    if (!matchedOption && options.length > 0) {
      // Take first option if it looks reasonable
      matchedOption = options[0];
    }

    if (!matchedOption) {
      return { success: false, error: `Option "${searchText}" not found` };
    }

    matchedOption.click();
    await sleep(300);
    return { success: true };
  }

  // Find the newly created row (usually the last one without client selected)
  function findNewRow() {
    // Look for rows in the timesheet
    const rows = document.querySelectorAll(
      'tr[data-testid*="time"], .time-entry-row, [class*="timesheet-row"], tbody tr'
    );

    // Find the most recently added row (usually has empty or placeholder client)
    for (const row of Array.from(rows).reverse()) {
      const clientCell = row.querySelector('[data-testid*="client"], .client-cell, td:first-child');
      if (clientCell) {
        const text = clientCell.textContent.trim().toLowerCase();
        if (!text || text.includes('select') || text.includes('choose') || text.includes('client')) {
          return row;
        }
      }
    }

    // Return last row as fallback
    return rows[rows.length - 1];
  }

  // Select client in a row
  async function selectClient(row, clientName) {
    // Find client combobox/dropdown in the row
    const clientCell = row.querySelector(
      '[data-testid*="client"], .client-cell, .client-select, td:first-child'
    );

    if (!clientCell) {
      return { success: false, error: 'Client cell not found' };
    }

    // Click to activate
    clientCell.click();
    await sleep(300);

    return await selectComboboxOption(clientCell, clientName);
  }

  // Select service in a row
  async function selectService(row, serviceName) {
    // Find service combobox/dropdown in the row
    const serviceCell = row.querySelector(
      '[data-testid*="service"], .service-cell, .service-select, td:nth-child(2)'
    );

    if (!serviceCell) {
      return { success: false, error: 'Service cell not found' };
    }

    // Click to activate
    serviceCell.click();
    await sleep(300);

    return await selectComboboxOption(serviceCell, serviceName);
  }

  // Save the row (click checkmark/confirm button)
  async function saveRow(row) {
    // Look for save/confirm button in the row
    const saveBtn = row.querySelector(
      'button[data-testid*="save"], button[data-testid*="confirm"], ' +
      '.save-button, .confirm-button, button[aria-label*="save" i], ' +
      'button[aria-label*="confirm" i], button svg[class*="check"]'
    );

    if (saveBtn) {
      const btn = saveBtn.closest('button') || saveBtn;
      btn.click();
      await sleep(500);
      return { success: true };
    }

    // Try looking for green checkmark icon
    const checkIcons = row.querySelectorAll('button svg, button i');
    for (const icon of checkIcons) {
      const parent = icon.closest('button');
      if (parent && (icon.classList.toString().includes('check') ||
          parent.classList.toString().includes('confirm') ||
          parent.classList.toString().includes('save'))) {
        parent.click();
        await sleep(500);
        return { success: true };
      }
    }

    // Row might auto-save
    return { success: true, note: 'No explicit save button found' };
  }

  // Fill hours for each day
  async function fillHours(row, hours) {
    // FreshBooks week view: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
    const dayOrder = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    const results = [];

    for (let i = 0; i < dayOrder.length; i++) {
      const day = dayOrder[i];
      const hoursValue = hours[day];

      if (!hoursValue || hoursValue === 0) continue;

      // Find the hour input for this day (0-indexed)
      const hourInputs = row.querySelectorAll('input[type="text"], input[type="number"]');

      // Try to find by index (after client/service columns)
      // Typically: [client-search] [service-search] [sun] [mon] [tue] [wed] [thu] [fri] [sat]
      // Or the inputs might be just the day inputs

      let input = null;

      // Try data attributes
      input = row.querySelector(`input[data-day="${i}"], input[data-day="${day}"]`);

      // Try by index - usually starts at index 0 or 2 (after client/service)
      if (!input && hourInputs.length >= 7) {
        // If we have 7+ inputs, they're probably the day inputs
        input = hourInputs[i];
      }

      // Try finding by aria-label or name
      if (!input) {
        input = row.querySelector(`input[aria-label*="${day}" i], input[name*="${day}" i]`);
      }

      if (!input) {
        results.push({ day, success: false, error: 'Input not found' });
        continue;
      }

      // Fill the value
      input.focus();
      await sleep(100);

      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(input, hoursValue.toString());
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));

      await sleep(150);
      results.push({ day, success: true, value: hoursValue });
    }

    return results;
  }

  // ============================================================
  // MAIN EXECUTION
  // ============================================================

  try {
    const result = {
      client: ENTRY.client,
      service: ENTRY.service,
      steps: []
    };

    // Step 1: Click New Row
    const newRowResult = await clickNewRow();
    result.steps.push({ step: 'clickNewRow', ...newRowResult });
    if (!newRowResult.success) {
      return { success: false, ...result };
    }

    // Step 2: Find the new row
    const row = findNewRow();
    if (!row) {
      result.steps.push({ step: 'findNewRow', success: false, error: 'New row not found' });
      return { success: false, ...result };
    }
    result.steps.push({ step: 'findNewRow', success: true });

    // Step 3: Select client
    const clientResult = await selectClient(row, ENTRY.client);
    result.steps.push({ step: 'selectClient', ...clientResult });
    if (!clientResult.success) {
      return { success: false, ...result };
    }

    // Step 4: Select service
    const serviceResult = await selectService(row, ENTRY.service);
    result.steps.push({ step: 'selectService', ...serviceResult });
    if (!serviceResult.success) {
      return { success: false, ...result };
    }

    // Step 5: Save the row
    const saveResult = await saveRow(row);
    result.steps.push({ step: 'saveRow', ...saveResult });

    // Step 6: Fill hours
    await sleep(300); // Wait for row to be in edit mode
    const hoursResults = await fillHours(row, ENTRY.hours);
    result.steps.push({ step: 'fillHours', results: hoursResults });

    // Calculate total hours filled
    const totalHours = Object.values(ENTRY.hours).reduce((a, b) => a + b, 0);

    result.success = true;
    result.totalHours = totalHours;
    result.message = `Created row for ${ENTRY.client}/${ENTRY.service} with ${totalHours}h`;

    return result;

  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}
