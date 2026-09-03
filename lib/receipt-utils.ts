import type { CollectionItemWithMedia } from '@/types/database';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';

export async function printInventoryReceipt(items: CollectionItemWithMedia[]) {
    // 1. Sort items alphabetically
    const sortedItems = [...items].sort((a, b) => {
        const titleA = a.movies?.title || a.shows?.name || '';
        const titleB = b.movies?.title || b.shows?.name || '';
        return titleA.localeCompare(titleB);
    });

    // 2. Generate HTML
    const html = generateReceiptHtml(sortedItems);

    // 3. Print / Share PDF
    if (Platform.OS === 'web') {
        try {
            await Print.printAsync({ html });
        } catch (e) {
            printViaIframe(html);
        }
    } else {
        try {
            await Print.printAsync({ html });
        } catch (e) {
            try {
                const { uri } = await Print.printToFileAsync({ html });
                await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            } catch (err) {
                console.error('Mobile native print error:', err);
                throw new Error('Failed to generate print dialog on this device.');
            }
        }
    }
}

function printViaIframe(html: string) {
    if (typeof document === 'undefined') return;

    try {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (doc) {
            doc.open();
            doc.write(html);
            doc.close();

            setTimeout(() => {
                try {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                } catch (err) {
                    console.error('Print iframe trigger error:', err);
                }
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                }, 2000);
            }, 300);
        }
    } catch (e) {
        console.error('Iframe creation error:', e);
    }
}

function generateReceiptHtml(items: CollectionItemWithMedia[]) {
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();
    const count = items.length;

    const rows = items.map(item => {
        const rawTitle = item.movies?.title || item.shows?.name || 'Unknown Title';
        const seasonInfo = item.media_type === 'tv' ? ` S${item.season_number || 1}` : '';
        const fullTitle = `${rawTitle}${seasonInfo}`.toUpperCase();

        // Take first 25 chars, pad with dots
        const displayTitle = fullTitle.substring(0, 25).padEnd(25, '.');
        const format = (item.format || '???').toUpperCase().substring(0, 8).padEnd(8, ' ');
        const status = item.is_grail ? '[GRAIL]' : item.is_on_display ? '[PICK ]' : '       ';

        return `
        <div class="row">
            <span class="title-cell">${displayTitle}</span>
            <span class="format-cell">${format}</span>
            <span class="status-cell">${status}</span>
        </div>`;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime&display=swap');
        
        body {
            font-family: 'Courier Prime', 'Courier New', monospace;
            background-color: #fff;
            color: #000;
            padding: 20px;
            font-size: 12px;
            margin: 0;
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
            font-family: monospace;
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
