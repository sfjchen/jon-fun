# Poker Room Cleanup Setup

This document explains how to set up automatic cleanup of inactive poker rooms.

## Overview

Rooms that are inactive for more than 24 hours are automatically deleted. This prevents database bloat and ensures only active games remain.

## Database Migration

First, run the migration to add the `last_activity` field:

```sql
-- Run this in Supabase SQL Editor
ALTER TABLE poker_rooms 
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE poker_rooms 
SET last_activity = created_at 
WHERE last_activity IS NULL;

CREATE INDEX IF NOT EXISTS idx_poker_rooms_last_activity ON poker_rooms(last_activity);
```

## Cleanup Endpoint

The cleanup endpoint is available at: `/api/poker/cleanup`

### Manual Testing

You can test the cleanup manually by calling:

```bash
curl -X POST https://your-domain.com/api/poker/cleanup
```

Or with authorization (if CLEANUP_API_KEY is set):

```bash
curl -X POST https://your-domain.com/api/poker/cleanup \
  -H "Authorization: Bearer YOUR_CLEANUP_API_KEY"
```

## Automated Cleanup Options

### Option 1: Vercel Cron Jobs (Recommended)

Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/poker/cleanup",
    "schedule": "0 */6 * * *"
  }]
}
```

This runs every 6 hours. Adjust the schedule as needed.

### Option 2: External Cron Service

Use a service like:
- **cron-job.org** - Free cron job service
- **EasyCron** - Reliable cron service
- **GitHub Actions** - If your repo is on GitHub

Set up a cron job to call:
```
https://your-domain.com/api/poker/cleanup
```

Recommended schedule: Every 6-12 hours

### Option 3: Supabase Edge Functions + pg_cron

If you have access to Supabase Edge Functions, you can create a scheduled function.

## Environment Variables

Optional: Set `CLEANUP_API_KEY` in your Vercel environment variables to protect the endpoint:

```bash
CLEANUP_API_KEY=your-secret-key-here
```

## How It Works

1. The cleanup endpoint finds all rooms where:
   - `last_activity` is NULL, OR
   - `last_activity` is older than 24 hours

2. It deletes related data in this order:
   - `poker_actions` (game history)
   - `poker_game_state` (current game state)
   - `poker_players` (player records)
   - `poker_rooms` (room records)

3. Returns the number of deleted rooms

## Activity Tracking

The `last_activity` field is automatically updated when:
- A player joins a room
- A player takes a betting action
- The game starts

This ensures active rooms are never deleted.

