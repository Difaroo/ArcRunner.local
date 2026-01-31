-- Migration: add_clip_is_selected
-- Add isSelected field to Clip table

ALTER TABLE Clip ADD COLUMN isSelected BOOLEAN NOT NULL DEFAULT 0;
