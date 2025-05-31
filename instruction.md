# Prepaidly.io Development Instructions

**Last Updated:** 31 May 2025  
**Version:** 1.0  
**Maintainer:** Engineering Team  

## Project Overview

Prepaidly.io is a specialized SaaS platform for automating prepayment and unearned revenue schedule management. The application enables finance teams to replace error-prone spreadsheet workflows with guided, automated schedule generation and professional reporting.

**Core Mission**: Transform complex revenue recognition calculations into intuitive, audit-ready workflows that save hours of manual work while ensuring compliance accuracy.

## Goals & Non-Goals

### ✅ Goals (Milestone 1)
- **Simplicity First**: Prioritize user experience over feature complexity
- **Calculation Accuracy**: Zero tolerance for mathematical errors in schedule generation
- **Audit Readiness**: All data trails and exports must support compliance requirements
- **Performance**: Sub-2-second page loads, instant form feedback
- **Security**: Bank-level data protection with user isolation
- **Mobile Responsive**: Full functionality on tablets and mobile devices

### ❌ Non-Goals (Deferred to Future Milestones)
- Advanced schedule types (non-linear, milestone-based)
- Real-time collaboration features
- Third-party integrations (Xero, QuickBooks, etc.)
- Custom reporting beyond CSV export
- Multi-tenant/enterprise features
- AI/ML-powered recommendations

## Tech Stack

### Frontend
- **Next.js 14** with App Router (React Server Components)
- **TypeScript** (strict mode enabled)
- **Tailwind CSS** for styling
- **Shadcn/UI** component library
- **React Hook Form** + **Zod** for form validation
- **Geist Font** (consistent typography)

### Backend & Database
- **Supabase** (authentication, PostgreSQL, real-time)
- **PostgreSQL** with Row Level Security (RLS)
- **Supabase Auth** (email/password authentication)

### Development Tools
- **ESLint** + **Prettier** (enforced formatting)
- **TypeScript** strict checking
- **Husky** pre-commit hooks (future implementation)

### Hosting & Deployment
- **Vercel** (Next.js optimized hosting)
- **Supabase Cloud** (database and auth)

## Folder & Naming Conventions

```
prepaidly/
├── app/                          # Next.js 14 App Router
│   ├── (auth)/                   # Route groups for auth pages
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── dashboard/page.tsx        # Main dashboard
│   ├── new-schedule/page.tsx     # Schedule creation
│   ├── register/                 # Schedule registry
│   │   ├── page.tsx
│   │   └── [id]/edit/page.tsx
│   ├── api/                      # API routes
│   │   ├── schedules/
│   │   ├── download-csv/
│   │   └── auth/
│   ├── globals.css               # Global styles
│   └── layout.tsx                # Root layout
├── components/                   # Reusable UI components
│   ├── ui/                       # Shadcn/UI components
│   ├── NewScheduleForm.tsx
│   ├── ScheduleTable.tsx
│   └── Navigation.tsx
├── lib/                          # Utilities and configurations
│   ├── supabaseClient.ts
│   ├── generateStraightLineSchedule.ts
│   └── utils.ts
├── types/                        # TypeScript type definitions
│   └── database.ts
└── docs/                         # Documentation
    └── PRD-prepaidly.md
```

### Naming Conventions
- **Files**: PascalCase for React components, camelCase for utilities
- **Components**: PascalCase (e.g., `NewScheduleForm.tsx`)
- **Functions**: camelCase (e.g., `generateStraightLineSchedule`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `MAX_SCHEDULE_ENTRIES`)
- **Database**: snake_case (e.g., `schedule_entries`, `user_id`)

## Database Schema

### Tables

```sql
-- Users table (managed by Supabase Auth)
-- auth.users automatically created

-- Schedules table
CREATE TABLE schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                      -- User-defined schedule name
  description TEXT,                        -- Optional description
  schedule_type TEXT NOT NULL,             -- 'prepaid_expense' or 'unearned_revenue'
  total_amount DECIMAL(12,2) NOT NULL,     -- Original prepayment amount
  start_date DATE NOT NULL,                -- Schedule start date
  end_date DATE NOT NULL,                  -- Schedule end date
  period_months INTEGER NOT NULL,          -- Number of months in schedule
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedule entries (individual monthly amortizations)
CREATE TABLE schedule_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,                -- Month/year for this entry
  amount DECIMAL(12,2) NOT NULL,           -- Amortization amount for this period
  cumulative_amount DECIMAL(12,2) NOT NULL, -- Running total through this entry
  remaining_balance DECIMAL(12,2) NOT NULL, -- Remaining balance after this entry
  entry_number INTEGER NOT NULL,           -- Sequential entry number (1, 2, 3...)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security policies
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;

-- Users can only access their own schedules
CREATE POLICY "Users can view own schedules" ON schedules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own schedules" ON schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedules" ON schedules
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only access schedule entries for their own schedules
CREATE POLICY "Users can view own schedule entries" ON schedule_entries
  FOR SELECT USING (
    schedule_id IN (
      SELECT id FROM schedules WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own schedule entries" ON schedule_entries
  FOR INSERT WITH CHECK (
    schedule_id IN (
      SELECT id FROM schedules WHERE user_id = auth.uid()
    )
  );
```

### Field Notes
- **Decimal precision**: 12,2 supports amounts up to $999,999,999.99
- **UUID primary keys**: Better security, no sequential enumeration
- **Timestamps**: Always UTC with timezone awareness
- **RLS**: Ensures complete user data isolation

## API Endpoints Spec (Milestone 1)

### Authentication
```typescript
// Handled by Supabase Auth client-side
// No custom API endpoints needed
```

### Schedules Management

#### `POST /api/schedules`
Create new schedule with entries
```typescript
// Request Body
{
  name: string;           // "Q4 2024 Prepaid Marketing"
  description?: string;   // Optional description
  scheduleType: 'prepaid_expense' | 'unearned_revenue';
  totalAmount: number;    // 12000.00
  startDate: string;      // "2024-01-01" (ISO date)
  endDate: string;        // "2024-12-31"
}

// Response
{
  success: boolean;
  schedule?: {
    id: string;
    ...scheduleData;
    entries: ScheduleEntry[];
  };
  error?: string;
}
```

#### `GET /api/schedules`
Retrieve user's schedules
```typescript
// Query Parameters
?page=1&limit=50&sortBy=created_at&sortOrder=desc

// Response
{
  success: boolean;
  schedules?: Schedule[];
  total?: number;
  error?: string;
}
```

#### `GET /api/schedules/[id]`
Get specific schedule with entries
```typescript
// Response
{
  success: boolean;
  schedule?: Schedule & { entries: ScheduleEntry[] };
  error?: string;
}
```

#### `PUT /api/schedules/[id]`
Update existing schedule
```typescript
// Request Body (partial updates allowed)
{
  name?: string;
  description?: string;
  totalAmount?: number;
  startDate?: string;
  endDate?: string;
}

// Response
{
  success: boolean;
  schedule?: Schedule & { entries: ScheduleEntry[] };
  error?: string;
}
```

### Export

#### `POST /api/download-csv`
Generate CSV download
```typescript
// Request Body
{
  scheduleId: string;
}

// Response
// Content-Type: text/csv
// Content-Disposition: attachment; filename="schedule-{name}-{date}.csv"
```

### Error Handling Standard
All API endpoints return consistent error format:
```typescript
{
  success: false;
  error: string;        // Human-readable error message
  code?: string;        // Machine-readable error code
  details?: object;     // Additional error context
}
```

## Role Definitions & Access Rules

### User Roles (Milestone 1)
- **Individual User**: Only role in M1 - full access to own data only

### Access Patterns
```typescript
// Database access is enforced via RLS policies
// Application-level checks for additional security

// Example access check pattern:
const userSchedules = await supabase
  .from('schedules')
  .select('*')
  .eq('user_id', user.id); // Automatic via RLS

// Never bypass RLS in application code
// Always rely on Supabase Auth user context
```

### Security Rules
- **No admin backdoors**: All data access via authenticated user context
- **No user enumeration**: UUID-based IDs, no sequential numbers
- **Session management**: Supabase handles token refresh automatically
- **Data isolation**: RLS policies ensure zero cross-user data leakage

## Coding Guidelines

### React Component Standards
```typescript
// Functional components with TypeScript
interface Props {
  scheduleId: string;
  onSave?: (schedule: Schedule) => void;
}

export function ScheduleForm({ scheduleId, onSave }: Props) {
  // Hooks at top
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Event handlers
  const handleSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      // Implementation
    } catch (error) {
      console.error('Schedule save failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Early returns for loading/error states
  if (isLoading) return <LoadingSpinner />;

  // Main render
  return (
    <form onSubmit={form.handleSubmit(handleSubmit)}>
      {/* Form content */}
    </form>
  );
}
```

### Utility Functions
```typescript
// Pure functions with clear type signatures
export function generateStraightLineSchedule(
  totalAmount: number,
  startDate: Date,
  endDate: Date
): ScheduleEntry[] {
  // Input validation
  if (totalAmount <= 0) {
    throw new Error('Total amount must be positive');
  }
  
  // Implementation
  // Always include comprehensive error handling
  // Return typed results
}

// Custom hooks for reusable logic
export function useScheduleData(scheduleId?: string) {
  const [data, setData] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Implementation with cleanup
  useEffect(() => {
    // Fetch logic with proper cleanup
  }, [scheduleId]);

  return { data, loading, error };
}
```

### Error Handling Patterns
```typescript
// API route error handling
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate input
    const validatedData = schema.parse(body);
    
    // Business logic
    const result = await createSchedule(validatedData);
    
    return NextResponse.json({
      success: true,
      schedule: result,
    });
  } catch (error) {
    console.error('Schedule creation failed:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid input data',
        details: error.errors,
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
```

### Type Safety
- Use strict TypeScript configuration
- Define interfaces for all data structures
- Use Zod schemas for runtime validation
- Prefer type assertions with validation over `as` casting

## UI Guidelines

### Shadcn/UI Usage
```typescript
// Prefer Shadcn components over custom implementation
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Standard button variants
<Button variant="default">Primary Action</Button>
<Button variant="secondary">Secondary Action</Button>
<Button variant="outline">Tertiary Action</Button>
<Button variant="destructive">Delete Action</Button>

// Form patterns
<div className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="amount">Amount</Label>
    <Input
      id="amount"
      type="number"
      placeholder="0.00"
      {...register("amount")}
    />
    {errors.amount && (
      <p className="text-sm text-destructive">{errors.amount.message}</p>
    )}
  </div>
</div>
```

### Tailwind CSS Preferences
```typescript
// Layout patterns
"flex items-center justify-between" // Header bars
"grid gap-4 md:grid-cols-2"        // Responsive grids
"space-y-4"                        // Vertical spacing
"max-w-4xl mx-auto px-4"           // Content containers

// Interactive states
"hover:bg-gray-50 transition-colors" // Subtle hover effects
"focus:ring-2 focus:ring-blue-500"  // Keyboard focus
"disabled:opacity-50 disabled:cursor-not-allowed" // Disabled states

// Color scheme (consistent with Shadcn)
"bg-background text-foreground"     // Base colors
"border-border"                     // Border colors
"text-muted-foreground"            // Secondary text
```

### Responsive Design
- Mobile-first approach (default styles for mobile)
- Breakpoints: `sm:` (640px), `md:` (768px), `lg:` (1024px)
- Test on mobile devices regularly
- Ensure touch targets are 44px minimum

## Testing Strategy

### Unit Testing (Future Implementation)
```typescript
// Jest + React Testing Library
// Test utilities and pure functions first
// Component testing for critical user flows

describe('generateStraightLineSchedule', () => {
  it('should calculate equal monthly amounts', () => {
    const result = generateStraightLineSchedule(
      12000,
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    
    expect(result).toHaveLength(12);
    expect(result[0].amount).toBe(1000);
  });
});
```

### Integration Testing Priorities
1. **Schedule Creation Flow**: Form submission → Database save → Table display
2. **CSV Export**: Data generation → File download → Content verification
3. **Authentication**: Login → Dashboard access → Data isolation
4. **Schedule Editing**: Load existing → Modify → Save → Update display

### Manual Testing Checklist
- [ ] Mobile responsiveness on real devices
- [ ] CSV import compatibility with Excel/Google Sheets
- [ ] Edge cases: leap years, month-end dates, very large amounts
- [ ] Performance with 100+ schedule entries
- [ ] Error states and network failures

## Environment Variables & Secrets

### Required Environment Variables
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application URLs
NEXT_PUBLIC_APP_URL=https://prepaidly.io
NEXT_PUBLIC_API_URL=https://prepaidly.io/api

# Optional: Analytics
NEXT_PUBLIC_ANALYTICS_ID=

# Development only
NODE_ENV=development
```

### Security Best Practices
- Never commit secrets to git
- Use `.env.local` for local development
- Store production secrets in Vercel environment variables
- Rotate keys quarterly
- Monitor Supabase usage and set up alerts

### Local Development Setup
```bash
# Clone repository
git clone [repository-url]
cd prepaidly

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

## Update Policy

### Keeping This Document Current
- **Weekly Review**: Engineering team reviews and updates during sprint planning
- **Feature Changes**: Update immediately when adding/removing functionality
- **Architecture Changes**: Update before implementing significant changes
- **API Changes**: Update specifications before implementation

### Version Control
- Document version follows semantic versioning
- Major version bumps for breaking changes
- Minor version bumps for new features
- Patch version bumps for clarifications/fixes

### Responsibility Matrix
| Section | Primary Owner | Review Required |
|---------|---------------|-----------------|
| Project Overview | Product Manager | Engineering Lead |
| Tech Stack | Engineering Lead | CTO |
| Database Schema | Backend Engineer | Engineering Lead |
| API Endpoints | Backend Engineer | Frontend Engineer |
| UI Guidelines | Frontend Engineer | Design Lead |
| Testing Strategy | QA Engineer | Engineering Lead |

## TODOs / Backlog Parking Lot

### Technical Debt
- [ ] Add comprehensive error logging and monitoring
- [ ] Implement automated testing pipeline
- [ ] Set up performance monitoring (Core Web Vitals)
- [ ] Add database migration scripts
- [ ] Create development environment reset scripts

### UX Improvements
- [ ] Add keyboard shortcuts for power users
- [ ] Implement undo/redo for schedule editing
- [ ] Add bulk operations (delete multiple schedules)
- [ ] Create schedule templates for common scenarios
- [ ] Add progress indicators for multi-step processes

### Developer Experience
- [ ] Add Storybook for component development
- [ ] Create component playground/demo pages
- [ ] Implement hot reload for database schema changes
- [ ] Add automated code formatting on save
- [ ] Create debugging utilities for schedule calculations

### Future Milestone Prep
- [ ] Research OCR integration options (M2)
- [ ] Investigate LLM providers for schedule suggestions (M2)
- [ ] Plan Xero API integration architecture (M3)
- [ ] Design team collaboration data model (M4)
- [ ] Research enterprise security requirements (M6)

### Documentation
- [ ] Create API documentation site
- [ ] Record video tutorials for common workflows
- [ ] Write troubleshooting guide for common issues
- [ ] Create onboarding checklist for new developers
- [ ] Document deployment and rollback procedures

---

**Document Changelog:**
- v1.0 (Dec 2024): Initial comprehensive documentation
- Next review: January 15, 2025 