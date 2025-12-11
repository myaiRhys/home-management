-- Notifications Feature Schema
-- Run this script in the Supabase SQL Editor to add notifications support
--
-- IMPORTANT: Run this AFTER the main schema is set up

-- =============================================
-- STEP 1: Create notifications table
-- =============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL means broadcast to all household members
  type TEXT NOT NULL,  -- 'task_assigned', 'shopping_added', 'task_completed', 'clifford_assigned'
  title TEXT NOT NULL,
  message TEXT,
  related_item_id UUID,  -- ID of related shopping/task/clifford item
  related_table TEXT,  -- 'shopping', 'tasks', 'clifford'
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_to_user ON notifications(to_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_household ON notifications(household_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- =============================================
-- STEP 2: Create notification preferences table
-- =============================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  task_assigned BOOLEAN DEFAULT TRUE,      -- Notify when assigned a task
  shopping_added BOOLEAN DEFAULT TRUE,     -- Notify when items added to shopping
  task_completed BOOLEAN DEFAULT FALSE,    -- Notify when tasks are completed
  clifford_assigned BOOLEAN DEFAULT TRUE,  -- Notify when clifford task assigned
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_household ON notification_preferences(household_id);

-- =============================================
-- STEP 3: Enable RLS on new tables
-- =============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 4: Notifications table policies
-- =============================================

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view broadcast notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications in their household" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

-- SELECT: Users can see notifications sent to them OR broadcast to their household
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (
  to_user_id = auth.uid()
  OR (to_user_id IS NULL AND is_household_member(household_id))
);

-- INSERT: Users can create notifications in their household
CREATE POLICY "Users can insert notifications in their household"
ON notifications FOR INSERT
WITH CHECK (is_household_member(household_id) AND from_user_id = auth.uid());

-- UPDATE: Users can update (mark as read) their own notifications
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
USING (
  to_user_id = auth.uid()
  OR (to_user_id IS NULL AND is_household_member(household_id))
);

-- DELETE: Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON notifications FOR DELETE
USING (
  to_user_id = auth.uid()
  OR (to_user_id IS NULL AND is_household_member(household_id))
);

-- =============================================
-- STEP 5: Notification preferences table policies
-- =============================================

DROP POLICY IF EXISTS "Users can view their own preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON notification_preferences;

-- SELECT: Users can only see their own preferences
CREATE POLICY "Users can view their own preferences"
ON notification_preferences FOR SELECT
USING (user_id = auth.uid());

-- INSERT: Users can create their own preferences
CREATE POLICY "Users can insert their own preferences"
ON notification_preferences FOR INSERT
WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own preferences
CREATE POLICY "Users can update their own preferences"
ON notification_preferences FOR UPDATE
USING (user_id = auth.uid());

-- =============================================
-- STEP 6: Enable Realtime for notifications
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- =============================================
-- STEP 7: Auto-cleanup old notifications (optional)
-- Run periodically or use a cron job to clean up old read notifications
-- =============================================

-- Function to clean old notifications (older than 30 days and read)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE read = TRUE
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- VERIFICATION
-- =============================================

-- Run this to verify tables were created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('notifications', 'notification_preferences');

-- Run this to see all policies:
-- SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('notifications', 'notification_preferences');
