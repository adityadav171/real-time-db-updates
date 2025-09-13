const io = require('socket.io-client');
require('dotenv').config();

const socket = io(`http://localhost:${process.env.PORT || 3000}`);

console.log('🚀 CLI Client connecting to real-time order updates...\n');

socket.on('connect', () => {
    console.log('✅ Connected to server');
    console.log('👂 Listening for real-time order updates...\n');
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
});

socket.on('orderUpdate', (data) => {
    const timestamp = new Date().toLocaleString();
    
    console.log(`[${timestamp}] 📢 Database Update:`);
    console.log(`Operation: ${data.operation}`);
    console.log(`Table: ${data.table}`);
    console.log(`Data:`, JSON.stringify(data.data, null, 2));
    console.log('─'.repeat(50));
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection failed:', error.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down CLI client...');
    socket.disconnect();
    process.exit(0);
});
