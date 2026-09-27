# Brivu Cloudflare Worker (D1 Database + R2 File Storage)

This directory contains the complete Cloudflare Worker code for Brivu to save files (PDF receipts, invoices, images, backups) to Cloudflare R2 and sync data/information to Cloudflare D1 SQL database.

---

## 🚀 Quick Setup Guide

### Option A: Using Cloudflare Dashboard + GitHub (Recommended)

1. **Connect GitHub to Cloudflare**:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages**.
   - Click **Create application** > **Pages** or **Workers**.
   - Connect your GitHub repository.

2. **Create D1 Database**:
   - In Cloudflare Dashboard, go to **Storage & Databases** > **D1 SQL Database**.
   - Click **Create Database**, name it `brivu-db`.
   - Copy the **Database ID**.
   - Open the D1 console, paste the SQL from `cloudflare/schema.sql` and run it (or use Wrangler CLI).

3. **Create R2 Bucket**:
   - In Cloudflare Dashboard, go to **Storage & Databases** > **R2 Object Storage**.
   - Click **Create Bucket**, name it `brivu-files`.

4. **Bind D1 and R2 to your Worker**:
   - Go to your Worker's **Settings** > **Bindings**.
   - Add D1 Database binding:
     - Variable name: `DB`
     - Database: select `brivu-db`
   - Add R2 Bucket binding:
     - Variable name: `R2_BUCKET`
     - Bucket: select `brivu-files`
   - (Optional) Add secret environment variable:
     - Variable name: `SYNC_SECRET_KEY`
     - Value: your secret key

5. **Copy Your Worker URL**:
   - Your worker will have a URL like `https://brivu-cloudflare-worker.<your-subdomain>.workers.dev`.
   - In the Brivu app, go to **Settings** > **Cloudflare Cloud Sync & Storage**.
   - Paste the Worker URL and tap **Test Connection** & **Sync All to Cloudflare Now**!

---

### Option B: Using Wrangler CLI

In your terminal:

```bash
cd cloudflare

# 1. Login to Cloudflare
npx wrangler login

# 2. Create the D1 SQL database
npx wrangler d1 create brivu-db
# Copy the database_id from the output into wrangler.toml under [[d1_databases]] database_id

# 3. Create the R2 Storage bucket
npx wrangler r2 bucket create brivu-files

# 4. Initialize database tables
npx wrangler d1 execute brivu-db --file=./schema.sql

# 5. Deploy the worker to Cloudflare
npx wrangler deploy
```

Once deployed, paste your Worker URL into Brivu app settings!
