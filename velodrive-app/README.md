# VeloDrive - All Vehicle Rental Marketplace

A complete vehicle rental platform supporting all vehicle types (motorcycle, cars, vans, SUV, sedan, coupe, hatchback, pickup, off-road, sport, micro, convertible, wagon, crossover, muscle, roadster, cabriolet, limousine, formula 1, mini van, liftback, 10-wheeler trucks, trailer trucks, dump trucks, wheel loaders, payloaders, boom trucks, cranes, and more).

## Features

- **Three User Roles**: Admin, Vehicle Owner, Renter
- **Authentication**: Register/Login with JWT, role-based access
- **Vehicle Registration**: All vehicle types with certificates, specs, pricing, marketing ads
- **Document Uploads**: Certificate of registration, proof of ownership, original certificates, NBI clearance, tax certificates, valid ID, driver's license
- **Owner Membership**: Php 2,500 one-time yearly platform fee + Php 250 service charge per booking
- **E-Wallet**: Connected to bank account, withdrawable, supports refunds
- **Split Payment Escrow**: AaaS-plus-transaction model — renter pays → escrow → split (owner 90%, admin 10%)
- **Rental Flow**: Pickup/return/destination points, number of days, fuel/damage/delay charges
- **Admin Dashboard**: Monitor all transactions, users, vehicles, bookings, vehicle location tracking
- **Owner Dashboard**: Manage vehicles, track bookings, earnings, vehicle location tracking
- **Renter Dashboard**: Browse vehicles, book rentals, track active rentals
- **GPS Tracker**: Vehicle locations visible on Admin & Owner dashboards (Google Maps / Waze)
- **GDPR**: Consent management, data export, right to erasure
- **Communication**: Phone call, SMS (text), and email notifications
- **Deployment**: Neon Database (serverless PostgreSQL) + Vercel

## Project Structure

```
velodrive-app/
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── config/       # Database config (Neon support)
│   │   ├── controllers/  # Route controllers
│   │   ├── models/       # Sequelize models
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Auth, upload, GDPR, error handling
│   │   ├── services/     # Wallet, payment, GDPR, communication
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
```

## Tech Stack

- **Backend**: Node.js, Express, Sequelize ORM, PostgreSQL (Neon serverless)
- **Frontend**: React 18, Vite, Tailwind CSS, React Router, Lucide React
- **Authentication**: JWT + bcrypt
- **Payments/Escrow**: Split payment logic (built-in, integrate with GCash/PayMaya/Stripe in production)
- **Communication**: Nodemailer (email), Twilio (SMS & voice calls)
- **Deployment**: Vercel, Neon Database

## Getting Started

### Prerequisites
- Node.js v18+
- PostgreSQL (local) or Neon Database account (serverless)
- npm

### Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials (Neon DATABASE_URL or local PostgreSQL)
npm install
npm run seed        # Creates default admin user
npm run dev         # Start on http://localhost:5000
```

Default admin credentials:
- Email: `gctravelandtours2021@gmail.com`
- Password: `Admin@123456` (change via `ADMIN_PASSWORD` in `.env`)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev         # Start on http://localhost:3000
```

## Deployment

### Backend on Vercel + Neon Database

1. Create a [Neon](https://neon.tech) serverless PostgreSQL database
2. Copy the `DATABASE_URL` connection string
3. Create a [Vercel](https://vercel.com) project and connect this repo
4. Add environment variables in Vercel:
   - `DATABASE_URL` (from Neon)
   - `JWT_SECRET`
   - `FRONTEND_URL`
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
   - `SENDGRID_API_KEY`, `FROM_EMAIL`
5. Deploy

### Frontend on Vercel

1. Connect the frontend folder to Vercel
2. Build command: `npm run build`
3. Output directory: `dist`
4. Set the API proxy to your backend URL

## Communication Channels

All dashboards (Admin, Owner, Renter) support notifications via:
- **Phone Call** (voice)
- **Phone Text / SMS**
- **Email**

Configure `TWILIO_*` and `SENDGRID_API_KEY` in `.env` to enable real notifications. In development, communications are mocked and logged to console.

## GDPR Compliance

- Consent collection on registration
- Data export endpoint: `GET /api/users/gdpr/export`
- Data erasure endpoint: `DELETE /api/users/gdpr/erase`
- Consent withdrawal: `POST /api/users/gdpr/withdraw-consent`

## License

MIT