/**
 * Project Debt Tracker - Client Side Logic
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

// State
let debts = [];
let currentFilter = 'all';
let refreshInterval = null;

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
        alert('API Config Saved!');
        initDashboard();
    }
});

DEBT_FORM.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = API_URL_INPUT.value.trim();
    if (!url) return alert('Please set API URL first!');

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
            DEBT_FORM.reset();
            fetchData();
        } else {
            const err = await response.json();
            alert(`Error: ${err.error || 'Failed to save'}`);
        }
    } catch (error) {
        alert(`Request failed: ${error.message}`);
    }
});

REFRESH_BTN.addEventListener('click', fetchData);

SEARCH_BTN.addEventListener('click', async () => {
    const name = SEARCH_INPUT.value.trim();
    const url = API_URL_INPUT.value.trim();
    if (!name || !url) return;

    try {
        const response = await fetch(`${url}/debt/summary/${name}`);
        const data = await response.json();
        
        if (response.ok) {
            debts = data.records;
            renderDebts();
            CLEAR_SEARCH_BTN.style.display = 'flex';
            stopAutoRefresh();
        } else {
            alert(data.error);
        }
    } catch (e) {
        alert('Search failed');
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

// Functions
async function fetchData() {
    const url = API_URL_INPUT.value.trim().replace(/\/$/, "");
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
    if (!Array.isArray(debts)) {
        DEBT_ITEMS_BODY.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No records found or API error.</td></tr>';
        return;
    }

    DEBT_ITEMS_BODY.innerHTML = debts.map(item => `
        <tr class="debt-row">
            <td style="font-size: 0.8rem; color: var(--text-muted)">${new Date(item.tanggal).toLocaleDateString() || '-'}</td>
            <td style="font-weight: 600">${item.nama}</td>
            <td style="font-weight: 700; color: ${item.status === 'Paid' ? 'var(--success)' : 'var(--text-main)'}">
                Rp ${formatNumber(item.jumlah)}
            </td>
            <td style="font-size: 0.9rem">${item.keterangan || '-'}</td>
            <td>
                <span class="badge badge-${(item.status || 'Active').toLowerCase()}">${item.status}</span>
            </td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    ${item.status !== 'Paid' ? `
                        <button class="btn-icon" onclick="markPaid('${item.id}')" title="Mark as Paid">
                            <i data-lucide="check-circle" style="width: 16px;"></i>
                        </button>
                    ` : '<i data-lucide="check" style="width: 16px; color: var(--success); opacity: 0.5"></i>'}
                </div>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

async function markPaid(id) {
    const url = API_URL_INPUT.value.trim().replace(/\/$/, "");
    try {
        const response = await fetch(`${url}/debt/${id}`, { method: 'DELETE' });
        if (response.ok) fetchData();
    } catch (e) {
        alert('Failed to update status');
    }
}

function updateStats(stats) {
    if (stats.error) return;
    
    document.querySelector('#card-total .value').innerText = `Rp ${formatNumber(stats.total_active)}`;
    document.querySelector('#card-lunas .value').innerText = `Rp ${formatNumber(stats.total_paid)}`;
}

function formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num || 0);
}

function startAutoRefresh() {
    stopAutoRefresh();
    refreshInterval = setInterval(fetchData, 30000);
}

function stopAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
}

function initDashboard() {
    if (API_URL_INPUT.value.trim()) {
        fetchData();
        startAutoRefresh();
    }
}

window.markPaid = markPaid;
initDashboard();
