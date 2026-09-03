import type { CollectionItemWithMedia } from '@/types/database';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';

export async function printInventoryReceipt(items: CollectionItemWithMedia[]) {
    // 1. Generate HTML with format grouping & franchise sorting
    const html = generateReceiptHtml(items);

    // 2. Print / Share PDF
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

/**
 * Normalizes format string for grouping
 */
function normalizeFormat(formatRaw?: string, isBootleg?: boolean): string {
    if (isBootleg) return 'BOOTLEG';
    const fmt = (formatRaw || 'OTHER').toUpperCase().trim();
    if (fmt === '4K' || fmt.startsWith('4K') || fmt.includes('ULTRA HD')) return '4K ULTRA HD';
    if (fmt === 'BLU-RAY' || fmt === 'BLURAY' || fmt.includes('BLU')) return 'BLU-RAY';
    if (fmt === 'DVD') return 'DVD';
    if (fmt === 'VHS') return 'VHS';
    if (fmt === 'DIGITAL' || fmt === 'DIGITAL CODE') return 'DIGITAL';
    return fmt || 'OTHER';
}

/**
 * Sorts items alphabetically while respecting franchise grouping and franchise order
 */
function sortItemsWithFranchise(items: CollectionItemWithMedia[]): CollectionItemWithMedia[] {
    return [...items].sort((itemA, itemB) => {
        const rawTitleA = (itemA.movies?.title || itemA.shows?.name || '').trim();
        const rawTitleB = (itemB.movies?.title || itemB.shows?.name || '').trim();

        const franchiseA = itemA.franchise?.trim();
        const franchiseB = itemB.franchise?.trim();

        // 1. Both have franchise defined
        if (franchiseA && franchiseB) {
            if (franchiseA.toLowerCase() === franchiseB.toLowerCase()) {
                const orderA = itemA.franchise_order !== null && itemA.franchise_order !== undefined ? Number(itemA.franchise_order) : Infinity;
                const orderB = itemB.franchise_order !== null && itemB.franchise_order !== undefined ? Number(itemB.franchise_order) : Infinity;
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                return rawTitleA.localeCompare(rawTitleB);
            }
            return franchiseA.localeCompare(franchiseB);
        }
        // 2. Only A has franchise
        if (franchiseA) {
            return franchiseA.localeCompare(rawTitleB);
        }
        // 3. Only B has franchise
        if (franchiseB) {
            return rawTitleA.localeCompare(franchiseB);
        }
        // 4. Neither has franchise
        return rawTitleA.localeCompare(rawTitleB);
    });
}

function renderItemRows(items: CollectionItemWithMedia[]): string {
    const sorted = sortItemsWithFranchise(items);
    return sorted.map(item => {
        const rawTitle = (item.movies?.title || item.shows?.name || 'Unknown Title').toUpperCase();
        const dateStr = item.movies?.release_date || item.shows?.first_air_date;
        let yearStr = '';
        if (dateStr) {
            const yearNum = new Date(dateStr).getFullYear();
            if (!isNaN(yearNum) && yearNum > 1800) {
                yearStr = ` (${yearNum})`;
            }
        }
        const seasonInfo = item.media_type === 'tv' && item.season_number ? ` S${item.season_number}` : '';
        
        const fullTitle = `${rawTitle}${yearStr}${seasonInfo}`;

        const edition = item.edition ? ` [${item.edition.toUpperCase()}]` : '';
        const isGrail = item.is_grail;
        const isOnDisplay = item.is_on_display;

        let badges = '';
        if (isGrail) badges += ' <span class="badge grail">★ GRAIL</span>';
        if (isOnDisplay) badges += ' <span class="badge display">◆ PICK</span>';

        return `
        <div class="row">
            <div class="row-left">
                <span class="bullet">•</span>
                <span class="item-title">${fullTitle}${edition}</span>
                ${badges}
            </div>
        </div>`;
    }).join('');
}

function generateReceiptHtml(items: CollectionItemWithMedia[]) {
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const totalCount = items.length;

    // Group items by format
    const formatOrder = ['4K ULTRA HD', 'BLU-RAY', 'DVD', 'VHS', 'DIGITAL', 'BOOTLEG', 'OTHER'];
    const groups = new Map<string, CollectionItemWithMedia[]>();

    formatOrder.forEach(fmt => groups.set(fmt, []));

    items.forEach(item => {
        const fmt = normalizeFormat(item.format, item.is_bootleg);
        if (!groups.has(fmt)) {
            groups.set(fmt, []);
        }
        groups.get(fmt)!.push(item);
    });

    // Build format HTML sections
    let sectionsHtml = '';
    const formatCounts: { format: string; count: number }[] = [];

    groups.forEach((groupItems, formatName) => {
        if (groupItems.length === 0) return;

        formatCounts.push({ format: formatName, count: groupItems.length });

        const movies = groupItems.filter(i => i.media_type !== 'tv');
        const tvShows = groupItems.filter(i => i.media_type === 'tv');

        let subSectionsHtml = '';

        if (movies.length > 0) {
            subSectionsHtml += `
            <div class="sub-section">
                <div class="sub-header">── MOVIES [${movies.length}] ──</div>
                ${renderItemRows(movies)}
            </div>`;
        }

        if (tvShows.length > 0) {
            subSectionsHtml += `
            <div class="sub-section">
                <div class="sub-header">── TV SHOWS [${tvShows.length}] ──</div>
                ${renderItemRows(tvShows)}
            </div>`;
        }

        sectionsHtml += `
        <div class="format-section">
            <div class="section-title">
                <span class="section-name">=== ${formatName} ===</span>
                <span class="section-count">[${groupItems.length} ITEM${groupItems.length === 1 ? '' : 'S'}]</span>
            </div>
            <div class="section-body">
                ${subSectionsHtml}
            </div>
        </div>`;
    });

    const formatSummaryHtml = formatCounts.map(f => `
        <div class="summary-pill">
            <span class="summary-label">${f.format}:</span>
            <span class="summary-val">${f.count}</span>
        </div>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tracking Inventory Receipt</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
        
        @page {
            margin: 12mm;
            size: auto;
        }

        * {
            box-sizing: border-box;
        }

        body {
            font-family: 'Courier Prime', 'Courier New', monospace;
            background-color: #ffffff;
            color: #000000;
            padding: 16px;
            font-size: 11px;
            line-height: 1.4;
            margin: 0 auto;
            max-width: 800px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px dashed #000;
            padding-bottom: 12px;
        }
        
        .store-title {
            font-size: 22px;
            font-weight: 700;
            letter-spacing: 2px;
            display: block;
            margin-bottom: 4px;
        }

        .doc-title {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 1.5px;
            margin-bottom: 6px;
        }
        
        .meta {
            font-size: 10px;
            color: #222;
        }

        .format-section {
            margin-top: 18px;
            margin-bottom: 18px;
            page-break-inside: avoid;
        }

        .section-title {
            font-size: 12px;
            font-weight: 700;
            border-top: 1.5px solid #000;
            border-bottom: 1.5px solid #000;
            padding: 4px 6px;
            margin-bottom: 8px;
            letter-spacing: 1px;
            display: flex;
            justify-content: space-between;
            background-color: #f4f4f4;
        }

        .section-body {
            padding-left: 4px;
        }

        .sub-section {
            margin-bottom: 10px;
        }

        .sub-header {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 1px;
            color: #333;
            margin-top: 6px;
            margin-bottom: 4px;
            text-transform: uppercase;
        }

        .row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            padding: 3px 0;
            border-bottom: 1px dotted #e0e0e0;
        }

        .row-left {
            display: flex;
            align-items: baseline;
            flex-wrap: wrap;
            gap: 4px;
        }

        .bullet {
            font-weight: bold;
            margin-right: 2px;
        }

        .item-title {
            font-weight: 700;
            color: #000;
        }

        .badge {
            font-size: 8px;
            font-weight: 700;
            padding: 0 4px;
            border-radius: 2px;
            text-transform: uppercase;
        }

        .badge.grail {
            border: 1px solid #000;
            background-color: #000;
            color: #fff;
        }

        .badge.display {
            border: 1px solid #444;
            background-color: #eee;
            color: #111;
        }

        .footer {
            margin-top: 28px;
            border-top: 2px dashed #000;
            padding-top: 16px;
            text-align: center;
        }

        .summary-box {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 12px;
            margin-bottom: 14px;
            padding-bottom: 10px;
            border-bottom: 1px dotted #aaa;
        }

        .summary-pill {
            font-size: 10px;
            font-weight: 700;
        }

        .summary-label {
            color: #444;
        }

        .summary-val {
            color: #000;
        }

        .total-count {
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }

        .notice {
            font-size: 9px;
            color: #555;
            margin-top: 6px;
        }

        @media print {
            body {
                padding: 0;
            }
            .format-section {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <span class="store-title">TRACKING HOME VIDEO</span>
        <div class="doc-title">INVENTORY RECEIPT</div>
        <div class="meta">PRINTED: ${date} AT ${time}</div>
    </div>

    <div class="content">
        ${sectionsHtml}
    </div>

    <div class="footer">
        <div class="summary-box">
            ${formatSummaryHtml}
        </div>

        <div class="total-count">TOTAL COLLECTION ITEMS: ${totalCount}</div>
        <div>KEEP THIS RECEIPT FOR YOUR RECORDS</div>
        <div class="notice">* OFFICIAL INVENTORY ARCHIVE RECEIPT *</div>
    </div>
</body>
</html>
    `;
}
