// Intervals Basic Inspection Script
// Run via: chrome-devtools evaluate_script
// Returns: dates, dayIndexMap, rowCount, url

() => {
  const dateInputs = document.querySelectorAll('input[data-date]');
  const dates = [];
  const dayIndexMap = {};
  
  dateInputs.forEach(input => {
    const date = input.getAttribute('data-date');
    if (date) {
      const trimmedDate = date.trim();
      const name = input.name;
      const match = name.match(/\[dates\]\[(\d+)\]/);
      
      if (trimmedDate && match && !dayIndexMap[trimmedDate]) {
        dates.push(trimmedDate);
        dayIndexMap[trimmedDate] = parseInt(match[1]);
      }
    }
  });
  
  return {
    dates: dates.sort(),
    dayIndexMap,
    rowCount: document.querySelectorAll('tr[data-project-row]').length,
    url: window.location.href
  };
}
