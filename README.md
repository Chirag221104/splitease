```markdown
# Splitease – Group Expense & Settlement Manager

A modern Splitwise-style web app to simplify group expense tracking, multi-contributor payments, settlements, and trust-based verification with proof uploads.

---

## 🚀 Features

### 💸 Multi-Contributor Expenses
- Multiple people can pay for a single expense with custom paid amounts.
- Supports complex cost-sharing scenarios in groups.

### ⚖️ Flexible Split Types
- Split equally  
- Split by exact amount  
- Split by percentage  
- Split by shares  

### 🤝 Settlement System
- Cash settlements require receiver approval.
- Online settlements apply instantly.

### 📊 Accurate Finance Engine
- Net balance calculation for each user.
- Pairwise debt simplification to minimize transactions.
- Group-level and global dashboard balances.

### 🔐 Role-Based Controls
- Group owner can delete expenses.
- Participants can approve or reject cash expenses.

---

## 📦 Tech Stack

- **Frontend:** Next.js 14 (App Router), React, TailwindCSS, ShadCN UI  
- **Auth & Database:** Firebase Auth, Firestore  
- **Storage:** Supabase Storage  
- **Deployment:** Vercel

---

## 🛠️ Installation

```
# 1. Clone the repository
git clone https://github.com/Chirag221104/splitease.git
cd splitease

# 2. Install dependencies
npm install
# or
yarn install
```

---

## 🔧 Environment Setup

Create a file named `.env.local` in the project root:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## ▶️ Run the Development Server

```
npm run dev
```

Now open in your browser:

👉 http://localhost:3000

---

## 🔐 Supabase Setup for Proof Uploads

1️⃣ **Create bucket**

- Name: `expenses-proof`  
- Settings:  
  - Public: **ON**  
  - File size restriction: optional  
  - MIME restriction: optional  

2️⃣ **Create storage policies**

Go to:  
`Storage → buckets → expenses-proof → Policies`

Create these 3 policies:

**Policy 1: Allow authenticated users to upload**

- USING:
  ```
  auth.role() = 'authenticated'
  ```
- WITH CHECK:
  ```
  auth.role() = 'authenticated'
  ```

**Policy 2: Allow authenticated users to read**

- USING:
  ```
  auth.role() = 'authenticated'
  ```

**Policy 3: Allow authenticated users to update/delete only their own files**

- USING:
  ```
  auth.uid() = owner
  ```
- WITH CHECK:
  ```
  auth.uid() = owner
  ```

---

## 🚀 Deploy on Vercel

```
vercel
# or
npm run build
vercel --prod
```

Make sure to add all environment variables in Vercel:

`Project Settings → Environment Variables`

---

## 📘 Project Structure

```
/app
  /dashboard
  /groups/[id]
  /expenses
/components
/context
/lib
/types
```

---

## 🤝 Contributing

Pull requests are welcome.  
For bugs or feature suggestions, please create an issue in the repository.

---

## 📄 License

This project is licensed under the **MIT License**.
```

[1](https://www.splitease.net)
[2](https://play.google.com/store/apps/details?id=com.mybserve.splitease)
[3](https://github.com/hariharen9/splitease)
[4](https://apps.apple.com/us/app/spliteasy-group-trip-expense/id6749556847)
[5](https://www.expensease.in/features)
[6](https://apps.apple.com/in/app/splitease-share-smart/id6746094115)
[7](https://play.google.com/store/apps/details?id=com.golden.split_wisely&hl=en_IN)
[8](https://splitser.com)
[9](https://splitease.net/about)
[10](https://play.google.com/store/apps/details?id=com.Splitwise.SplitwiseMobile&hl=en_IN)
[11](https://www.scribd.com/document/913159573/Copy-of-Splitease-App)
[12](https://play.google.com/store/apps/details?id=com.SKApps.tripocount&hl=en_IN)
[13](https://www.linkedin.com/posts/archishmanadhikari_introducing-splitease-the-ultimate-group-activity-7308572279456612353-v3zW)
[14](https://www.splitwise.com)
[15](https://zenodo.org/records/15688077/files/Splitwise%20-Formatted%20Paper.pdf?download=1)
