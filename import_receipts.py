import sqlite3
import csv
import datetime
import os

DB_PATH = 'data/inventory.db'
CSV_PATH = '/Users/austin/Documents/tk invoices/receipts_summary.csv'

def parse_money(m_str):
    """Convert money strings like '$55.98' or '-$3.40' to integer cents."""
    if not m_str: return 0
    clean = m_str.replace('$', '').replace(',', '').strip()
    if not clean: return 0
    return int(round(float(clean) * 100))

def parse_date(d_str):
    """Convert '09/08/2026' to '2026-09-08'."""
    try:
        return datetime.datetime.strptime(d_str.strip(), "%m/%d/%Y").strftime("%Y-%m-%d")
    except ValueError:
        return d_str

def main():
    if not os.path.exists(DB_PATH):
        print(f"Error: DB not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            vendor_name = row['Retailer'].strip()
            
            # Find or create Vendor
            cursor.execute("SELECT id FROM vendors WHERE name = ?", (vendor_name,))
            v_res = cursor.fetchone()
            if v_res:
                vendor_id = v_res[0]
            else:
                cursor.execute("INSERT INTO vendors (name) VALUES (?)", (vendor_name,))
                vendor_id = cursor.lastrowid
                
            # Prepare Receipt data
            ref_number = row['Order Number'].strip()
            purchased_at = parse_date(row['Date'])
            
            subtotal = parse_money(row['Subtotal'])
            tax = parse_money(row['Tax'])
            shipping = parse_money(row['Shipping'])
            total = parse_money(row['Total'])
            notes = f"Items: {row['Items']} | Billed To: {row['Billed To']} | Shipped To: {row['Shipped To']} | Payment: {row['Payment Method']}"

            # Insert Receipt
            cursor.execute("""
                INSERT INTO receipts 
                (vendor_id, ref_number, purchased_at, subtotal, tax, shipping, total, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (vendor_id, ref_number, purchased_at, subtotal, tax, shipping, total, notes))
            
            print(f"Inserted receipt for {vendor_name} (Order: {ref_number}) for {total/100:.2f}")

    conn.commit()
    conn.close()
    print("Done importing receipts!")

if __name__ == '__main__':
    main()