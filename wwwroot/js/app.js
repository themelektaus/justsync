// Main application logic

let currentJobId = null;
let currentJobType = null; // 'compare' or 'sync'
let pollInterval = null;
let browserTarget = null; // 'left' or 'right'
let browserCurrentPath = '';
let compareResults = [];

// LocalStorage keys
const STORAGE_KEYS = {
    LEFT_PATH: 'justsync_left_path',
    RIGHT_PATH: 'justsync_right_path'
};

// Initialize app on load
window.addEventListener('DOMContentLoaded', () => {
    loadSavedPaths();
    setupPathChangeListeners();
});

// Load saved paths from localStorage
function loadSavedPaths() {
    const leftPath = localStorage.getItem(STORAGE_KEYS.LEFT_PATH);
    const rightPath = localStorage.getItem(STORAGE_KEYS.RIGHT_PATH);

    if (leftPath) {
        document.getElementById('leftPath').value = leftPath;
    }

    if (rightPath) {
        document.getElementById('rightPath').value = rightPath;
    }
}

// Save paths to localStorage
function savePaths() {
    const leftPath = document.getElementById('leftPath').value.trim();
    const rightPath = document.getElementById('rightPath').value.trim();

    if (leftPath) {
        localStorage.setItem(STORAGE_KEYS.LEFT_PATH, leftPath);
    }

    if (rightPath) {
        localStorage.setItem(STORAGE_KEYS.RIGHT_PATH, rightPath);
    }
}

// Setup listeners to save paths when they change
function setupPathChangeListeners() {
    const leftPathInput = document.getElementById('leftPath');
    const rightPathInput = document.getElementById('rightPath');

    leftPathInput.addEventListener('blur', savePaths);
    rightPathInput.addEventListener('blur', savePaths);

    // Also save when Enter is pressed
    leftPathInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            savePaths();
        }
    });

    rightPathInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            savePaths();
        }
    });
}

// Browser functions
async function openBrowser(target) {
    browserTarget = target;
    browserCurrentPath = document.getElementById(target + 'Path').value || '';
    document.getElementById('browserModal').style.display = 'flex';
    await loadBrowserContent(browserCurrentPath);
}

function closeBrowser() {
    const modal = document.getElementById('browserModal');
    modal.classList.add('closing');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('closing');
        browserTarget = null;
    }, 200);
}

async function loadBrowserContent(path) {
    try {
        const entries = await api.browse(path);
        browserCurrentPath = path;
        document.getElementById('browserCurrentPath').value = path;

        const list = document.getElementById('browserList');
        list.innerHTML = '';

        entries.forEach(entry => {
            const item = document.createElement('div');
            item.className = 'browser-item' + (entry.isDirectory ? ' directory' : '');
            item.innerHTML = `
                <span class="icon mdi ${entry.isDirectory ? 'mdi-folder' : 'mdi-file-document-outline'}"></span>
                <span class="name">${entry.name}</span>
            `;

            if (entry.isDirectory) {
                item.onclick = () => loadBrowserContent(entry.fullPath);
            }

            list.appendChild(item);
        });
    } catch (error) {
        dialog.error('Error browsing: ' + error.message, 'Browse Error');
    }
}

async function navigateTo(path) {
    await loadBrowserContent(path);
}

async function goUpFolder() {
    if (!browserCurrentPath) {
        // Already at root (drives list)
        return;
    }

    // Check if we're at a drive root (e.g., "C:\")
    const driveRootPattern = /^[A-Za-z]:\\?$/;
    if (driveRootPattern.test(browserCurrentPath)) {
        // Go to drives list (empty path)
        await loadBrowserContent('');
        return;
    }

    // Get parent directory
    const parentPath = browserCurrentPath.replace(/[\\\/][^\\\/]*[\\\/]?$/, '');

    // If parent is empty or just a drive letter, normalize it
    if (!parentPath || /^[A-Za-z]:?$/.test(parentPath)) {
        const driveLetter = browserCurrentPath.match(/^[A-Za-z]:/)?.[0];
        await loadBrowserContent(driveLetter ? driveLetter + '\\' : '');
    } else {
        await loadBrowserContent(parentPath);
    }
}

function selectCurrentFolder() {
    if (browserTarget && browserCurrentPath) {
        document.getElementById(browserTarget + 'Path').value = browserCurrentPath;
        savePaths(); // Save to localStorage
    }
    closeBrowser();
}

// Compare functions
async function startCompare() {
    const leftPath = document.getElementById('leftPath').value.trim();
    const rightPath = document.getElementById('rightPath').value.trim();
    const useChecksum = document.getElementById('useChecksum').checked;

    if (!leftPath || !rightPath) {
        dialog.alert('Please select both folders');
        return;
    }

    try {
        document.getElementById('compareBtn').disabled = true;
        ui.updateProgress(0, 'Starting comparison...');
        ui.showProgress(true);
        ui.showResults(false);
        ui.enableSync(false);

        // Reset folder collapse state
        collapsedFolders.clear();

        const result = await api.startCompare(leftPath, rightPath, useChecksum);
        currentJobId = result.jobId;
        currentJobType = 'compare';

        startPolling();
    } catch (error) {
        dialog.error('Error: ' + error.message, 'Compare Error');
        document.getElementById('compareBtn').disabled = false;
        ui.showProgress(false);
    }
}

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        try {
            let status;
            if (currentJobType === 'compare') {
                status = await api.getCompareStatus(currentJobId);
            } else {
                status = await api.getSyncStatus(currentJobId);
            }

            ui.updateProgress(status.progress, status.message);

            if (status.state === 'Completed') {
                stopPolling();
                if (currentJobType === 'compare') {
                    await loadCompareResults();
                } else {
                    onSyncComplete();
                }
            } else if (status.state === 'Failed') {
                stopPolling();
                dialog.error('Job failed: ' + (status.error || 'Unknown error'), 'Job Failed');
                resetAfterJob();
            } else if (status.state === 'Cancelled') {
                stopPolling();
                resetAfterJob();
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 500);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

async function loadCompareResults() {
    try {
        const result = await api.getCompareResult(currentJobId);
        compareResults = result.results;
        displayResults(compareResults);
        ui.showProgress(false);
        document.getElementById('compareBtn').disabled = false;
    } catch (error) {
        dialog.error('Error loading results: ' + error.message, 'Load Results Error');
        resetAfterJob();
    }
}

function displayResults(results) {
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';

    // Separate folders and files
    const folders = [];
    const files = [];

    results.forEach(item => {
        const isDirectory = (item.left && item.left.isDirectory) || (item.right && item.right.isDirectory);
        if (isDirectory) {
            folders.push(item);
        } else {
            files.push(item);
        }
    });

    // Group files by their parent folder
    const grouped = new Map();
    files.forEach(item => {
        const folder = item.relativePath.includes('\\') || item.relativePath.includes('/')
            ? item.relativePath.substring(0, Math.max(item.relativePath.lastIndexOf('\\'), item.relativePath.lastIndexOf('/')))
            : '';

        if (!grouped.has(folder)) {
            grouped.set(folder, []);
        }
        grouped.get(folder).push(item);
    });

    // Collect all unique folder paths (from grouped files and standalone folders)
    const allFolderPaths = new Set(grouped.keys());
    folders.forEach(f => allFolderPaths.add(f.relativePath));

    // Sort all folders alphabetically
    const sortedFolders = Array.from(allFolderPaths).sort((a, b) => {
        if (a === '' && b !== '') return -1;
        if (a !== '' && b === '') return 1;
        return a.localeCompare(b);
    });

    // Display grouped results
    sortedFolders.forEach(folder => {
        const items = grouped.get(folder) || [];
        const hasChildren = items.length > 0;

        // Check if there's a folder entry that matches this folder path
        const folderEntry = folders.find(f => f.relativePath === folder);

        if (folderEntry) {
            // Use the folder entry as the header with action dropdown
            tbody.appendChild(ui.createResultRow(folderEntry, true, hasChildren));
        } else if (allFolderPaths.size > 1) {
            // Add plain folder header if there are multiple folders
            tbody.appendChild(ui.createFolderGroupHeader(folder, hasChildren));
        }

        // Sort items alphabetically by filename
        if (items.length > 0) {
            const sorted = [...items].sort((a, b) => {
                // Extract filename from path
                const getFilename = (path) => {
                    const parts = path.split(/[\\\/]/);
                    return parts[parts.length - 1].toLowerCase();
                };

                const nameA = getFilename(a.relativePath);
                const nameB = getFilename(b.relativePath);

                return nameA.localeCompare(nameB);
            });

            // Add file items
            sorted.forEach(item => {
                tbody.appendChild(ui.createResultRow(item, false));
            });
        }
    });

    ui.showResults(results.length > 0);
    updateSyncButton();
}

function resetAfterJob() {
    ui.showProgress(false);
    document.getElementById('compareBtn').disabled = false;
    document.getElementById('syncBtn').disabled = true;
    currentJobId = null;
    currentJobType = null;
}

// Sync functions
async function startSync() {
    const actions = getSelectedActions();

    if (actions.length === 0) {
        dialog.alert('No items selected for sync');
        return;
    }

    const confirmed = await dialog.confirm(`Sync ${actions.length} items?`, 'Confirm Sync');
    if (!confirmed) {
        return;
    }

    try {
        document.getElementById('syncBtn').disabled = true;
        ui.updateProgress(0, 'Starting sync...');
        ui.showProgress(true);

        const result = await api.startSync(currentJobId, actions);
        currentJobId = result.jobId;
        currentJobType = 'sync';

        startPolling();
    } catch (error) {
        dialog.error('Error: ' + error.message, 'Sync Error');
        ui.showProgress(false);
        document.getElementById('syncBtn').disabled = false;
    }
}

function setAction(path, action) {
    const pathsToUpdate = [path];

    // Check if this is a folder - if so, find all children recursively
    const resultItem = compareResults.find(r => r.relativePath === path);
    if (resultItem && ((resultItem.left && resultItem.left.isDirectory) || (resultItem.right && resultItem.right.isDirectory))) {
        // This is a folder - find all children (files and subfolders)
        compareResults.forEach(item => {
            const itemPath = item.relativePath;
            // Check if this item is a child of the folder (starts with folder path + separator)
            if (itemPath !== path && (itemPath.startsWith(path + '\\') || itemPath.startsWith(path + '/'))) {
                pathsToUpdate.push(itemPath);
            }
        });
    }

    // Update all paths (folder and all children)
    pathsToUpdate.forEach(pathToUpdate => {
        const buttonGroups = document.querySelectorAll('.action-button-group');
        let buttonGroup = null;

        for (const group of buttonGroups) {
            if (group.dataset.path === pathToUpdate) {
                buttonGroup = group;
                break;
            }
        }

        if (!buttonGroup) {
            return;
        }

        // Remove active class from all buttons in this group
        buttonGroup.querySelectorAll('.action-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to the clicked button if not disabled
        const buttons = buttonGroup.querySelectorAll('.action-btn');
        for (const btn of buttons) {
            if (btn.dataset.action === action && !btn.disabled) {
                btn.classList.add('active');
                break;
            }
        }
    });

    updateSyncButton();
}

function getSelectedActions() {
    const actions = [];
    const buttonGroups = document.querySelectorAll('.action-button-group');

    buttonGroups.forEach(group => {
        const activeBtn = group.querySelector('.action-btn.active');
        if (activeBtn) {
            const action = activeBtn.dataset.action;
            const path = group.dataset.path;

            if (action && action !== 'Skip') {
                actions.push({
                    relativePath: path,
                    action: action
                });
            }
        }
    });

    return actions;
}

function onSyncComplete() {
    ui.showProgress(false);
    dialog.success('Sync completed successfully!');

    // Refresh comparison
    startCompare();
}

async function cancelJob() {
    if (!currentJobId) return;

    try {
        if (currentJobType === 'compare') {
            await api.cancelCompare(currentJobId);
        } else {
            await api.cancelSync(currentJobId);
        }
    } catch (error) {
        console.error('Cancel error:', error);
    }
}

// UI event handlers
function updateSyncButton() {
    const actions = getSelectedActions();
    ui.enableSync(actions.length > 0);
}

// Folder collapse state
const collapsedFolders = new Set();

function toggleFolder(folderPath) {
    const isCurrentlyCollapsed = collapsedFolders.has(folderPath);
    const willBeCollapsed = !isCurrentlyCollapsed;

    if (willBeCollapsed) {
        collapsedFolders.add(folderPath);
    } else {
        collapsedFolders.delete(folderPath);
    }

    const tbody = document.getElementById('resultsBody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    // Find the folder header row
    const folderHeaderIndex = rows.findIndex(row =>
        row.dataset.path === folderPath &&
        (row.classList.contains('folder-group-header') || row.classList.contains('folder-group-header-plain'))
    );

    if (folderHeaderIndex === -1) return;

    const folderHeaderRow = rows[folderHeaderIndex];

    // Toggle the chevron icon
    const toggle = folderHeaderRow.querySelector('.folder-toggle');
    if (toggle) {
        if (willBeCollapsed) {
            toggle.classList.add('collapsed');
        } else {
            toggle.classList.remove('collapsed');
        }
    }

    // Hide/show all file rows after this folder header until the next folder header
    for (let i = folderHeaderIndex + 1; i < rows.length; i++) {
        const row = rows[i];

        // Check if this is a folder header - if yes, stop here
        const isRowAFolderHeader = row.classList.contains('folder-group-header') ||
                                    row.classList.contains('folder-group-header-plain');

        if (isRowAFolderHeader) {
            // Stop - we've reached the next group (could be subfolder or sibling)
            break;
        }

        // Toggle visibility of file rows
        row.style.display = willBeCollapsed ? 'none' : '';
    }
}

// Event delegation for action buttons
document.getElementById('resultsBody').addEventListener('click', (e) => {
    const button = e.target.closest('.action-btn');
    if (!button || button.disabled) return;

    const action = button.dataset.action;
    const buttonGroup = button.closest('.action-button-group');
    if (!buttonGroup) return;

    const path = buttonGroup.dataset.path;
    setAction(path, action);
});

// Event delegation for folder toggles
document.getElementById('resultsBody').addEventListener('click', (e) => {
    const toggle = e.target.closest('.folder-toggle');
    if (!toggle) return;

    const folderPath = toggle.dataset.folderPath;

    // Check if Shift or Alt key is pressed
    if (e.ctrlKey || e.shiftKey || e.altKey) {
        toggleAllFolders();
    } else {
        toggleFolder(folderPath);
    }
});

function toggleAllFolders() {
    // Get all folder paths from compareResults (includes hidden folders)
    const allFolderPaths = new Set();

    compareResults.forEach(item => {
        const isDirectory = (item.left && item.left.isDirectory) || (item.right && item.right.isDirectory);
        if (isDirectory) {
            allFolderPaths.add(item.relativePath);
        }
    });

    // Also get folder paths from grouped file results
    compareResults.forEach(item => {
        const isDirectory = (item.left && item.left.isDirectory) || (item.right && item.right.isDirectory);
        if (!isDirectory) {
            const folder = item.relativePath.includes('\\') || item.relativePath.includes('/')
                ? item.relativePath.substring(0, Math.max(item.relativePath.lastIndexOf('\\'), item.relativePath.lastIndexOf('/')))
                : '';
            allFolderPaths.add(folder);
        }
    });

    // Check if all folders are currently collapsed
    const allCollapsed = Array.from(allFolderPaths).every(folderPath => {
        return collapsedFolders.has(folderPath);
    });

    // Toggle all folders
    allFolderPaths.forEach(folderPath => {
        if (allCollapsed) {
            // Expand all
            if (collapsedFolders.has(folderPath)) {
                toggleFolder(folderPath);
            }
        } else {
            // Collapse all
            if (!collapsedFolders.has(folderPath)) {
                toggleFolder(folderPath);
            }
        }
    });
}

// Ignore editor functions
async function openIgnoreEditor() {
    const leftPath = document.getElementById('leftPath').value.trim();
    const rightPath = document.getElementById('rightPath').value.trim();

    if (!leftPath || !rightPath) {
        dialog.alert('Please select both folders first');
        return;
    }

    try {
        const result = await api.getIgnorePatterns(leftPath, rightPath);

        document.getElementById('ignorePatternsText').value =
            result.patterns.join('\n');
        document.getElementById('ignoreEditorModal').style.display = 'flex';

        // Log source info
        const sources = [];
        if (result.leftSourceFile) sources.push('left');
        if (result.rightSourceFile) sources.push('right');
        if (sources.length > 0) {
            console.log(`Loaded patterns from ${sources.join(' and ')} folder(s)`);
        }
    } catch (error) {
        dialog.error('Error loading patterns: ' + error.message, 'Load Error');
    }
}

function closeIgnoreEditor() {
    const modal = document.getElementById('ignoreEditorModal');
    modal.classList.add('closing');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('closing');
    }, 200);
}

async function saveIgnorePatterns(side) {
    const leftPath = document.getElementById('leftPath').value.trim();
    const rightPath = document.getElementById('rightPath').value.trim();
    const targetPath = side === 'left' ? leftPath : rightPath;
    const text = document.getElementById('ignorePatternsText').value;
    const patterns = text.split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

    try {
        await api.saveIgnorePatterns(targetPath, patterns);
        closeIgnoreEditor();
        const sideName = side === 'left' ? 'left' : 'right';
        dialog.success(`Patterns saved to ${sideName} folder.\nRun Compare to apply changes.`);
    } catch (error) {
        dialog.error('Error saving patterns: ' + error.message, 'Save Error');
    }
}
