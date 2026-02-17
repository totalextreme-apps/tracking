import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';

export async function printInventoryReceipt(items: CollectionItemWithMovie[]) {
    // 1. Sort items alphabetically
    const sortedItems = [...items].sort((a, b) =>
        (a.movies?.title || '').localeCompare(b.movies?.title || '')
    );

    // 2. Generate HTML
    const html = generateReceiptHtml(sortedItems);

    // 3. Play Sound (Optional - can be passed in or handled here if we assume assets)
    // We'll let the UI handle sound to avoid asset loading issues here, or load a default.

    // 4. Print / Generate PDF
    if (Platform.OS === 'web') {
        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            // Wait slightly for resources to load if any, though ours are mostly text/inline styles
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 250);
        } else {
            alert('Pop-up blocker prevented printing. Please allow pop-ups for this site.');
        }
    } else {
        const { uri } = await Print.printToFileAsync({ html });
        await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    }
}

function generateReceiptHtml(items: CollectionItemWithMovie[]) {
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();
    const count = items.length;

    const rows = items.map(item => {
        const title = (item.movies?.title || 'Unknown Title').toUpperCase().substring(0, 25).padEnd(25, '.');
        const format = (item.format || '???').toUpperCase().substring(0, 8).padEnd(8, ' ');
        const status = item.is_grail ? '[GRAIL]' : item.is_on_display ? '[DISP]' : '      ';

        return `
        <div class="row">
            <span class="title">${title}</span>
            <span class="format">${format}</span>
            <span class="status">${status}</span>
        </div>`;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime&display=swap');
        
        body {
            font-family: 'Courier Prime', 'Courier New', monospace;
            background-color: #fff;
            color: #000;
            padding: 20px;
            font-size: 12px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px dashed #000;
            padding-bottom: 10px;
        }
        
        .title {
            font-size: 18px;
            font-weight: bold;
            display: block;
            margin-bottom: 5px;
        }
        
        .meta {
            font-size: 10px;
        }

        .row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            white-space: pre;
        }
        
        .footer {
            margin-top: 20px;
            border-top: 2px dashed #000;
            padding-top: 10px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <span class="title">TRACKING VIDEO STORE</span>
        <div class="meta">INVENTORY RECEIPT</div>
        <div class="meta">${date} ${time}</div>
    </div>

    <div class="content">
        ${rows}
    </div>

    <div class="footer">
        <div>TOTAL ITEMS: ${count}</div>
        <div style="margin-top:10px;">KEEP THIS RECEIPT FOR YOUR RECORDS</div>
        <div style="font-size: 8px; margin-top: 5px;">* NOT VALID FOR RETURNS *</div>
    </div>
</body>
</html>
    `;
}
