# Forge Learning Studio

A responsive Next.js and Supabase prototype for COMP5241. Forge combines adaptive software-learning experiences with private learner accounts, progress records, and instructor course creation.

## Prototype flows

- Learner dashboard with course progress and a sequenced learning path
- Interactive decision lab with contextual feedback
- Personalised AI coach interaction
- Instructor studio for AI-assisted course generation
- Cohort engagement analytics and editable generated outlines
- Email-verified signup, login, logout, and password recovery
- Private learner profiles, bookmarks, quiz results, achievements, and data controls

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local`, create a Supabase project, and add its URL and keys. Run [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL editor before testing accounts.

Open [http://localhost:3000](http://localhost:3000).

### Authentication setup

Passwords are never stored in this repository or the `profiles` table. Supabase Auth stores a one-way password hash in its protected authentication schema.

In **Supabase → Authentication → URL Configuration**:

- Set the Site URL to `http://localhost:3000` for local development.
- Add `http://localhost:3000/auth/confirm` as a redirect URL.
- For Vercel, also add `https://your-domain.vercel.app/auth/confirm` and use the deployed origin for `NEXT_PUBLIC_SITE_URL`.

After signup, verify the email before logging in. If login reports an unverified email, use **Resend verification**. Existing accounts can also use **Forgot password** without registering again.

## Deploy to Vercel

Import this repository in Vercel and keep the detected Next.js defaults. Add all four variables from `.env.example` in **Project Settings → Environment Variables**, using the deployed URL for `NEXT_PUBLIC_SITE_URL`. Add that same URL to Supabase Authentication → URL Configuration.

## Next production steps

Course and progress content is currently seeded prototype content; the SQL schema is ready for persistence. Replace the simulated AI responses with a server-side model API. Keep model credentials in Vercel environment variables and call the model through a Route Handler rather than from the browser.