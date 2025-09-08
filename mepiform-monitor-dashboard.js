const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs').promises;
const EventEmitter = require('events');

class MepiformMonitorDashboard extends EventEmitter {
    constructor(port = 3000) {
        super();
        this.port = port;
        this.app = express();
        this.server = null;
        this.wss = null;
        this.dashboardData = {
            systemStatus: 'idle',
            lastUpdate: new Date(),
            todaysOrders: [],
            productStatus: {
                product1: { status: 'unknown', lastCheck: null, dailyOrders: 0 },
                product2: { status: 'unknown', lastCheck: null, dailyOrders: 0, dailyTotal: 0 }
            },
            alerts: [],
            stats: {
                totalOrdersToday: 0,
                totalUnitsToday: 0,
                successRate: 100
            }
        };
    }

    async initialize() {
        this.setupExpress();
        this.setupWebSocket();
        await this.loadDailyData();
        
        this.server = this.app.listen(this.port, () => {
            console.log(`📊 Dashboard running at http://localhost:${this.port}`);
        });

        // Handle WebSocket upgrade on same server
        this.server.on('upgrade', (request, socket, head) => {
            this.wss.handleUpgrade(request, socket, head, (websocket) => {
                this.wss.emit('connection', websocket, request);
            });
        });
    }

    setupExpress() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, 'public')));

        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'dashboard.html'));
        });

        this.app.get('/api/status', (req, res) => {
            res.json(this.dashboardData);
        });

        this.app.get('/api/orders/today', async (req, res) => {
            const orders = await this.getTodaysOrders();
            res.json(orders);
        });

        this.app.post('/api/alerts/dismiss', (req, res) => {
            const { alertId } = req.body;
            this.dashboardData.alerts = this.dashboardData.alerts.filter(a => a.id !== alertId);
            this.broadcastUpdate();
            res.json({ success: true });
        });
    }

    setupWebSocket() {
        // In Heroku, use the same server for WebSocket instead of separate port
        this.wss = new WebSocket.Server({ noServer: true });
        
        this.wss.on('connection', (ws) => {
            console.log('📱 Dashboard client connected');
            
            ws.send(JSON.stringify({
                type: 'initial',
                data: this.dashboardData
            }));

            ws.on('close', () => {
                console.log('📱 Dashboard client disconnected');
            });
        });
    }

    async loadDailyData() {
        try {
            const statePath = path.join(__dirname, 'daily-state.json');
            const data = await fs.readFile(statePath, 'utf8');
            const state = JSON.parse(data);
            
            this.dashboardData.todaysOrders = state.todaysOrders || [];
            this.dashboardData.productStatus.product1.dailyOrders = state.product1OrderCount || 0;
            this.dashboardData.productStatus.product2.dailyOrders = state.product2OrderCount || 0;
            this.dashboardData.productStatus.product2.dailyTotal = state.product2DailyOrdered || 0;
            
            this.updateStats();
        } catch {
            console.log('📋 No daily data found yet');
        }
    }

    updateStats() {
        const orders = this.dashboardData.todaysOrders;
        this.dashboardData.stats.totalOrdersToday = orders.length;
        this.dashboardData.stats.totalUnitsToday = orders.reduce((sum, order) => sum + order.quantity, 0);
    }

    broadcastUpdate() {
        const message = JSON.stringify({
            type: 'update',
            data: this.dashboardData
        });

        if (this.wss && this.wss.clients) {
            this.wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        }
    }

    updateSystemStatus(status) {
        this.dashboardData.systemStatus = status;
        this.dashboardData.lastUpdate = new Date();
        this.broadcastUpdate();
    }

    updateProductStatus(productKey, status, stockStatus = null) {
        this.dashboardData.productStatus[productKey].status = status;
        this.dashboardData.productStatus[productKey].lastCheck = new Date();
        if (stockStatus) {
            this.dashboardData.productStatus[productKey].stockStatus = stockStatus;
        }
        this.broadcastUpdate();
    }

    addOrder(order) {
        this.dashboardData.todaysOrders.push({
            ...order,
            id: Date.now(),
            timestamp: new Date()
        });
        this.updateStats();
        this.broadcastUpdate();
        
        this.showNotification('success', `Order placed: ${order.product} x ${order.quantity}`);
    }

    showNotification(type, message, persistent = false) {
        const notification = {
            id: Date.now(),
            type,
            message,
            timestamp: new Date(),
            persistent
        };
        
        this.dashboardData.alerts.push(notification);
        
        if (!persistent) {
            setTimeout(() => {
                this.dashboardData.alerts = this.dashboardData.alerts.filter(a => a.id !== notification.id);
                this.broadcastUpdate();
            }, 10000);
        }
        
        this.broadcastUpdate();
        
        if (type === 'success' && message.includes('Order placed')) {
            this.playSuccessSound();
        }
    }

    playSuccessSound() {
        console.log('🔔 Order success notification!');
    }

    async getTodaysOrders() {
        return this.dashboardData.todaysOrders;
    }

    createDashboardHTML() {
        return `<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MEPIFORM Order Monitor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: #2c3e50;
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
        }
        .status-active { background: #27ae60; }
        .status-idle { background: #95a5a6; }
        .status-error { background: #e74c3c; }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .card h3 {
            margin-bottom: 15px;
            color: #2c3e50;
        }
        
        .product-status {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #ecf0f1;
        }
        
        .product-status:last-child {
            border-bottom: none;
        }
        
        .stock-available { color: #27ae60; font-weight: 600; }
        .stock-limited { color: #f39c12; font-weight: 600; }
        .stock-unavailable { color: #e74c3c; font-weight: 600; }
        
        .orders-list {
            max-height: 400px;
            overflow-y: auto;
        }
        
        .order-item {
            background: #f8f9fa;
            padding: 12px;
            margin-bottom: 8px;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
        }
        
        .alert {
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .alert-success { background: #d4edda; color: #155724; }
        .alert-warning { background: #fff3cd; color: #856404; }
        .alert-error { background: #f8d7da; color: #721c24; }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-top: 15px;
        }
        
        .stat-item {
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 4px;
        }
        
        .stat-value {
            font-size: 2em;
            font-weight: 700;
            color: #2c3e50;
        }
        
        .stat-label {
            font-size: 0.9em;
            color: #7f8c8d;
            margin-top: 5px;
        }
        
        @media (max-width: 768px) {
            .grid, .stats-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1>MEPIFORM Order Monitor</h1>
                <p>Automatic Order Management System</p>
            </div>
            <div>
                <span class="status-badge" id="system-status">Connecting...</span>
            </div>
        </div>

        <div id="alerts-container"></div>

        <div class="grid">
            <div class="card">
                <h3>Product Status</h3>
                <div class="product-status">
                    <span>MEPIFORM 10X18CM</span>
                    <span id="product1-status">-</span>
                </div>
                <div class="product-status">
                    <span>MEPIFORM 5X7.5CM</span>
                    <span id="product2-status">-</span>
                </div>
            </div>

            <div class="card">
                <h3>Today's Statistics</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value" id="total-orders">0</div>
                        <div class="stat-label">Orders</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="total-units">0</div>
                        <div class="stat-label">Units</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="success-rate">100%</div>
                        <div class="stat-label">Success</div>
                    </div>
                </div>
            </div>

            <div class="card" style="grid-column: 1 / -1;">
                <h3>Recent Orders</h3>
                <div class="orders-list" id="orders-list">
                    <p style="color: #7f8c8d;">No orders yet today</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(protocol + '//' + location.host);
        let dashboardData = null;

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'initial' || message.type === 'update') {
                dashboardData = message.data;
                updateDashboard();
            }
        };

        ws.onopen = () => {
            updateSystemStatus('Connected', 'active');
        };

        ws.onclose = () => {
            updateSystemStatus('Disconnected', 'error');
        };

        function updateSystemStatus(text, status) {
            const badge = document.getElementById('system-status');
            badge.textContent = text;
            badge.className = 'status-badge status-' + status;
        }

        function updateDashboard() {
            if (!dashboardData) return;

            updateSystemStatus(dashboardData.systemStatus.charAt(0).toUpperCase() + 
                             dashboardData.systemStatus.slice(1), dashboardData.systemStatus);

            // Update product status
            updateProductStatus('product1', dashboardData.productStatus.product1);
            updateProductStatus('product2', dashboardData.productStatus.product2);

            // Update stats
            document.getElementById('total-orders').textContent = dashboardData.stats.totalOrdersToday;
            document.getElementById('total-units').textContent = dashboardData.stats.totalUnitsToday;
            document.getElementById('success-rate').textContent = dashboardData.stats.successRate + '%';

            // Update alerts
            updateAlerts(dashboardData.alerts);

            // Update orders
            updateOrdersList(dashboardData.todaysOrders);
        }

        function updateProductStatus(productId, status) {
            const element = document.getElementById(productId + '-status');
            if (status.stockStatus === 'available') {
                element.textContent = 'Available';
                element.className = 'stock-available';
            } else if (status.stockStatus === 'limited') {
                element.textContent = 'Limited Stock';
                element.className = 'stock-limited';
            } else {
                element.textContent = 'Unavailable';
                element.className = 'stock-unavailable';
            }
            
            if (status.dailyOrders > 0) {
                element.textContent += ' (' + status.dailyOrders + ' orders)';
            }
        }

        function updateAlerts(alerts) {
            const container = document.getElementById('alerts-container');
            container.innerHTML = alerts.map(alert => \`
                <div class="alert alert-\${alert.type}">
                    <span>\${alert.message}</span>
                    <button onclick="dismissAlert('\${alert.id}')">×</button>
                </div>
            \`).join('');
        }

        function updateOrdersList(orders) {
            const list = document.getElementById('orders-list');
            if (orders.length === 0) {
                list.innerHTML = '<p style="color: #7f8c8d;">No orders yet today</p>';
                return;
            }

            list.innerHTML = orders.slice().reverse().map(order => \`
                <div class="order-item">
                    <div>
                        <strong>\${order.product}</strong><br>
                        <small>\${order.time} - Ref: \${order.reference}</small>
                    </div>
                    <div style="text-align: right;">
                        <strong>\${order.quantity} units</strong>
                    </div>
                </div>
            \`).join('');
        }

        function dismissAlert(alertId) {
            fetch('/api/alerts/dismiss', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alertId })
            });
        }

        // Auto-refresh every 30 seconds
        setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    </script>
</body>
</html>`;
    }

    async saveDashboardHTML() {
        const html = this.createDashboardHTML();
        await fs.writeFile(path.join(__dirname, 'dashboard.html'), html);
    }

    async stop() {
        if (this.server) {
            this.server.close();
        }
        if (this.wss) {
            this.wss.close();
        }
    }
}

const dashboard = new MepiformMonitorDashboard();

if (require.main === module) {
    (async () => {
        await dashboard.saveDashboardHTML();
        await dashboard.initialize();
    })();
}

module.exports = MepiformMonitorDashboard;