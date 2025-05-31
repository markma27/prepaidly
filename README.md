# Prepaidly.io

A SaaS tool for managing prepayment & unearned revenue schedules. Built with Next.js 14, TypeScript, Tailwind CSS, and Supabase.

## Features

- 🔐 **Authentication**: Secure user authentication with Supabase
- 📊 **Schedule Generation**: Create straight-line amortization schedules for prepayments and unearned revenue
- 📋 **Interactive Forms**: User-friendly forms with validation using React Hook Form and Zod
- 📈 **Schedule Preview**: Real-time preview of generated schedules in a table format
- 📥 **CSV Export**: Download schedules as CSV files for record keeping
- 🎨 **Modern UI**: Beautiful interface built with Tailwind CSS and shadcn/ui components

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Form Handling**: React Hook Form
- **Validation**: Zod
- **Date Handling**: date-fns

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd prepaidly
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to Settings > API to get your project URL and anon key
   - Run the SQL schema from `schema.sql` in your Supabase SQL editor

4. **Configure environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Database Schema

The application uses two main tables:

### `schedules`
- Stores the main schedule information (vendor, dates, amounts, etc.)
- Links to authenticated users via `user_id`

### `schedule_entries`
- Stores individual period entries for each schedule
- Contains period date, amount, cumulative, and remaining values

Row Level Security (RLS) is enabled to ensure users can only access their own data.

## Usage

1. **Sign Up/Login**: Create an account or sign in with existing credentials
2. **Create Schedule**: Click "New Schedule" from the dashboard
3. **Fill Details**: Enter vendor information, dates, and amounts
4. **Generate**: Click "Generate Schedule" to create the amortization schedule
5. **Preview**: Review the generated schedule in the table
6. **Download**: Export the schedule as a CSV file

## Project Structure

```
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx          # Authentication page
│   ├── (protected)/
│   │   └── new-schedule/page.tsx   # New schedule creation
│   ├── api/
│   │   ├── auth/logout/route.ts    # Logout endpoint
│   │   └── download-csv/route.ts   # CSV download endpoint
│   ├── dashboard/page.tsx          # Main dashboard
│   └── page.tsx                    # Home page (redirects)
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── NewScheduleForm.tsx         # Schedule creation form
│   └── ScheduleTable.tsx           # Schedule display table
├── lib/
│   ├── supabaseClient.ts           # Supabase configuration
│   ├── generateStraightLineSchedule.ts  # Schedule generation logic
│   └── utils.ts                    # Utility functions
└── schema.sql                      # Database schema
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@prepaidly.io or create an issue in this repository.
