import { db } from './src/lib/server/db/index.js';
import { postReceipt } from './src/lib/server/services/receipts.js';
import { saveAttachmentBytes } from './src/lib/server/services/attachments.js';
import { parseMoney } from './src/lib/money.js';
import * as fs from 'fs';
import * as path from 'path';

function getOrCreateProduct(name: string): number {
    let row = db.prepare('SELECT id FROM products WHERE name = ?').get(name) as { id: number } | undefined;
    if (row) return row.id;
    
    const res = db.prepare(`
        INSERT INTO products (name, category, base_unit, sprite) 
        VALUES (?, 'other', 'each', 'box')
    `).run(name);
    return res.lastInsertRowid as number;
}

function getOrCreateVendor(name: string): number {
    let row = db.prepare('SELECT id FROM vendors WHERE name = ?').get(name) as { id: number } | undefined;
    if (row) return row.id;
    
    const res = db.prepare(`
        INSERT INTO vendors (name) VALUES (?)
    `).run(name);
    return res.lastInsertRowid as number;
}

// 1. Amazon Receipt
const vendorAmazon = getOrCreateVendor('Amazon');
const amazonReceiptId = postReceipt({
    vendor_id: vendorAmazon,
    ref_number: '114-4445191-1206615',
    purchased_at: '2026-09-08',
    tax: parseMoney(3.92),
    tax_rate: null,
    shipping: parseMoney(2.99 - 2.99), // Free shipping applied
    allocate_extras: true,
    notes: 'Gloss Digital Paper C2S, Large Binder Clips | Billed To: Austin Sanchez',
    lines: [
        {
            product_id: getOrCreateProduct('Gloss Digital Paper C2S (100 Sheets)'),
            unit_name: 'pack',
            base_units_per: 100,
            qty_purchased: 1,
            line_cost: parseMoney(33.99)
        },
        {
            product_id: getOrCreateProduct('Large Binder Clips 2 Inch (72 Pack)'),
            unit_name: 'pack',
            base_units_per: 72,
            qty_purchased: 1,
            line_cost: parseMoney(21.99)
        }
    ]
});
console.log('Created Amazon receipt:', amazonReceiptId);

// Attach PDF
const amzPdfPath = '/Users/austin/Documents/tk invoices/tk receipts/Order Details.pdf';
if (fs.existsSync(amzPdfPath)) {
    saveAttachmentBytes(amazonReceiptId, {
        name: 'Order Details.pdf',
        mime: 'application/pdf',
        bytes: fs.readFileSync(amzPdfPath)
    });
    console.log('Attached PDF to Amazon receipt');
}

// 2. OnTimeSupplies Receipt
const vendorOnTime = getOrCreateVendor('OnTimeSupplies.com');
const onTimeReceiptId = postReceipt({
    vendor_id: vendorOnTime,
    ref_number: '361018',
    purchased_at: '2026-09-08',
    tax: parseMoney(7.63),
    tax_rate: null,
    shipping: parseMoney(0),
    allocate_extras: true,
    notes: 'Various View Binders | Shipped To: Austin Sanchez',
    lines: [
        { product_id: getOrCreateProduct('4" D-Ring View Binder White'), unit_name: 'each', base_units_per: 1, qty_purchased: 5, line_cost: parseMoney(26.55) },
        { product_id: getOrCreateProduct('5" D-Ring View Binder White'), unit_name: 'each', base_units_per: 1, qty_purchased: 5, line_cost: parseMoney(22.90) },
        { product_id: getOrCreateProduct('3" D-Ring View Binder White'), unit_name: 'each', base_units_per: 1, qty_purchased: 10, line_cost: parseMoney(28.20) },
        { product_id: getOrCreateProduct('3" Economy Round Ring View Binder White'), unit_name: 'each', base_units_per: 1, qty_purchased: 10, line_cost: parseMoney(21.80) },
        { product_id: getOrCreateProduct('2" D-Ring View Binder White'), unit_name: 'each', base_units_per: 1, qty_purchased: 5, line_cost: parseMoney(9.60) },
    ]
});
console.log('Created OnTimeSupplies receipt:', onTimeReceiptId);

const onTimePdfPath = '/Users/austin/Documents/tk invoices/tk receipts/Checkout_ Confirmation _ OnTimeSupplies.com.pdf';
if (fs.existsSync(onTimePdfPath)) {
    saveAttachmentBytes(onTimeReceiptId, {
        name: 'Checkout_ Confirmation _ OnTimeSupplies.com.pdf',
        mime: 'application/pdf',
        bytes: fs.readFileSync(onTimePdfPath)
    });
    console.log('Attached PDF to OnTimeSupplies receipt');
}

// 3. UniversalBinders Receipt
const vendorUB = getOrCreateVendor('universalbinders.com');
const ubReceiptId = postReceipt({
    vendor_id: vendorUB,
    ref_number: '6230',
    purchased_at: '2026-09-08',
    tax: parseMoney(0),
    tax_rate: null,
    shipping: parseMoney(0),
    allocate_extras: true,
    notes: 'Side Tabs A-Z and 1-25 | Billed To: Ben King',
    lines: [
        { product_id: getOrCreateProduct('Side Tab-Set A-Z'), unit_name: 'set', base_units_per: 1, qty_purchased: 10, line_cost: parseMoney(39.90) },
        { product_id: getOrCreateProduct('Side Tab 25th Cut-Collated Sets - # 1- 25'), unit_name: 'set', base_units_per: 1, qty_purchased: 25, line_cost: parseMoney(87.25) },
    ]
});
console.log('Created universalbinders receipt:', ubReceiptId);

const ubPdfPath = '/Users/austin/Documents/tk invoices/tk receipts/universalbinders.com_Receipt_PrinterFriendly.php_OrderID=6230.pdf';
if (fs.existsSync(ubPdfPath)) {
    saveAttachmentBytes(ubReceiptId, {
        name: 'universalbinders.com_Receipt.pdf',
        mime: 'application/pdf',
        bytes: fs.readFileSync(ubPdfPath)
    });
    console.log('Attached PDF to universalbinders receipt');
}

// 4. LD Products Receipt
const vendorLD = getOrCreateVendor('LD Products');
const ldReceiptId = postReceipt({
    vendor_id: vendorLD,
    ref_number: '03-000826398',
    purchased_at: '2026-09-08',
    tax: parseMoney(2.14),
    tax_rate: null,
    shipping: parseMoney(5.99),
    allocate_extras: true,
    notes: 'Compatible Canon 054H HY Black Toner | Discount applied $3.40',
    lines: [
        { product_id: getOrCreateProduct('Compatible Canon 054H HY Black Toner'), unit_name: 'each', base_units_per: 1, qty_purchased: 1, line_cost: parseMoney(33.99 - 3.40) },
    ]
});
console.log('Created LD Products receipt:', ldReceiptId);

const ldPdfPath = "/Users/austin/Documents/tk invoices/tk receipts/Gmail - We've Received Your Order_ 03-000826398.pdf";
if (fs.existsSync(ldPdfPath)) {
    saveAttachmentBytes(ldReceiptId, {
        name: "We've Received Your Order_ 03-000826398.pdf",
        mime: 'application/pdf',
        bytes: fs.readFileSync(ldPdfPath)
    });
    console.log('Attached PDF to LD Products receipt');
}

console.log('Done!');
