const socket = io();

// DOM Elements
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const systemStatus = document.getElementById('system-status');
const lastCheck = document.getElementById('last-check');
const productsCount = document.getElementById('products-count');
const ordersToday = document.getElementById('orders-today');
const totalChecks = document.getElementById('total-checks');
const productsList = document.getElementById('products-list');
const activityLog = document.getElementById('activity-log');
const manualCheckBtn = document.getElementById('manual-check-btn');
const addProductBtn = document.getElementById('add-product-btn');
const addProductModal = document.getElementById('add-product-modal');
const autoOrderToggle = document.getElementById('auto-order-toggle');
const maxOrderAmount = document.getElementById('max-order-amount');
const dailyLimit = document.getElementById('daily-limit');
const saveConfigBtn = document.getElementById('save-config-btn');

// State
let currentProducts = [];
let activityItems = [];

// Socket Event Handlers
socket.on('connect', () => {
    updateConnectionStatus('online', 'Connected');
    loadDashboardData();
});

socket.on('disconnect', () => {
    updateConnectionStatus('offline', 'Disconnected');
});

socket.on('check-started', (data) => {
    addActivity(`${data.mode} check started - monitoring ${data.productCount} products`, 'info');
    manualCheckBtn.disabled = true;
    manualCheckBtn.textContent = 'Checking...';
});

socket.on('product-update', (data) => {
    updateProductCard(data);
    const status = data.isInStock ? 'IN STOCK' : 'OUT OF STOCK';
    addActivity(`${data.productName}: ${status}`, data.isInStock ? 'success' : 'info');
});

socket.on('check-completed', (data) => {
    updateStats(data.stats);
    addActivity(`${data.mode} check completed - ${data.results.filter(r => r.isInStock).length} products in stock`, 'info');
    manualCheckBtn.disabled = false;
    manualCheckBtn.textContent = 'Run Manual Check';
});

socket.on('check-error', (data) => {
    addActivity(`Check failed: ${data.error}`, 'error');
    manualCheckBtn.disabled = false;
    manualCheckBtn.textContent = 'Run Manual Check';
});

socket.on('order-success', (data) => {
    addActivity(`Order placed successfully: ${data.product} (Order ID: ${data.orderId})`, 'success');
    loadDashboardData(); // Refresh stats
});

socket.on('order-skipped', (data) => {
    addActivity(`Order skipped for ${data.product}: ${data.reason}`, 'warning');
});

// Functions
function updateConnectionStatus(status, text) {
    statusDot.className = `dot ${status}`;
    statusText.textContent = text;
}

async function loadDashboardData() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        updateStats(data);
        loadProducts();
        loadConfiguration();
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        addActivity('Failed to load dashboard data', 'error');
    }
}

function updateStats(stats) {
    if (stats) {
        systemStatus.textContent = stats.isActive ? 'Active' : 'Inactive';
        productsCount.textContent = stats.productsTracked || 0;
        ordersToday.textContent = stats.orderStats ? stats.orderStats.dailyOrderCount : 0;
        totalChecks.textContent = stats.totalChecks || 0;
        
        if (stats.lastCheck) {
            const checkTime = new Date(stats.lastCheck);
            lastCheck.textContent = `Last check: ${checkTime.toLocaleString()}`;
        }
    }
}

async function loadProducts() {
    // This would typically fetch from an API endpoint
    // For now, we'll show placeholder products
    productsList.innerHTML = `
        <div class="product-card">
            <div class="product-header">
                <div class="product-title">Sample Health Product</div>
                <div class="product-status status-out-of-stock">OUT OF STOCK</div>
            </div>
            <div class="product-details">
                <div class="detail-item">
                    <span class="detail-label">Price</span>
                    <span class="detail-value">$49.99</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Last Check</span>
                    <span class="detail-value">5 min ago</span>
                </div>
            </div>
        </div>
    `;
}

function updateProductCard(productData) {
    // Update specific product card with real-time data
    // This would find and update the specific product card
    console.log('Product update:', productData);
}

async function loadConfiguration() {
    // Load current configuration
    autoOrderToggle.checked = true; // Default values
    maxOrderAmount.value = '500';
    dailyLimit.value = '10';
}

function addActivity(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const activityItem = document.createElement('div');
    activityItem.className = `activity-item activity-${type}`;
    
    activityItem.innerHTML = `
        <div class="activity-message">${message}</div>
        <div class="activity-time">${timestamp}</div>
    `;
    
    activityLog.insertBefore(activityItem, activityLog.firstChild);
    
    // Keep only last 50 items
    const items = activityLog.querySelectorAll('.activity-item');
    if (items.length > 50) {
        items[items.length - 1].remove();
    }
}

// Event Listeners
manualCheckBtn.addEventListener('click', async () => {
    try {
        manualCheckBtn.disabled = true;
        manualCheckBtn.textContent = 'Starting...';
        
        const response = await fetch('/api/manual-check', { method: 'POST' });
        if (!response.ok) {
            throw new Error('Failed to start manual check');
        }
        
        addActivity('Manual check requested', 'info');
    } catch (error) {
        console.error('Manual check failed:', error);
        addActivity('Failed to start manual check', 'error');
        manualCheckBtn.disabled = false;
        manualCheckBtn.textContent = 'Run Manual Check';
    }
});

addProductBtn.addEventListener('click', () => {
    addProductModal.style.display = 'block';
});

document.querySelector('.close').addEventListener('click', () => {
    addProductModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === addProductModal) {
        addProductModal.style.display = 'none';
    }
});

document.getElementById('add-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const productData = {
        name: document.getElementById('product-name').value,
        url: document.getElementById('product-url').value,
        stockSelector: document.getElementById('stock-selector').value,
        maxPrice: parseFloat(document.getElementById('max-price').value) || null
    };
    
    try {
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
        });
        
        if (response.ok) {
            addActivity(`Product added: ${productData.name}`, 'success');
            addProductModal.style.display = 'none';
            document.getElementById('add-product-form').reset();
            loadProducts();
        } else {
            throw new Error('Failed to add product');
        }
    } catch (error) {
        console.error('Failed to add product:', error);
        addActivity('Failed to add product', 'error');
    }
});

saveConfigBtn.addEventListener('click', async () => {
    const config = {
        orders: {
            autoOrderEnabled: autoOrderToggle.checked,
            maxOrderAmount: parseFloat(maxOrderAmount.value) || 500,
            maxDailyOrders: parseInt(dailyLimit.value) || 10
        }
    };
    
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            addActivity('Configuration saved', 'success');
        } else {
            throw new Error('Failed to save configuration');
        }
    } catch (error) {
        console.error('Failed to save configuration:', error);
        addActivity('Failed to save configuration', 'error');
    }
});

function closeModal() {
    addProductModal.style.display = 'none';
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    addActivity('Dashboard initialized', 'info');
});