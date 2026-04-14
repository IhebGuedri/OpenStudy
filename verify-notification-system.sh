#!/bin/bash
# Quick Start Script for Notification System
# This script helps verify the installation

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║      Notification System - Installation Verification          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if files exist
echo "📋 Checking files..."
echo ""

files=(
  "src/app/services/notification.service.ts"
  "src/app/models/notification.model.ts"
  "src/app/notifications/notification-center.component.ts"
  "src/app/notifications/notification-bell.component.ts"
  "src/app/notifications/notification-dropdown.component.ts"
  "src/app/pages/tasks/task-detail.component.ts"
  "src/app/notifications/README.md"
  "src/app/notifications/INTEGRATION_GUIDE.md"
)

missing_files=0

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $file"
  else
    echo -e "${RED}✗${NC} $file (MISSING)"
    missing_files=$((missing_files + 1))
  fi
done

echo ""
echo "📦 Module Imports..."
echo ""

# Check app-module.ts for imports
if grep -q "NotificationCenterComponent" "src/app/app-module.ts"; then
  echo -e "${GREEN}✓${NC} NotificationCenterComponent imported in app-module.ts"
else
  echo -e "${RED}✗${NC} NotificationCenterComponent NOT imported in app-module.ts"
fi

if grep -q "NotificationBellComponent" "src/app/app-module.ts"; then
  echo -e "${GREEN}✓${NC} NotificationBellComponent imported in app-module.ts"
else
  echo -e "${RED}✗${NC} NotificationBellComponent NOT imported in app-module.ts"
fi

if grep -q "NotificationDropdownComponent" "src/app/app-module.ts"; then
  echo -e "${GREEN}✓${NC} NotificationDropdownComponent imported in app-module.ts"
else
  echo -e "${RED}✗${NC} NotificationDropdownComponent NOT imported in app-module.ts"
fi

if grep -q "CommonModule" "src/app/app-module.ts"; then
  echo -e "${GREEN}✓${NC} CommonModule imported in app-module.ts"
else
  echo -e "${RED}✗${NC} CommonModule NOT imported in app-module.ts"
fi

echo ""
echo "🔀 Routing..."
echo ""

if grep -q "tasks/:id" "src/app/app-routing-module.ts"; then
  echo -e "${GREEN}✓${NC} /tasks/:id route configured in routing-module.ts"
else
  echo -e "${RED}✗${NC} /tasks/:id route NOT configured in routing-module.ts"
fi

if grep -q "TaskDetailComponent" "src/app/app-routing-module.ts"; then
  echo -e "${GREEN}✓${NC} TaskDetailComponent imported in routing-module.ts"
else
  echo -e "${RED}✗${NC} TaskDetailComponent NOT imported in routing-module.ts"
fi

echo ""
echo "🎨 Template..."
echo ""

if grep -q "app-notification-center" "src/app/app.html"; then
  echo -e "${GREEN}✓${NC} NotificationCenter component added to app.html"
else
  echo -e "${RED}✗${NC} NotificationCenter component NOT in app.html"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ $missing_files -eq 0 ]; then
  echo -e "${GREEN}✓ All files present!${NC}"
  echo ""
  echo "📝 Next Steps:"
  echo ""
  echo "1. Start your Angular development server:"
  echo "   npm start"
  echo ""
  echo "2. Open the app in your browser"
  echo ""
  echo "3. Test the notification system:"
  echo "   - Look for bell icon in bottom-left corner"
  echo "   - Generate a task (e.g., via AI chat)"
  echo "   - Check bell badge appears"
  echo "   - Click bell to open dropdown"
  echo "   - Click notification to navigate to task detail page"
  echo ""
  echo "4. For more info:"
  echo "   📖 Read: src/app/notifications/README.md"
  echo "   📖 Read: src/app/notifications/INTEGRATION_GUIDE.md"
  echo "   📖 Read: NOTIFICATION_SYSTEM_SUMMARY.md"
  echo ""
  echo "5. Browser Console Test:"
  echo "   - Open DevTools (F12)"
  echo "   - Check localStorage['app_notifications']"
  echo "   - Look for any console errors"
  echo ""
else
  echo -e "${RED}✗ $missing_files file(s) missing!${NC}"
  echo "Please ensure all files were created correctly."
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
