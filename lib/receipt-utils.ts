import type { CollectionItemWithMedia } from '@/types/database';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';

export async function printInventoryReceipt(items: CollectionItemWithMedia[]) {
    // 1. Generate HTML matching authentic retro video store thermal receipt
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
        const priceVal = item.value_estimate ? `$${Number(item.value_estimate).toFixed(2).padStart(7, ' ')}` : '  [OWNED]';

        let badges = '';
        if (isGrail) badges += ' [★ GRAIL]';
        if (isOnDisplay) badges += ' [◆ PICK]';

        return `
        <div class="item-row">
            <div class="item-line1">
                <span class="item-name">${fullTitle}${edition}${badges}</span>
                <span class="item-price">${priceVal}</span>
            </div>
        </div>`;
    }).join('');
}

function generateReceiptHtml(items: CollectionItemWithMedia[]) {
    const date = new Date().toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' });
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const totalCount = items.length;

    // Calculate total value if available
    let totalValuedSum = 0;
    items.forEach(i => {
        if (i.value_estimate !== null && i.value_estimate !== undefined) {
            totalValuedSum += Number(i.value_estimate) || 0;
        }
    });

    const totalValuedStr = totalValuedSum > 0 ? `$ ${totalValuedSum.toFixed(2)}` : '$   0.00';
    const tenderedStr = totalValuedSum > 0 ? `$ ${(totalValuedSum * 1.25).toFixed(2)}` : '$ 100.00';
    const changeStr = totalValuedSum > 0 ? `$ ${(totalValuedSum * 0.25).toFixed(2)}` : '$ 100.00';
    const transNo = Math.floor(100000 + Math.random() * 900000);

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
                <div class="sub-header">--- MOVIES (${movies.length}) ---</div>
                ${renderItemRows(movies)}
            </div>`;
        }

        if (tvShows.length > 0) {
            subSectionsHtml += `
            <div class="sub-section">
                <div class="sub-header">--- TV SHOWS (${tvShows.length}) ---</div>
                ${renderItemRows(tvShows)}
            </div>`;
        }

        sectionsHtml += `
        <div class="format-section">
            <div class="section-banner">
                *** ${formatName} (${groupItems.length} ITEM${groupItems.length === 1 ? '' : 'S'}) ***
            </div>
            <div class="section-body">
                ${subSectionsHtml}
            </div>
        </div>`;
    });

    const formatSummaryHtml = formatCounts.map(f => `${f.format}: ${f.count}`).join(' | ');

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
            margin: 8mm;
            size: auto;
        }

        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        body {
            font-family: 'Courier Prime', 'Courier New', monospace;
            background-color: #ffffff;
            color: #000000;
            padding: 10px;
            font-size: 11px;
            line-height: 1.35;
            margin: 0 auto;
            max-width: 480px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 16px;
            font-weight: bold;
        }
        
        .store-title {
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 1px;
            display: block;
            margin-bottom: 2px;
        }

        .store-sub {
            font-size: 10px;
            margin-bottom: 2px;
        }
        
        .divider-stars {
            letter-spacing: 1px;
            margin: 4px 0;
            overflow: hidden;
            white-space: nowrap;
        }

        .tagline {
            font-size: 11px;
            font-weight: 700;
            margin: 4px 0;
        }

        .promo-block {
            font-size: 10px;
            margin: 6px 0;
            line-height: 1.3;
        }

        .meta-grid {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            margin-top: 6px;
        }

        .format-section {
            margin-top: 14px;
            margin-bottom: 14px;
            page-break-inside: avoid;
        }

        .section-banner {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1px;
            background-color: #eeeeee;
            padding: 4px;
            margin-bottom: 6px;
            text-align: center;
            border-top: 1px dashed #000000;
            border-bottom: 1px dashed #000000;
        }

        .section-body {
            padding-left: 2px;
        }

        .sub-section {
            margin-bottom: 10px;
        }

        .sub-header {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 1px;
            color: #000000;
            margin-top: 6px;
            margin-bottom: 4px;
            text-transform: uppercase;
        }

        .item-row {
            padding: 2px 0;
            border-bottom: 1px dotted #dddddd;
        }

        .item-line1 {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }

        .item-name {
            font-weight: 700;
            color: #000000;
            flex: 1;
            padding-right: 8px;
            word-break: break-word;
        }

        .item-price {
            font-weight: 700;
            white-space: nowrap;
        }

        .totals-block {
            margin-top: 16px;
            padding-top: 8px;
            border-top: 1px dashed #000000;
            font-weight: 700;
            font-size: 11px;
        }

        .totals-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
        }

        .totals-line {
            border-top: 1px solid #000000;
            margin: 4px 0;
        }

        .footer {
            margin-top: 20px;
            border-top: 1px dashed #000000;
            padding-top: 12px;
            text-align: center;
            font-weight: bold;
        }

        .summary-line {
            font-size: 9px;
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px dotted #888888;
        }

        .notice {
            font-size: 9px;
            color: #333333;
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
        <div class="store-sub">412 QUAKER STREET</div>
        <div class="store-sub">LUBBOCK, TX 79416</div>
        <div class="store-sub">(806) 791-5001</div>
        <div class="divider-stars">************************************************</div>
        <div class="tagline">Thank You! Make It A Tracking Night!</div>
        
        <div class="promo-block">
            We want to hear from you!<br />
            Visit www.trackingapp.com/feedback<br />
            Tell us about your collection and<br />
            receive community perks via email.
        </div>

        <div class="divider-stars">************************************************</div>
        <div class="meta-grid">
            <span>Store: 91241</span>
            <span>Clerk: MEMBER #1</span>
        </div>
        <div class="meta-grid">
            <span>Date: ${date} ${time}</span>
            <span>Trans: #${transNo}</span>
        </div>
        <div class="divider-stars">************************************************</div>
    </div>

    <div class="content">
        ${sectionsHtml}
    </div>

    <div class="totals-block">
        <div class="totals-row">
            <span>Total Collection Items</span>
            <span>${totalCount}</span>
        </div>
        <div class="totals-row">
            <span>Est. Portfolio Value</span>
            <span>${totalValuedStr}</span>
        </div>
        <div class="totals-row">
            <span>Tax</span>
            <span>$   0.00</span>
        </div>
        <div class="totals-line"></div>
        <div class="totals-row">
            <span>Subtotal</span>
            <span>${totalValuedStr}</span>
        </div>
        <div class="totals-row">
            <span>Tendered CASH</span>
            <span>${tenderedStr}</span>
        </div>
        <div class="totals-row">
            <span>Change Due</span>
            <span>${changeStr}</span>
        </div>
    </div>

    <div class="footer">
        <div class="summary-line">FORMAT BREAKDOWN: ${formatSummaryHtml}</div>
        <div>THANK YOU FOR TRACKING WITH US!</div>
        <div class="notice">BE KIND -- PLEASE REWIND YOUR TAPES!</div>
        <div class="notice">* KEEP THIS RECEIPT FOR YOUR RECORDS *</div>
        <div class="divider-stars" style="margin-top:8px;">************************************************</div>
    </div>
</body>
</html>
    `;
}
