# Deployment Guide for sfjc.dev

## Quick Deployment Steps

After making updates to the sfjc.dev site code, pages, or features:

1. **Test locally** (optional but recommended):
   ```bash
   npm run dev
   # Visit http://localhost:3000 to test changes
   ```

2. **Commit and push changes**:
   ```bash
   git acp -m "Your commit message describing the changes"
   ```
   Note: The `acp` command automatically does: `git add . && git commit -m "message" && git push`
   
   **Important**: If you're on a feature branch, merge to `main` for production deployment:
   ```bash
   git checkout main
   git merge your-feature-branch
   git push
   ```

3. **Vercel auto-deploys**: 
   - Vercel automatically detects the push to your main/master branch
   - A new deployment is triggered automatically
   - You'll see the deployment progress in the Vercel dashboard

4. **Verify deployment**:
   - Check Vercel dashboard: https://vercel.com/dashboard
   - Visit https://sfjc.dev to see your changes live
   - Deployment usually takes 1-3 minutes

## Environment Variables Setup

### For Local Development
Environment variables are in `.env.local` (already configured):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### For Production (Vercel)
Add these same variables in Vercel:

1. Go to: https://vercel.com/jochen2sfusds-projects/jon-fun/settings/environment-variables
2. Add each variable:
   - **Key**: `NEXT_PUBLIC_SUPABASE_URL`
     **Value**: `https://nzviiorrlsdtwzvzodpg.supabase.co`
     **Environments**: Production, Preview, Development
   
   - **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56dmlpb3JybHNkdHd6dnpvZHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MTEyNDIsImV4cCI6MjA3ODQ4NzI0Mn0.M3Wb9uCnl6Ry6Q-OnbIf17BwhtZeC-TCN_-8lwT5HUk`
     **Environments**: Production, Preview, Development

3. **Redeploy** after adding variables:
   - Go to Deployments tab
   - Click "..." on latest deployment → "Redeploy"

## MCP Server Status

### Supabase MCP
- **Status**: Connected (when workspace is connected)
- **Usage**: Database queries, migrations, project management
- **Note**: Requires Supabase project to be set up

### Vercel MCP  
- **Status**: ✅ Connected and working
- **Project**: `jon-fun` (prj_p0GxMYUx0l1bfSrEVJQ161WkgTFe)
- **Team**: jochen2sfusd's projects
- **Usage**: Deployment management, project info, build logs

## Git Command Format

**Correct format**: `git acp -m "commit message"`

The `acp` alias performs:
```bash
git add .
git commit -m "your message"
git push
```

## Troubleshooting

### Changes not appearing on sfjc.dev?
1. Check Vercel dashboard for deployment status
2. Ensure environment variables are set in Vercel
3. Check build logs in Vercel for errors
4. Clear browser cache (hard refresh: Cmd+Shift+R / Ctrl+Shift+R)

### Supabase connection issues?
1. Verify environment variables are set correctly
2. Check Supabase project is active
3. Ensure Realtime is enabled for tables (run `supabase-schema.sql`)

### Build failures?
1. Check `npm run build` locally
2. Review Vercel build logs
3. Ensure all dependencies are in `package.json` **and committed to the branch being deployed**
4. **Common issue**: Dependencies added on feature branch but not merged to main
   - Solution: Merge feature branch to main, or ensure dependencies are in the deployed branch

