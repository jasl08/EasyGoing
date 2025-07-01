# Easy Going
**A Smart Trip Planning App for Stress-Free Travel**
![easygoing](easygoing.jpg)

## Overview  
Easy Going is a full-stack trip planning application that helps users plan, manage, and budget for trips. It features AI-powered recommendations, a budgeting system, and intelligent photo caching to reduce external API calls. Designed with simplicity and scalability in mind, it runs across modern browsers and mobile devices using a Node.js backend and a React Native frontend.

---

## Platform & Requirements

### Backend  
- **Platform:** Node.js on AWS EC2 (Ubuntu)  
- **Languages:** JavaScript (ES6), SQL  
- **Runtime:** Node.js v18+  
- **Package Manager:** npm  
- **Services:**  
  - Firebase Authentication  
  - AWS EC2 (server hosting)
  - PostgreSQL (via Amazon RDS)  
  - AWS S3 (for photo caching)  
  - Google Maps API  

- **Libraries:**  
 - All libraries are in backend/package.json and can be installed using "npm install" in the backend directory

### Frontend  
- **Platform:** React Native (Expo)  
- **Languages:** JavaScript, JSX  
- **Runtime:** Node.js v18+, Expo CLI  
- **Libraries:**  
  - All libraries are in backend/package.json and can be installed using "npm install" in the root directory

---

---

## Build & Run Instructions

This project includes a Node.js backend and a React Native frontend (using Expo). All necessary code is hosted in the Capstone GitLab repository:

```
https://capstone.cs.utah.edu/easy-going/easy-going.git
```

All code and setup instructions are provided below to ensure the project can be fully built and run locally or on the cloud.

---

### Prerequisites

Install the following tools on your machine:
- [Node.js v18+](https://nodejs.org/)
- [npm](https://www.npmjs.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [PostgreSQL](https://www.postgresql.org/) (or access to Amazon RDS)
- Git
- `psql` CLI for PostgreSQL interaction

---

## Project Structure

```
easy-going/
│
├── backend/              ← Node.js + Express backend
│   ├── server.js
│   ├── schema.sql        ← PostgreSQL schema
│   └── .env.example
│
├── frontend/             ← React Native frontend via Expo
│   ├── App.js
│   └── ...
│
└── README.md             ← This file
```

---


## Cloud Deployment

### EC2 Backend Setup

1. Launch an Ubuntu EC2 instance and SSH in:
   ```bash
   ssh -i ~/.ssh/your-key.pem ubuntu@your-ec2-ip
   ```

2. Install Node.js, npm, and git:
   ```bash
   sudo apt update && sudo apt install -y nodejs npm git
   ```

3. Clone the project:
   ```bash
   git clone https://capstone.cs.utah.edu/easy-going/easy-going.git
   cd easy-going/backend
   ```

4. Set up `.env` with credentials for Firebase, Google Maps, PostgreSQL, and AWS:
   ```env
   DB_HOST=...
   DB_USER=...
   DB_PASSWORD=...
   DB_NAME=...
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   S3_BUCKET=...
   ```

5. Install dependencies and start the backend server:
   ```bash
   npm install
   node server.js
   ```

> Optionally use `pm2` or `screen` to keep the server running in the background.

---

### RDS PostgreSQL Setup

1. Create a **PostgreSQL** instance on Amazon RDS:
   - Choose **PostgreSQL** engine
   - Enable **public access**
   - Add your EC2 instance's security group to the **RDS inbound rules**

2. Connect to the RDS instance from EC2:
   ```bash
   psql -h your-rds-endpoint -U postgres -d postgres
   ```

3. Seed the database with the schema:
   ```bash
   psql -h your-rds-endpoint -U postgres -d postgres -f backend/schema.sql
   ```

> This will create all necessary tables (`users`, `trips`, `history`, `cached_photos`) for the backend.

---

### S3 Bucket Setup (Photo Caching)

1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com/s3/) and create a new bucket:
   - Name it: `easygoing-photo-cache`
   - Region: Match your EC2 region (e.g., `us-east-2`)
   - Block **all public access** (recommended)
   - Enable versioning (optional)

2. Ensure your IAM user or EC2 instance role has these permissions:
   - `s3:PutObject`
   - `s3:GetObject`
   - `s3:ListBucket`

   Example policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::bucket-name",
           "arn:aws:s3:::bucket-name/*"
         ]
       }
     ]
   }
   ```

3. Once configured, the backend will cache Google Maps photo references to this bucket automatically.

---

 After completing the EC2, RDS, and S3 setup:
- Your backend server should be live
- The database will be seeded and ready
- Image caching via S3 will reduce Google Maps API calls



## Developer Notes  
- API routes are documented via Swagger at `/api-docs`  

---

## 📄 License  
MIT License — see `LICENSE.md` for details.
