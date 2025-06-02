-- Migration: Add first_name and last_name to entity_invitations
-- This migration adds name fields to store invitee names for better invitation management

-- Add first_name and last_name columns to entity_invitations table
ALTER TABLE entity_invitations 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT; 