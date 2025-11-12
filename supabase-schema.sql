-- Supabase Database Schema for Poker Chip Tracker
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Poker Rooms Table
CREATE TABLE IF NOT EXISTS poker_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pin VARCHAR(4) UNIQUE NOT NULL,
  host_id VARCHAR(255) NOT NULL,
  small_blind INTEGER NOT NULL DEFAULT 5,
  big_blind INTEGER NOT NULL DEFAULT 10,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- 'waiting', 'active', 'finished'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Poker Players Table
CREATE TABLE IF NOT EXISTS poker_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_pin VARCHAR(4) NOT NULL REFERENCES poker_rooms(pin) ON DELETE CASCADE,
  player_id VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  chips INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_all_in BOOLEAN NOT NULL DEFAULT false,
  current_bet INTEGER NOT NULL DEFAULT 0,
  hole_cards JSONB,
  has_folded BOOLEAN NOT NULL DEFAULT false,
  has_acted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_pin, player_id)
);

-- Poker Game State Table
CREATE TABLE IF NOT EXISTS poker_game_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_pin VARCHAR(4) UNIQUE NOT NULL REFERENCES poker_rooms(pin) ON DELETE CASCADE,
  hand_number INTEGER NOT NULL DEFAULT 1,
  betting_round VARCHAR(20) NOT NULL DEFAULT 'pre-flop', -- 'pre-flop', 'flop', 'turn', 'river', 'showdown', 'finished'
  current_bet INTEGER NOT NULL DEFAULT 0,
  dealer_position INTEGER NOT NULL DEFAULT 0,
  small_blind_position INTEGER NOT NULL DEFAULT 0,
  big_blind_position INTEGER NOT NULL DEFAULT 0,
  action_on INTEGER NOT NULL DEFAULT 0,
  small_blind INTEGER NOT NULL DEFAULT 5,
  big_blind INTEGER NOT NULL DEFAULT 10,
  pot_main INTEGER NOT NULL DEFAULT 0,
  pot_side_pots JSONB DEFAULT '[]'::jsonb,
  community_cards JSONB DEFAULT '[]'::jsonb,
  is_game_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Poker Actions Table (History)
CREATE TABLE IF NOT EXISTS poker_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_pin VARCHAR(4) NOT NULL REFERENCES poker_rooms(pin) ON DELETE CASCADE,
  hand_number INTEGER NOT NULL,
  player_id VARCHAR(255) NOT NULL,
  action VARCHAR(20) NOT NULL, -- 'fold', 'check', 'call', 'bet', 'raise', 'all-in'
  amount INTEGER NOT NULL DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_poker_players_room_pin ON poker_players(room_pin);
CREATE INDEX IF NOT EXISTS idx_poker_players_player_id ON poker_players(player_id);
CREATE INDEX IF NOT EXISTS idx_poker_game_state_room_pin ON poker_game_state(room_pin);
CREATE INDEX IF NOT EXISTS idx_poker_actions_room_pin ON poker_actions(room_pin);
CREATE INDEX IF NOT EXISTS idx_poker_actions_hand_number ON poker_actions(hand_number);

-- Enable Row Level Security (RLS)
ALTER TABLE poker_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_actions ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read/write (for now - you can restrict later)
CREATE POLICY "Allow public read access to poker_rooms" ON poker_rooms FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to poker_rooms" ON poker_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to poker_rooms" ON poker_rooms FOR UPDATE USING (true);

CREATE POLICY "Allow public read access to poker_players" ON poker_players FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to poker_players" ON poker_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to poker_players" ON poker_players FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to poker_players" ON poker_players FOR DELETE USING (true);

CREATE POLICY "Allow public read access to poker_game_state" ON poker_game_state FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to poker_game_state" ON poker_game_state FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to poker_game_state" ON poker_game_state FOR UPDATE USING (true);

CREATE POLICY "Allow public read access to poker_actions" ON poker_actions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to poker_actions" ON poker_actions FOR INSERT WITH CHECK (true);

-- Enable Realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE poker_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE poker_players;
ALTER PUBLICATION supabase_realtime ADD TABLE poker_game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE poker_actions;

