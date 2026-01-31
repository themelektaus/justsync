// Main application logic

let currentJobId = null;
let currentJobType = null; // 'compare' or 'sync'
let pollInterval = null;
let browserTarget = null; // 'left' or 'right'
let browserCurrentPath = '';
let compareResults = [];

// Browser functions
async function openBrowser(target) {
    browserTarget = target;
    browserCurrentPath = document.getElementById(target + 'Path').value || '';
    document.getElementById('browserModal').style.display = 'flex';
    await loadBrowserContent(browserCurrentPath);
}

function closeBrowser() {
    document.getElementById('browserModal').style.display = 'none';
    browserTarget = null;
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
                <span class="icon">${entry.isDirectory ? '📁' : '📄'}</span>
                <span class="name">${entry.name}</span>
            `;

            if (entry.isDirectory) {
                item.onclick = () => loadBrowserContent(entry.fullPath);
            }

            list.appendChild(item);
        });
    } catch (error) {
        alert('Error browsing: ' + error.message);
    }
}

async function navigateTo(path) {
    await loadBrowserContent(path);
}

function selectCurrentFolder() {
    if (browserTarget && browserCurrentPath) {
        document.getElementById(browserTarget + 'Path').value = browserCurrentPath;
    }
    closeBrowser();
}

// Compare functions
async function startCompare() {
    const leftPath = document.getElementById('leftPath').value.trim();
    const rightPath = document.getElementById('rightPath').value.trim();
    const useChecksum = document.getElementById('useChecksum').checked;

    if (!leftPath || !rightPath) {
        alert('Please select both folders');
        return;
    }

    try {
        document.getElementById('compareBtn').disabled = true;
        ui.showProgress(true);
        ui.showResults(false);
        ui.enableSync(false);

        const result = await api.startCompare(leftPath, rightPath, useChecksum);
        currentJobId = result.jobId;
        currentJobType = 'compare';

        startPolling();
    } catch (error) {
        alert('Error: ' + error.message);
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
                alert('Job failed: ' + (status.error || 'Unknown error'));
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
        alert('Error loading results: ' + error.message);
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

    // Sort folders
    const sortedFolders = Array.from(grouped.keys()).sort((a, b) => {
        if (a === '' && b !== '') return -1;
        if (a !== '' && b === '') return 1;
        return a.localeCompare(b);
    });

    // Display grouped results
    sortedFolders.forEach(folder => {
        const items = grouped.get(folder);

        // Check if there's a folder entry that matches this folder path
        const folderEntry = folders.find(f => f.relativePath === folder);

        if (folderEntry) {
            // Use the folder entry as the header with action dropdown
            tbody.appendChild(ui.createResultRow(folderEntry, true));
        } else if (grouped.size > 1) {
            // Add plain folder header if there are multiple folders
            tbody.appendChild(ui.createFolderGroupHeader(folder));
        }

        // Sort items: differences first, then identical
        const sorted = [...items].sort((a, b) => {
            if (a.type === 'Identical' && b.type !== 'Identical') return 1;
            if (a.type !== 'Identical' && b.type === 'Identical') return -1;
            return a.relativePath.localeCompare(b.relativePath);
        });

        // Add file items
        sorted.forEach(item => {
            tbody.appendChild(ui.createResultRow(item, false));
        });
    });

    // Add standalone folders (folders without files in them in the results)
    const displayedFolders = new Set(sortedFolders);
    folders.forEach(folderItem => {
        if (!displayedFolders.has(folderItem.relativePath)) {
            tbody.appendChild(ui.createResultRow(folderItem, true));
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
        alert('No items selected for sync');
        return;
    }

    if (!confirm(`Sync ${actions.length} items?`)) {
        return;
    }

    try {
        document.getElementById('syncBtn').disabled = true;
        ui.showProgress(true);

        const result = await api.startSync(currentJobId, actions);
        currentJobId = result.jobId;
        currentJobType = 'sync';

        startPolling();
    } catch (error) {
        alert('Error: ' + error.message);
        ui.showProgress(false);
        document.getElementById('syncBtn').disabled = false;
    }
}

function setAction(path, action) {
    // Find the button group for this path using a safer approach
    const buttonGroups = document.querySelectorAll('.action-button-group');
    let buttonGroup = null;

    for (const group of buttonGroups) {
        if (group.dataset.path === path) {
            buttonGroup = group;
            break;
        }
    }

    if (!buttonGroup) {
        console.error('Button group not found for path:', path);
        return;
    }

    // Remove active class from all buttons in this group
    buttonGroup.querySelectorAll('.action-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Add active class to the clicked button
    const buttons = buttonGroup.querySelectorAll('.action-btn');
    for (const btn of buttons) {
        if (btn.dataset.action === action && !btn.disabled) {
            btn.classList.add('active');
            break;
        }
    }

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
    alert('Sync completed successfully!');

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
