# Notification System - Architecture Overview

## System Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                           │
│                                                                    │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐  │
│  │   AI Chat Service    │  │    Other Services/Components     │  │
│  │  (notification       │  │  (can trigger notifications)     │  │
│  │   trigger source)    │  │                                  │  │
│  └──────────┬───────────┘  └────────────────┬─────────────────┘  │
│             │                               │                    │
│             └───────────────┬───────────────┘                    │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   NOTIFICATION SERVICE                              │
│                  (State Management Layer)                           │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  • Manage notification state (BehaviorSubject)               │  │
│  │  • localStorage persistence                                 │  │
│  │  • Desktop notifications API wrapper                        │  │
│  │  • Sound generation (Web Audio API)                         │  │
│  │  • Context awareness (prevent duplicate notifications)      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Public API:                                                        │
│  • addNotification(payload)      → Create new notification         │
│  • markAsRead(id)                → Mark single as read             │
│  • markAllAsRead()               → Mark all as read                │
│  • deleteNotification(id)        → Remove notification             │
│  • clearAllNotifications()       → Remove all                      │
│  • setCurrentPageTaskId(id)      → Set page context               │
│  • notifications$:Observable     → All notifications              │
│  • unreadCount$:Observable       → Unread count                   │
│                                                                     │
│  Storage: localStorage['app_notifications']                        │
│  Max: 50 notifications                                             │
│  Persistence: Automatic                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ↓             ↓             ↓
        ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐
        │ localStorage│ │ Desktop      │ │ Web Audio API       │
        │ API         │ │ Notification │ │ (Sound playback)    │
        │             │ │ API          │ │                     │
        └─────────────┘ └──────────────┘ └─────────────────────┘
                              │
                              ↓
                    ┌──────────────────────┐
                    │   Browser APIs       │
                    │  - localStorage      │
                    │  - Notifications     │
                    │  - AudioContext      │
                    └──────────────────────┘


┌────────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER (UI)                         │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              NotificationCenter Component                    │ │
│  │     (Main container, manages open/close state)              │ │
│  │                                                              │ │
│  │  ┌─────────────────────┐  ┌──────────────────────────────┐ │ │
│  │  │ NotificationBell    │  │  NotificationDropdown        │ │ │
│  │  │                     │  │                              │ │ │
│  │  │ ┌───────────────┐   │  │  ┌────────────────────────┐  │ │ │
│  │  │ │ Bell Icon     │   │  │  │ Notification Items     │  │ │ │
│  │  │ │ (animated)    │   │  │  │                        │  │ │ │
│  │  │ └───────────────┘   │  │  │ • Title & Message      │  │ │ │
│  │  │                     │  │  │ • Timestamp            │  │ │ │
│  │  │ ┌───────────────┐   │  │  │ • Delete button        │  │ │ │
│  │  │ │ Badge Counter │   │  │  │ • Unread indicator     │  │ │ │
│  │  │ │ (Shows N)     │   │  │  │                        │  │ │ │
│  │  │ └───────────────┘   │  │  └────────────────────────┘  │ │ │
│  │  │                     │  │                              │ │ │
│  │  │ Position:           │  │  • Header with title         │ │ │
│  │  │ Fixed               │  │  • Clear all button          │ │ │
│  │  │ Bottom-left corner  │  │  • Empty state message       │ │ │
│  │  │ 20px from edges     │  │                              │ │ │
│  │  │                     │  │  Position:                   │ │ │
│  │  │ Click: Toggle       │  │  Fixed                       │ │ │
│  │  │ dropdown panel      │  │  Above bell                  │ │ │
│  │  │                     │  │  380px wide / 500px max-h    │ │ │
│  │  └─────────────────────┘  └──────────────────────────────┘ │ │
│  │                                                              │ │
│  │  Subscribed Observables:                                   │ │
│  │  • notifications$ → displays in dropdown                   │ │
│  │  • unreadCount$   → shows in badge                         │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌──────────────────────┐
                    │  Router Navigation   │
                    │  /tasks/:taskId      │
                    └──────────────────────┘
                              │
                              ↓
                    ┌──────────────────────┐
                    │  TaskDetail Page     │
                    │  (Shows task content)│
                    └──────────────────────┘
```

## Data Flow

```
CREATION FLOW:
═════════════

Service calls generateContent()
           ↓
API request completes
           ↓
NotificationService.addNotification()
           ↓
    ┌─────┴──────┬──────────┬──────────┐
    │            │          │          │
    ↓            ↓          ↓          ↓
Update    Save to   Emit     Show
Observable localStorage Observable Desktop
           |        Notification
           └────────────────┘


INTERACTION FLOW:
════════════════

User sees bell icon
           ↓
Clicks bell
           ↓
Dropdown opens (animation)
           ↓
Views notification list
           ↓
Clicks a notification
           ↓
    ┌─────┴──────┬──────────┐
    │            │          │
    ↓            ↓          ↓
Mark as   Navigate to  Emit
Read      /tasks/:id   event
           ↓
Task Detail page loads


PERSISTENCE FLOW:
═════════════════

Notification created
           ↓
Stored in notifications$ Observable
           ↓
Serialized to JSON
           ↓
Saved to localStorage
           ↓
═════ Browser closes/reopens ═════
           ↓
App loads
           ↓
NotificationService initializes
           ↓
Reads localStorage
           ↓
Deserializes JSON
           ↓
Restores notifications$
           ↓
UI updates with restored notifications
```

## Component Hierarchy

```
App (root)
│
├─ Header with navbar
├─ Router outlet (main content)
│
└─ NotificationCenter (fixed position, bottom-left)
   │
   ├─ NotificationBell
   │  ├─ Icon (animated when ringing)
   │  └─ Badge (red circle with count)
   │
   └─ NotificationDropdown (visible when open)
      ├─ Header
      │  ├─ Title
      │  └─ Clear all button
      │
      ├─ Divider
      │
      ├─ Notification items (scrollable list)
      │  └─ For each notification:
      │     ├─ Icon (green background circle)
      │     ├─ Content
      │     │  ├─ Title
      │     │  ├─ Message
      │     │  └─ Timestamp
      │     ├─ Delete button
      │     └─ Unread indicator (dot)
      │
      └─ Empty state (when no notifications)
         ├─ Icon
         └─ Message
```

## State Management Pattern

```
NotificationService (RxJS)
│
├─ Private state:
│  ├─ notificationsSubject: BehaviorSubject<Notification[]>
│  ├─ unreadCountSubject: BehaviorSubject<number>
│  └─ currentPageTaskIdSubject: BehaviorSubject<string | null>
│
└─ Public observables:
   ├─ notifications$ → Components subscribe for list updates
   ├─ unreadCount$ → Components subscribe for badge updates
   └─ currentPageTaskId$ → Components check context
```

## Notification Object Structure

```typescript
{
  id: "notif-1681234567890-abc123def",        // Unique ID
  title: "Tâche générée",                     // Notification title
  message: "Contenu généré pour...",          // Description
  taskId: "task_1681234567890",               // Link to task
  read: false,                                // Read status
  createdAt: "2024-04-14T10:30:00.000Z",     // ISO timestamp
  icon: "check_circle"                        // Material icon name
}
```

## Integration Points

```
AIChatService
│
├─ generateContent()
│  └─ On success: notificationService.addNotification()
│
└─ sendMessage()
   └─ On success: notificationService.addNotification()


Other Services
│
└─ Can inject NotificationService and call addNotification()


Components
│
├─ Task detail page
│  ├─ ngOnInit: setCurrentPageTaskId(taskId)
│  └─ ngOnDestroy: setCurrentPageTaskId(null)
│
└─ Can subscribe to notifications$, unreadCount$
```

## Browser APIs Used

```
1. localStorage
   ├─ Store key: "app_notifications"
   ├─ Format: JSON array
   └─ Max size: ~50 notifications (~50KB)

2. Notification API (Desktop)
   ├─ Request permission: Notification.requestPermission()
   ├─ Create notification: new Notification(title, options)
   └─ Click handler: notification.onclick

3. Web Audio API
   ├─ AudioContext: for sound generation
   ├─ Oscillator: 800Hz sine wave
   └─ Duration: 500ms fade out

4. Router
   ├─ Navigate: router.navigate(['/tasks', taskId])
   └─ Current route: ActivatedRoute.params
```

## Animation Details

```
Bell Ring Animation:
│
├─ Trigger condition: unreadCount > 0
├─ Duration: 1.5 seconds (3 rotations × 0.5s each)
├─ Keyframes:
│  ├─ 0% → rotate(0deg)
│  ├─ 15% → rotate(15deg)
│  ├─ 30% → rotate(-15deg)
│  ├─ 45% → rotate(15deg)
│  ├─ 60% → rotate(-15deg)
│  ├─ 75% → rotate(15deg)
│  └─ 100% → rotate(0deg)
│
├─ Auto-reset after 1.5s
└─ Can ring multiple times for multiple notifications


Dropdown Slide Animation:
│
├─ On open: slideUp 0.3s ease
├─ Keyframes:
│  ├─ From: translateY(+10px), opacity(0)
│  └─ To: translateY(0), opacity(1)
│
└─ On open: fadeIn 0.2s ease (backdrop)


Badge Pop Animation:
│
├─ When visible: scale(1)
├─ When hidden: scale(0)
└─ Transition: 0.3s ease
```

## Performance Characteristics

```
Memory Usage:
├─ NotificationService: ~1-2 KB
├─ Each notification object: ~200-300 bytes
├─ 50 notifications: ~10-15 KB in memory
└─ localStorage: ~50 KB (max 50 notifications)

CPU Usage:
├─ Observable updates: Only on changes (Rx optimization)
├─ Animation frame rate: 60 FPS (smooth)
├─ Sound generation: ~10ms per notification
└─ DOM updates: Minimal (using async pipe)

Network:
├─ Desktop notification: 0 bytes (local)
├─ Sound: 0 bytes (generated, not downloaded)
└─ No additional HTTP requests
```

## Error Handling Strategy

```
localStorage Full/Unavailable
│
├─ Graceful degradation
├─ Keeps notifications in memory
├─ In-app notifications still work
└─ Desktop notifications still work

Desktop Notification Denied
│
├─ Service catches error silently
├─ In-app notifications work fine
└─ User can still see bell and dropdown

Audio Context Blocked
│
├─ Try/catch silently fails
├─ Everything else works
└─ No error shown to user

Browser not supporting feature
│
└─ Uses feature detection (if 'Notification' in window)
```

## Security Considerations

```
HTTPS Requirement:
├─ Desktop notifications require HTTPS in production
├─ localStorage works on HTTP (not recommended for sensitive data)
└─ SOP (Same-Origin Policy) enforced by browser

XSS Protection:
├─ No eval() used
├─ No innerHTML with user input
├─ Angular sanitization on templates
└─ Material components sanitize by default

Data Storage:
├─ localStorage is domain-specific
├─ No sensitive data stored (just task references)
├─ Max 50 notifications (auto-cleanup)
└─ User can clear browser data anytime
```

## Scalability Notes

```
Can Handle:
├─ 50+ concurrent notifications (auto-cleanup)
├─ Multiple rapid notifications (queued properly)
├─ Long-running app sessions (no memory leaks)
├─ Desktop notifications API limits (OS-dependent)
└─ localStorage size limits (~5-10MB in most browsers)

Limitations:
├─ Max 50 notifications stored (by design)
├─ Desktop notification count (OS feature limited)
├─ localStorage available space varies by browser
└─ Sound plays only once per notification

Future Improvements:
├─ Service Worker for persistent notifications
├─ Backend API for cloud notification storage
├─ Notification categories/filtering
├─ User preference UI
└─ Real-time updates via WebSocket
```

---

**This diagram shows how all components work together to provide a seamless notification experience.**
