# VeloDrive - All Vehicle Rental Marketplace

A complete vehicle rental platform supporting all vehicle types (motorcycle, cars, vans, SUV, sedan, coupe, hatchback, pickup, off-road, sport, micro, convertible, wagon, crossover, muscle, roadster, cabriolet, limousine, formula 1, mini van, liftback, 10-wheeler trucks, trailer trucks, dump trucks, wheel loaders, payloaders, boom trucks, cranes, and more).

## Features

- **Three User Roles**: Admin, Vehicle Owner, Renter
- **Authentication**: Register/Login with JWT, role-based access
- **Vehicle Registration**: All vehicle types with certificates, specs, pricing, marketing ads
- **Document Uploads**: Certificate of registration, proof of ownership, original certificates, NBI clearance, tax certificates, valid ID, driver's license
- **Owner Membership**: Php 2,500 one-time yearly platform fee + Php 250 service charge per booking
- **E-Wallet**: Connected to bank account, withdrawable, supports refunds
- **Split Payment Escrow**: AaaS-plus-transaction model â€” renter pays â†’ escrow â†’ split (owner 90%, admin 10%)
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
â”œâ”€â”€ backend/              # Node.js + Express API
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ config/       # Database config (Neon support)
â”‚   â”‚   â”œâ”€â”€ controllers/  # Route controllers
â”‚   â”‚   â”œâ”€â”€ models/       # Sequelize models
â”‚   â”‚   â”œâ”€â”€ routes/       # API routes
â”‚   â”‚   â”œâ”€â”€ middleware/   # Auth, upload, GDPR, error handling
â”‚   â”‚   â”œâ”€â”€ services/     # Wallet, payment, GDPR, communication
â”‚   â”‚   â”œâ”€â”€ utils/        # Seed script
â”‚   â”‚   â””â”€â”€ uploads/      # File uploads
â”‚   â”œâ”€â”€ package.json
â”‚   â””â”€â”€ .env.example
â”œâ”€â”€ frontend/             # React + Vite + Tailwind
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ components/   # Navbar, ProtectedRoute
â”‚   â”‚   â”œâ”€â”€ context/      # AuthContext
â”‚   â”‚   â”œâ”€â”€ pages/        # Home, Login, Register, Dashboards, Wallet, Profile, GDPR
â”‚   â”‚   â”œâ”€â”€ utils/        # API client
â”‚   â”‚   â””â”€â”€ App.jsx
â”‚   â”œâ”€â”€ package.json
â”‚   â”œâ”€â”€ vite.config.js
â”‚   â””â”€â”€ tailwind.config.js
â”œâ”€â”€ vercel.json           # Vercel deployment config
â””â”€â”€ README.md
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
- Password: set via `ADMIN_PASSWORD` in `.env` (never commit real passwords)

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

