const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

// Middleware setup
app.use(cors()); // Enable Cross-Origin Resource Sharing for mobile connections
app.use(express.json()); // Parse incoming JSON requests
app.use(express.static('public')); // Serve static frontend files (worker.html, supervisor.html)

// Redirect root URL (http://localhost:5000/) directly to worker.html
app.get('/', (req, res) => {
    res.redirect('/worker.html');
});

// Define directory paths for pending and main stock storage
const PENDING_DIR = path.join(__dirname, 'Pending_Stock');
const MAIN_DIR = path.join(__dirname, 'Main_Stock');

// Ensure required directories exist on application startup
if (!fs.existsSync(PENDING_DIR)) fs.mkdirSync(PENDING_DIR);
if (!fs.existsSync(MAIN_DIR)) fs.mkdirSync(MAIN_DIR);

// API 1: Receive stock submission from worker's mobile app
app.post('/api/add-stock', (req, res) => {
    const { worker, item, qty } = req.body;
    
    // Validate required form fields
    if (!worker || !item || !qty) {
        return res.status(400).json({ success: false, message: 'All fields are required!' });
    }

    const timestamp = Date.now();
    const stockData = {
        id: timestamp,
        worker,
        item,
        qty: Number(qty),
        date: new Date().toLocaleString()
    };

    const filePath = path.join(PENDING_DIR, `stock_${timestamp}.json`);

    // Save submission as an individual JSON file in the Pending_Stock folder
    fs.writeFile(filePath, JSON.stringify(stockData, null, 2), (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Failed to save pending file' });
        res.json({ success: true, message: 'Stock sent to PC pending queue!' });
    });
});

// API 2: Fetch all pending stock entries for the supervisor dashboard
app.get('/api/pending-stock', (req, res) => {
    fs.readdir(PENDING_DIR, (err, files) => {
        if (err) return res.status(500).json({ success: false, message: 'Error reading files' });

        // Read and parse all JSON files inside Pending_Stock folder
        const pendingList = files.map(file => {
            const fileContent = fs.readFileSync(path.join(PENDING_DIR, file));
            return { filename: file, ...JSON.parse(fileContent) };
        });

        res.json(pendingList);
    });
});

// API 3: Approve pending stock, move JSON file to Main_Stock, and append data to master CSV
app.post('/api/approve-stock', (req, res) => {
    const { filename } = req.body;
    const oldPath = path.join(PENDING_DIR, filename);
    const newPath = path.join(MAIN_DIR, filename);

    if (!fs.existsSync(oldPath)) {
        return res.status(404).json({ success: false, message: 'File not found' });
    }

    // Read the pending JSON file and format it into a CSV row
    const rawData = fs.readFileSync(oldPath);
    const data = JSON.parse(rawData);
    const csvLine = `"${data.id}","${data.date}","${data.worker}","${data.item}",${data.qty}\n`;
    const csvPath = path.join(MAIN_DIR, 'master_inventory.csv');

    // Create CSV header if master_inventory.csv does not exist yet
    if (!fs.existsSync(csvPath)) {
        fs.writeFileSync(csvPath, 'ID,Date,Worker,Item,Quantity\n');
    }

    // Append entry to master CSV file
    fs.appendFileSync(csvPath, csvLine);

    // Move file from Pending_Stock to Main_Stock directory
    fs.rename(oldPath, newPath, (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Failed to move file' });
        res.json({ success: true, message: 'Stock approved and synced to Main Master CSV!' });
    });
});

// Start server on port 5000
const PORT = 5000;
app.listen(PORT, () => console.log(`PC Server Running on http://localhost:${PORT}`));