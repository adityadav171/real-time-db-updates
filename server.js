require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// PostgreSQL client for listening to notifications
const pgClient = new Client({
    connectionString: process.env.DATABASE_URL
});

// PostgreSQL client for regular queries
const queryClient = new Client({
    connectionString: process.env.DATABASE_URL
});

// Connect to database
async function connectDatabase() {
    try {
        await pgClient.connect();
        await queryClient.connect();
        
        // Start listening for notifications
        await pgClient.query('LISTEN order_updates');
        console.log('✅ Connected to PostgreSQL and listening for notifications');
        
        // Handle notifications
        pgClient.on('notification', (msg) => {
            try {
                const data = JSON.parse(msg.payload);
                console.log('📢 Database notification:', data);
                
                // Broadcast to all connected clients
                io.emit('orderUpdate', data);
            } catch (error) {
                console.error('❌ Error parsing notification:', error);
            }
        });
        
    } catch (error) {
        console.error('❌ Database connection error:', error);
        process.exit(1);
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API to get all orders
app.get('/api/orders', async (req, res) => {
    try {
        const result = await queryClient.query('SELECT * FROM orders ORDER BY id DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// API to create new order
app.post('/api/orders', async (req, res) => {
    try {
        const { customer_name, product_name, status = 'pending' } = req.body;
        const result = await queryClient.query(
            'INSERT INTO orders (customer_name, product_name, status) VALUES ($1, $2, $3) RETURNING *',
            [customer_name, product_name, status]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// API to update order
app.put('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { customer_name, product_name, status } = req.body;
        const result = await queryClient.query(
            'UPDATE orders SET customer_name = $1, product_name = $2, status = $3 WHERE id = $4 RETURNING *',
            [customer_name, product_name, status, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// API to delete order
app.delete('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await queryClient.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ error: 'Failed to delete order' });
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('👤 Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('👋 Client disconnected:', socket.id);
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🔄 Shutting down gracefully...');
    await pgClient.end();
    await queryClient.end();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    await connectDatabase();
});
