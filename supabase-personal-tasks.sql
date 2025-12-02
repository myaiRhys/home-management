-- Create personal_tasks table for private user to-do lists
-- Run this in the Supabase SQL Editor

-- Create personal_tasks table
CREATE TABLE IF NOT EXISTS personal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  due_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE personal_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only see their own tasks
CREATE POLICY "Users can view their own personal tasks"
  ON personal_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own personal tasks"
  ON personal_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own personal tasks"
  ON personal_tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own personal tasks"
  ON personal_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS personal_tasks_user_id_idx ON personal_tasks(user_id);
CREATE INDEX IF NOT EXISTS personal_tasks_completed_idx ON personal_tasks(completed);
CREATE INDEX IF NOT EXISTS personal_tasks_due_date_idx ON personal_tasks(due_date);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON personal_tasks TO authenticated;

-- Add comment
COMMENT ON TABLE personal_tasks IS 'Private personal to-do lists - only visible to the task owner';
