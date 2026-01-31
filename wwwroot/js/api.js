// API communication module

const API_BASE = '/api';

const api = {
    async browse(path = '') {
        const url = path
            ? `${API_BASE}/folders/browse?path=${encodeURIComponent(path)}`
            : `${API_BASE}/folders/browse`;
        const response = await fetch(url);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Browse failed');
        }
        return response.json();
    },

    async validatePath(path) {
        const response = await fetch(`${API_BASE}/folders/validate?path=${encodeURIComponent(path)}`);
        return response.json();
    },

    async startCompare(leftPath, rightPath, useChecksum) {
        const response = await fetch(`${API_BASE}/compare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leftPath, rightPath, useChecksum })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Compare failed');
        }
        return response.json();
    },

    async getCompareStatus(jobId) {
        const response = await fetch(`${API_BASE}/compare/${jobId}/status`);
        return response.json();
    },

    async getCompareResult(jobId) {
        const response = await fetch(`${API_BASE}/compare/${jobId}/result`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get results');
        }
        return response.json();
    },

    async cancelCompare(jobId) {
        const response = await fetch(`${API_BASE}/compare/${jobId}/cancel`, { method: 'POST' });
        return response.json();
    },

    async startSync(compareJobId, actions) {
        const response = await fetch(`${API_BASE}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ compareJobId, actions })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Sync failed');
        }
        return response.json();
    },

    async getSyncStatus(jobId) {
        const response = await fetch(`${API_BASE}/sync/${jobId}/status`);
        return response.json();
    },

    async cancelSync(jobId) {
        const response = await fetch(`${API_BASE}/sync/${jobId}/cancel`, { method: 'POST' });
        return response.json();
    }
};
