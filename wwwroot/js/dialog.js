// Dialog system to replace alert(), confirm(), and other native dialogs

const dialog = {
    /**
     * Show an alert dialog
     * @param {string} message - The message to display
     * @param {string} title - Optional title (default: 'Alert')
     * @returns {Promise<void>}
     */
    alert(message, title = 'Alert') {
        return this._showDialog({
            title,
            message,
            type: 'alert',
            showCancel: false,
            confirmText: 'OK'
        });
    },

    /**
     * Show an error dialog
     * @param {string} message - The error message to display
     * @param {string} title - Optional title (default: 'Error')
     * @returns {Promise<void>}
     */
    error(message, title = 'Error') {
        return this._showDialog({
            title,
            message,
            type: 'error',
            showCancel: false,
            confirmText: 'OK'
        });
    },

    /**
     * Show a success dialog
     * @param {string} message - The success message to display
     * @param {string} title - Optional title (default: 'Success')
     * @returns {Promise<void>}
     */
    success(message, title = 'Success') {
        return this._showDialog({
            title,
            message,
            type: 'success',
            showCancel: false,
            confirmText: 'OK'
        });
    },

    /**
     * Show a confirmation dialog
     * @param {string} message - The message to display
     * @param {string} title - Optional title (default: 'Confirm')
     * @returns {Promise<boolean>} - true if confirmed, false if cancelled
     */
    confirm(message, title = 'Confirm') {
        return this._showDialog({
            title,
            message,
            type: 'warning',
            showCancel: true,
            confirmText: 'OK',
            cancelText: 'Cancel'
        });
    },

    /**
     * Internal method to show a dialog
     * @private
     */
    _showDialog(options) {
        return new Promise((resolve) => {
            const modal = document.getElementById('dialogModal');
            const modalContent = modal.querySelector('.modal-content');
            const titleEl = document.getElementById('dialogTitle');
            const messageEl = document.getElementById('dialogMessage');
            const confirmBtn = document.getElementById('dialogConfirmBtn');
            const cancelBtn = document.getElementById('dialogCancelBtn');

            // Set content
            titleEl.textContent = options.title;
            messageEl.textContent = options.message;
            confirmBtn.textContent = options.confirmText || 'OK';
            cancelBtn.textContent = options.cancelText || 'Cancel';

            // Set type class
            modalContent.className = 'modal-content dialog-modal';
            if (options.type) {
                modalContent.classList.add(`dialog-${options.type}`);
            }

            // Show/hide cancel button
            if (options.showCancel) {
                cancelBtn.style.display = 'block';
            } else {
                cancelBtn.style.display = 'none';
            }

            // Event handlers
            const onConfirm = () => {
                cleanup();
                resolve(true);
            };

            const onCancel = () => {
                cleanup();
                resolve(false);
            };

            const onEscape = (e) => {
                if (e.key === 'Escape') {
                    onCancel();
                }
            };

            const onBackdropClick = (e) => {
                if (e.target === modal) {
                    onCancel();
                }
            };

            const cleanup = () => {
                modal.style.display = 'none';
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                document.removeEventListener('keydown', onEscape);
                modal.removeEventListener('click', onBackdropClick);
            };

            // Attach event handlers
            confirmBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
            document.addEventListener('keydown', onEscape);
            modal.addEventListener('click', onBackdropClick);

            // Show modal
            modal.style.display = 'flex';

            // Focus confirm button
            setTimeout(() => confirmBtn.focus(), 100);
        });
    }
};

// Override native dialogs (optional)
// Uncomment these if you want to completely replace native dialogs
// window.alert = (message) => dialog.alert(String(message));
// window.confirm = (message) => dialog.confirm(String(message));
