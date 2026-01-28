// Intervals Work Type Discovery Script
// Run via: chrome-devtools evaluate_script
// Configure PROJECTS_TO_DISCOVER before running
// Returns: { projectName: [workTypes], ... }

async () => {
  // ========== CONFIGURE: Projects not in cache ==========
  const PROJECTS_TO_DISCOVER = [
    // "Drees Maintenance and Support (20240034)",
    // "Some New Project"
  ];
  // ======================================================
  
  if (PROJECTS_TO_DISCOVER.length === 0) {
    return { message: "No projects to discover. Add project names to PROJECTS_TO_DISCOVER array." };
  }
  
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const discovered = {};

  for (const projectTitle of PROJECTS_TO_DISCOVER) {
    const row = document.querySelector('tr[data-project-row="0"]');
    if (!row) {
      discovered[projectTitle] = { error: "No rows found" };
      continue;
    }
    
    const projectCell = row.querySelector('.col-time-multiple-clientproject');
    const wtCell = row.querySelector('.col-time-multiple-worktype');
    
    // Open project dropdown
    projectCell.querySelector('.dropt-header').click();
    await sleep(300);
    
    // Search for project
    const searchInput = projectCell.querySelector('.dropt-search input');
    if (searchInput) {
      searchInput.value = projectTitle.substring(0, 30);
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(300);
    }
    
    // Click the project option
    const option = projectCell.querySelector(`li[title="${projectTitle}"]`);
    if (option) {
      option.click();
      await sleep(500); // Wait for work type dropdown to update
      
      // Open work type dropdown
      wtCell.querySelector('.dropt-header').click();
      await sleep(400);
      
      // Get all work types
      const workTypes = Array.from(wtCell.querySelectorAll('li[title]'))
        .map(li => li.getAttribute('title'))
        .filter(t => t && t !== 'Work type');
      
      // Close dropdown
      document.body.click();
      await sleep(200);
      
      discovered[projectTitle] = workTypes;
    } else {
      discovered[projectTitle] = { error: 'Project not found in dropdown' };
      document.body.click();
      await sleep(200);
    }
  }
  
  return discovered;
}
