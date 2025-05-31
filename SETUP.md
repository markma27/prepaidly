# Prepaidly.io Setup Guide

## Quick Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the root directory with the following content:

```env
# Supabase Configuration
# Get these values from your Supabase project dashboard: https://app.supabase.com/
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 2. Supabase Setup

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose your organization and enter project details
   - Wait for the project to be created

2. **Get Your Project Credentials**
   - Go to Settings > API
   - Copy the "Project URL" and "anon public" key
   - Add these to your `.env.local` file

3. **Set Up the Database**
   - Go to the SQL Editor in your Supabase dashboard
   - Copy the contents of `schema.sql` from this project
   - Paste and run the SQL to create the tables and policies

### 3. Test the Application

1. **Start the development server**
   ```bash
   npm run dev
   ```

2. **Open your browser**
   - Navigate to [http://localhost:3000](http://localhost:3000)
   - You should be redirected to the login page

3. **Create an account**
   - Click "Don't have an account? Sign up"
   - Enter your email and password
   - Check your email for the confirmation link (if email confirmation is enabled)

4. **Test the schedule creation**
   - After logging in, click "New Schedule"
   - Fill out the form with test data
   - Generate and download a schedule

### 4. Troubleshooting

**Common Issues:**

- **Environment variables not loading**: Make sure `.env.local` is in the root directory and restart the dev server
- **Supabase connection errors**: Verify your URL and key are correct in the environment file
- **Database errors**: Ensure you've run the `schema.sql` script in your Supabase SQL editor
- **Authentication issues**: Check that your Supabase project has email authentication enabled

**Need Help?**

If you encounter any issues, check the browser console and terminal for error messages. Most issues are related to environment configuration or database setup.

### 5. Production Deployment

When deploying to production (Vercel, Netlify, etc.):

1. Add the environment variables to your hosting platform
2. Ensure your Supabase project is configured for production
3. Update any CORS settings if needed
4. Test the authentication flow in production

That's it! Your Prepaidly.io application should now be running successfully. 