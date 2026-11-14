# VeloDrive - All Vehicle Rental Marketplace

A complete vehicle rental marketplace platform built using JavaScript, Node.js, and Express, supporting 28 distinct vehicle categories (motorcycles, cars, vans, SUVs, trucks, and specialized equipment).

## Features

- **Three User Roles**: Admin, Vehicle Owner (`Vehicles Owner`), Renter
- **Authentication**: Register/Login with JWT, role-based access
- **Vehicle Registration**: Multi-category vehicle profiles with certificates, specs, and pricing
- **Document Uploads**: Certificate of registration, proof of ownership, NBI clearance, tax certificates, valid ID, driver's license
- **Owner Membership**: Php 4,999 one-time yearly platform fee + Php 499 service charge per booking
- **Live Payments & Escrow**: Integrated PayPal REST API checkout, digital wallets (GCash/Maya integration workflows), split-payment escrow model
- **Rental Flow**: Pickup/return/destination points, duration tracking, fuel/damage/delay calculations
- **Dashboards**: Dedicated Admin, Owner, and Renter dashboards with operational metrics and telemetry
- **GPS Tracker**: Vehicle location tracking visible on Admin & Owner dashboards
- **GDPR Compliance**: Consent management, data export, and right-to-erasure tools
- **Automated Communication**: Email notifications powered by **Resend**, alongside SMS and phone integration
- **Deployment**: Neon Serverless PostgreSQL + Vercel

## Project Structure

velodrive-app/
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── config/       # Database config (Neon SSL support)
│   │   ├── controllers/  # Route controllers
│   │   ├── models/       # Sequelize models
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Auth, upload, GDPR, error handling
│   │   ├── services/     # Wallet, payment, GDPR, Resend email
│   │   ├── utils/        # Seed script
│   │   └── uploads/      # File uploads
│   ├── package.json
│   └── .env.example
├── frontend/             # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/   # Navbar, ProtectedRoute
│   │   ├── context/      # AuthContext
│   │   ├── pages/        # Home, Login, Register, Dashboards, Wallet, Profile, GDPR
│   │   ├── utils/        # API client
│   │   └── App.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── vercel.json           # Vercel deployment config
└── README.md


## Tech Stack

- **Backend**: Node.js, Express, Sequelize ORM, PostgreSQL (Neon Serverless)
- **Frontend**: React 18, Vite, Tailwind CSS, React Router, Lucide React
- **Authentication**: JWT + bcrypt
- **Payments**: PayPal REST API (Partner Referrals & Checkout)
- **Email Service**: Resend API (`RESEND_API_KEY`)
- **Deployment**: Vercel & Neon Database

## Getting Started

### Prerequisites

- Node.js v18+
- Neon Database account (serverless PostgreSQL)
- npm

### Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your Neon DATABASE_URL and Resend API key credentials
npm install
npm run seed        # Creates default admin user
npm run dev         # Start on http://localhost:5000
Default admin credentials:

Email: gctravelandtours2021@gmail.com

Password: set via ADMIN_PASSWORD in .env

Frontend Setup
Bash
cd frontend
npm install
npm run dev         # Start on http://localhost:3000
Canonical Deployment Architecture
App: Vercel_Project ID_Canonical_URL Run Vercel CLI From
Frontend: frontend-2o4j=https://www.gctravelandtour.com/ (velodrive-app/frontend)
Backend: velodrive-backend=https://api.gctravelandtour.com/ (velodrive-app/backend)
Important: Never run vercel link or vercel deploy from the repository root. Always run commands from the respective frontend or backend directory.

Database: Connect your backend exclusively to your Neon PostgreSQL database URL (DATABASE_URL).

Deploying Backend
Add environment variables in Vercel (velodrive-backend):

DATABASE_URL (Neon PostgreSQL string)

RESEND_API_KEY (Resend API key)

FROM_EMAIL (<noreply.velodrive@gctravelandtour.com>)

JWKS_SECRET, FRONTEND_URL (https://www.gctravelandtour.com)

PAYPAL_CLIENT_ID, PAYPAL_SECRET_KEY, PAYPAL_MODE

Deploy:

Bash
cd velodrive-app/backend
vercel --prod --yes
Deploying Frontend
Build and deploy:

Bash
cd velodrive-app/frontend
vercel --prod --yes
GDPR Compliance
Consent collection during user registration

Data export endpoint: GET /api/users/gdpr/export

Data erasure endpoint: DELETE /api/users/gdpr/erase

Consent withdrawal endpoint: POST /api/users/gdpr/withdraw-consent

License
Copyright © 2026 Gila Arayan Cain Knowles & Catherine Arayan Cain Knowles. All rights reserved.
Proprietary software developed for VeloDrive and ArGie-C Travel and Tours Agency.