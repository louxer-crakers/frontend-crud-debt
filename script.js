/**
 * Project Debt Tracker - Client Side Logic (Phase 5 - Refined Noir)
 * Integration with AWS API Gateway & DynamoDB
 */

const API_CONFIG_KEY = 'project_hutang_api_url';
const API_URL_INPUT = document.getElementById('api-url');
const SAVE_CONFIG_BTN = document.getElementById('save-config');
const DEBT_FORM = document.getElementById('debt-form');
const DEBT_ITEMS_BODY = document.getElementById('debt-items');
const REFRESH_BTN = document.getElementById('btn-refresh');
const SEARCH_BTN = document.getElementById('btn-search');
const CLEAR_SEARCH_BTN = document.getElementById('btn-clear-search');
const SEARCH_INPUT = document.getElementById('search-name');
const FILTER_BTNS = document.querySelectorAll('.filter-btn');

// Modal Elements
const EDIT_MODAL = document.getElementById('edit-modal');
const EDIT_FORM = document.getElementById('edit-form');
const CONFIRM_MODAL = document.getElementById('confirm-modal');

// State
let debts = [];
let currentFilter = 'all';
let refreshInterval = null;
let confirmCallback = null;

// Initialize Config
const savedUrl = localStorage.getItem(API_CONFIG_KEY);
if (savedUrl) {
    API_URL_INPUT.value = savedUrl;
}

// Event Listeners
SAVE_CONFIG_BTN.addEventListener('click', () => {
    const url = API_URL_INPUT.value.trim();
    if (url) {
        localStorage.setItem(API_CONFIG_KEY, url);
        showToast('Configuration Saved!', 'success');
        initDashboard();
    }
});

DEBT_FORM.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = getApiUrl();
    if (!url) return;

    const data = {
        nama: document.getElementById('form-nama').value,
        jumlah: parseFloat(document.getElementById('form-jumlah').value),
        keterangan: document.getElementById('form-ket').value
    };

    try {
        const response = await fetch(`${url}/debt`, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            showToast('Record Created Successfully', 'success');
            DEBT_FORM.reset();
            fetchData();
        } else {
            const err = await response.json();
            showToast(err.error || 'Failed to create', 'error');
        }
    } catch (error) {
        showToast('Request Failed', 'error');
    }
});

EDIT_FORM.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = getApiUrl();
    const id = document.getElementById('edit-id').value;

    const data = {
        nama: document.getElementById('edit-nama').value,
        jumlah: parseFloat(document.getElementById('edit-jumlah').value),
        keterangan: document.getElementById('edit-ket').value,
        status: document.getElementById('edit-status').value
    };

    try {
        const response = await fetch(`${url}/debt/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            showToast('Updated Successfully', 'success');
            closeEditModal();
            fetchData();
        } else {
            const err = await response.json();
            showToast(err.error || 'Update failed', 'error');
        }
    } catch (error) {
        showToast('Update Request Failed', 'error');
    }
});

SEARCH_BTN.addEventListener('click', async () => {
    const name = SEARCH_INPUT.value.trim();
    const url = getApiUrl();
    if (!name || !url) return;

    try {
        const response = await fetch(`${url}/debt/summary/${name}`);
        const data = await response.json();
        
        if (response.ok) {
            debts = data.records;
            renderDebts();
            CLEAR_SEARCH_BTN.style.display = 'flex';
            stopAutoRefresh();
            showToast(`Found ${debts.length} records for ${name}`, 'success');
        } else {
            showToast(data.error || 'Search Error', 'error');
        }
    } catch (e) {
        showToast('Search Failed', 'error');
    }
});

CLEAR_SEARCH_BTN.addEventListener('click', () => {
    SEARCH_INPUT.value = '';
    CLEAR_SEARCH_BTN.style.display = 'none';
    startAutoRefresh();
    fetchData();
});

FILTER_BTNS.forEach(btn => {
    btn.addEventListener('click', () => {
        FILTER_BTNS.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.status;
        fetchData();
    });
});

// Confirmation Modal Listeners
document.getElementById('confirm-ok').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
});
document.getElementById('confirm-cancel').addEventListener('click', closeConfirmModal);

// Functions
async function fetchData() {
    const url = getApiUrl();
    if (!url) return;

    REFRESH_BTN.classList.add('animate-spin');

    try {
        let debtEndpoint = `${url}/debt`;
        if (currentFilter !== 'all') {
            debtEndpoint = `${url}/debt/status/${currentFilter}`;
        }
        
        const debtRes = await fetch(debtEndpoint);
        debts = await debtRes.json();
        renderDebts();

        const statsRes = await fetch(`${url}/debt/stats`);
        const stats = await statsRes.json();
        updateStats(stats);

    } catch (error) {
        console.error('Core sync failed', error);
    } finally {
        setTimeout(() => REFRESH_BTN.classList.remove('animate-spin'), 500);
    }
}

function renderDebts() {
    if (!Array.isArray(debts) || debts.length === 0) {
        DEBT_ITEMS_BODY.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 3rem; color: var(--text-low);">
            <i data-lucide="info" style="margin-bottom: 0.5rem;"></i><br>No records found.
        </td></tr>`;
        lucide.createIcons();
        return;
    }

    DEBT_ITEMS_BODY.innerHTML = debts.map((item, index) => `
        <tr class="debt-row" style="transition-delay: ${index * 50}ms">
            <td style="font-size: 0.8rem; color: var(--text-low)">${new Date(item.tanggal).toLocaleDateString() || '-'}</td>
            <td style="font-weight: 700; color: var(--text-high);">${item.nama}</td>
            <td style="font-weight: 800; font-size: 1.1rem; color: ${item.status === 'Paid' ? 'var(--success)' : 'var(--text-high)'}">
                Rp ${formatNumber(item.jumlah)}
            </td>
            <td style="font-size: 0.85rem; color: var(--text-mid);">${item.keterangan || '-'}</td>
            <td>
                <span class="badge badge-${(item.status || 'Active').toLowerCase()}">${item.status}</span>
            </td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon btn-edit" onclick="openEditModal('${item.id}')" title="Edit">
                        <i data-lucide="edit-3" style="width: 14px;"></i>
                    </button>
                    ${item.status !== 'Paid' ? `
                        <button class="btn-icon btn-settle" onclick="requestSettle('${item.id}')" title="Settle">
                            <i data-lucide="check" style="width: 14px;"></i>
                        </button>
                    ` : `
                        <i data-lucide="shield-check" style="width: 24px; color: var(--secondary); opacity: 0.4; margin-left: 10px;"></i>
                    `}
                </div>
            </td>
        </tr>
    `).join('');
    
    setTimeout(() => {
        document.querySelectorAll('.debt-row').forEach(row => row.classList.add('visible'));
    }, 100);

    lucide.createIcons();
}

async function openEditModal(id) {
    const url = getApiUrl();
    try {
        const res = await fetch(`${url}/debt/${id}`);
        const item = await res.json();
        
        if (res.ok) {
            document.getElementById('edit-id').value = item.id;
            document.getElementById('edit-nama').value = item.nama;
            document.getElementById('edit-jumlah').value = item.jumlah;
            document.getElementById('edit-ket').value = item.keterangan;
            document.getElementById('edit-status').value = item.status || 'Active';
            
            EDIT_MODAL.style.display = 'flex';
            lucide.createIcons();
        }
    } catch (e) {
        showToast('Failed to fetch details', 'error');
    }
}

function closeEditModal() {
    EDIT_MODAL.style.display = 'none';
}

function requestSettle(id) {
    showConfirmModal('Are you sure you want to mark this debt as Paid?', () => {
        markPaid(id);
    });
}

async function markPaid(id) {
    const url = getApiUrl();
    try {
        const response = await fetch(`${url}/debt/${id}`, { method: 'DELETE' });
        if (response.ok) {
            showToast('Record Settled!', 'success');
            fetchData();
        }
    } catch (e) {
        showToast('Settlement Failed', 'error');
    }
}

function updateStats(stats) {
    if (stats.error) return;
    // Map to the correct fields from backend (Phase 2 names)
    const activeVal = stats.total_active || stats.total_aktif || 0;
    const paidVal = stats.total_paid || stats.total_lunas || 0;
    
    document.querySelector('#card-total .value').innerText = `Rp ${formatNumber(activeVal)}`;
    document.querySelector('#card-lunas .value').innerText = `Rp ${formatNumber(paidVal)}`;
}

function showConfirmModal(message, onConfirm) {
    document.getElementById('confirm-message').innerText = message;
    confirmCallback = onConfirm;
    CONFIRM_MODAL.style.display = 'flex';
    lucide.createIcons();
}

function closeConfirmModal() {
    CONFIRM_MODAL.style.display = 'none';
    confirmCallback = null;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = type === 'success' ? 'check-circle' : 'alert-circle';
    toast.innerHTML = `<i data-lucide="${icon}"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num || 0);
}

function getApiUrl() {
    const url = API_URL_INPUT.value.trim().replace(/\/$/, "");
    if (!url) {
        showToast('Please set API URL', 'error');
        return null;
    }
    return url;
}

function startAutoRefresh() {
    stopAutoRefresh();
    refreshInterval = setInterval(fetchData, 30000);
}

function stopAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
}

function initDashboard() {
    window.addEventListener('load', () => {
        setTimeout(() => {
            const splash = document.getElementById('splash');
            if (splash) {
                splash.style.opacity = '0';
                setTimeout(() => splash.style.display = 'none', 800);
            }
        }, 1500);
    });

    if (API_URL_INPUT.value.trim()) {
        fetchData();
        startAutoRefresh();
    }
}

// Global hooks
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.requestSettle = requestSettle;

initDashboard();
