// UI helper functions

const ui = {
    formatSize(bytes) {
        if (bytes === 0) return '';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
    },

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    getDiffInfo(diffType, left, right) {
        switch (diffType) {
            case 'LeftOnly':
                return { text: 'Only in left', class: 'diff-left-only' };
            case 'RightOnly':
                return { text: 'Only in right', class: 'diff-right-only' };
            case 'LeftNewer':
                const leftDiff = this.getTimeDifference(left.modifiedDate, right.modifiedDate);
                return { text: `Left is newer (${leftDiff})`, class: 'diff-left-newer' };
            case 'RightNewer':
                const rightDiff = this.getTimeDifference(right.modifiedDate, left.modifiedDate);
                return { text: `Right is newer (${rightDiff})`, class: 'diff-right-newer' };
            case 'Different':
                const sizeDiff = this.getSizeDifference(left, right);
                return { text: `Different content${sizeDiff}`, class: 'diff-different' };
            case 'Identical':
            default:
                return { text: 'Identical', class: 'diff-identical' };
        }
    },

    getTimeDifference(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffMs = Math.abs(d1 - d2);
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffDays > 0) return `${diffDays}d`;
        if (diffHours > 0) return `${diffHours}h`;
        return `${diffMins}m`;
    },

    getSizeDifference(left, right) {
        if (!left || !right || left.isDirectory || right.isDirectory) return '';
        const diff = Math.abs(left.size - right.size);
        if (diff === 0) return '';
        return ` (±${this.formatSize(diff)})`;
    },

    getStatusClass(diffType) {
        const classMap = {
            'LeftOnly': 'status-left-only',
            'RightOnly': 'status-right-only',
            'LeftNewer': 'status-left-newer',
            'RightNewer': 'status-right-newer',
            'Different': 'status-different',
            'Identical': 'status-identical'
        };
        return classMap[diffType] || '';
    },

    getDefaultAction(diffType) {
        switch (diffType) {
            case 'LeftOnly': return 'CopyToRight';
            case 'RightOnly': return 'CopyToLeft';
            case 'LeftNewer': return 'CopyToRight';
            case 'RightNewer': return 'CopyToLeft';
            case 'Different': return 'Skip'; // User decides
            default: return 'Skip';
        }
    },

    getActionButtons(diffType) {
        // Always show all buttons, but disable the ones that don't make sense
        const buttons = [
            {
                value: 'Skip',
                icon: 'mdi-minus-circle-outline',
                title: 'Skip',
                cssClass: 'action-skip',
                disabled: false
            },
            {
                value: 'CopyToLeft',
                icon: 'mdi-arrow-left',
                title: 'Copy to left',
                cssClass: 'action-copy-left',
                disabled: diffType === 'LeftOnly' || diffType === 'Identical'
            },
            {
                value: 'CopyToRight',
                icon: 'mdi-arrow-right',
                title: 'Copy to right',
                cssClass: 'action-copy-right',
                disabled: diffType === 'RightOnly' || diffType === 'Identical'
            },
            {
                value: 'Delete',
                icon: 'mdi-delete-outline',
                title: diffType === 'LeftOnly' ? 'Delete left' : diffType === 'RightOnly' ? 'Delete right' : 'Delete',
                cssClass: 'action-delete',
                disabled: diffType !== 'LeftOnly' && diffType !== 'RightOnly',
                actualAction: diffType === 'LeftOnly' ? 'DeleteLeft' : diffType === 'RightOnly' ? 'DeleteRight' : null
            }
        ];

        return buttons;
    },

    createActionButtonGroup(path, defaultAction, buttons) {
        const buttonsHtml = buttons.map(btn => {
            const actionValue = btn.actualAction || btn.value;
            // Check if this button should be active
            let isActive = false;
            if (!btn.disabled) {
                if (btn.actualAction) {
                    // For Delete button with actualAction
                    isActive = btn.actualAction === defaultAction;
                } else {
                    // For regular buttons
                    isActive = btn.value === defaultAction;
                }
            }
            const disabled = btn.disabled ? 'disabled' : '';

            return `
            <button
                class="action-btn ${btn.cssClass} ${isActive ? 'active' : ''}"
                data-action="${actionValue}"
                title="${btn.title}"
                ${disabled}>
                <i class="mdi ${btn.icon}"></i>
            </button>
        `;
        }).join('');

        return `<div class="action-button-group" data-path="${path}">${buttonsHtml}</div>`;
    },

    showProgress(visible) {
        document.getElementById('progressSection').style.display = visible ? 'flex' : 'none';
    },

    updateProgress(percent, message) {
        document.getElementById('progressFill').style.width = percent + '%';
        document.getElementById('progressText').textContent = percent + '%';
        document.getElementById('progressMessage').textContent = message || '';
    },

    showResults(visible) {
        document.getElementById('resultsTable').style.display = visible ? 'table' : 'none';
        document.getElementById('noResults').style.display = visible ? 'none' : 'block';
    },

    enableSync(enabled) {
        document.getElementById('syncBtn').disabled = !enabled;
    },

    createResultRow(item, isFolder = false) {
        const tr = document.createElement('tr');

        // Check if this is a directory item
        const isDirectory = (item.left && item.left.isDirectory) || (item.right && item.right.isDirectory);

        if (isDirectory && isFolder) {
            // This is a folder entry - make it a folder group header with action
            tr.className = 'folder-group-header ' + this.getStatusClass(item.type);
            const diffInfo = this.getDiffInfo(item.type, item.left, item.right);
            const defaultAction = this.getDefaultAction(item.type);
            const actionButtons = this.getActionButtons(item.type);

            tr.dataset.path = item.relativePath;
            tr.dataset.type = item.type;

            tr.innerHTML = `
                <td>
                    <div class="folder-group-title">
                        <span class="folder-icon">📁</span>
                        <span class="folder-path">${item.relativePath}</span>
                        <span class="diff-badge ${diffInfo.class}">${diffInfo.text}</span>
                    </div>
                </td>
                <td class="col-action">
                    ${this.createActionButtonGroup(item.relativePath, defaultAction, actionButtons)}
                </td>
                <td></td>
            `;
        } else {
            // Regular file entry
            tr.className = this.getStatusClass(item.type);
            tr.dataset.path = item.relativePath;
            tr.dataset.type = item.type;

            const diffInfo = this.getDiffInfo(item.type, item.left, item.right);
            const defaultAction = this.getDefaultAction(item.type);
            const actionButtons = this.getActionButtons(item.type);

            tr.innerHTML = `
                <td>
                    ${item.left ? `
                        <div class="file-info">
                            <div class="file-title">
                                <span class="file-name">${item.left.name}</span>
                                <span class="diff-badge ${diffInfo.class}">${diffInfo.text}</span>
                            </div>
                            <span class="file-meta">
                                ${item.left.isDirectory ? 'Folder' : this.formatSize(item.left.size)}
                                ${item.left.modifiedDate ? ' • ' + this.formatDate(item.left.modifiedDate) : ''}
                            </span>
                        </div>
                    ` : '<span class="file-missing"></span>'}
                </td>
                <td class="col-action">
                    ${this.createActionButtonGroup(item.relativePath, defaultAction, actionButtons)}
                </td>
                <td class="col-right">
                    ${item.right ? `
                        <div class="file-info">
                            <div class="file-title">
                                <span class="file-name">${item.right.name}</span>
                                <span class="diff-badge ${diffInfo.class}">${diffInfo.text}</span>
                            </div>
                            <span class="file-meta">
                                ${item.right.isDirectory ? 'Folder' : this.formatSize(item.right.size)}
                                ${item.right.modifiedDate ? ' • ' + this.formatDate(item.right.modifiedDate) : ''}
                            </span>
                        </div>
                    ` : '<span class="file-missing"></span>'}
                </td>
            `;
        }

        return tr;
    },

    createFolderGroupHeader(folderPath) {
        const tr = document.createElement('tr');
        tr.className = 'folder-group-header-plain';
        tr.innerHTML = `
            <td colspan="4">
                <div class="folder-group-title">
                    <span class="folder-icon">📁</span>
                    <span class="folder-path">${folderPath || '(root)'}</span>
                </div>
            </td>
        `;
        return tr;
    }
};
