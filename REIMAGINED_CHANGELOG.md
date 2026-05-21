Reimagined Changelog

1.0.0

[ADDED] - Sistema de pedidos (tickets): users can request media content directly from the interface
[ADDED] - Ticket creation dialog, user list view, and admin management panel
[ADDED] - Real-time ticket status notifications via SSE
[ADDED] - Ticket status badge in the top app toolbar
[ADDED] - Backend server with SQLite, Jellyfin auth, Discord and SMTP notifications
[ADDED] - Admin email notification when a new content request is submitted
[ADDED] - Optional email notification to users when their request status changes, toggleable from the admin panel
[ADDED] - Notification settings page in the admin dashboard to configure the admin email, client notifications toggle, and test email delivery
[ADDED] - Favorites button in the experimental app toolbar
[ADDED] - Hero recommendation carousel on the home screen
[ADDED] - Recommendation engine with 7 personalised picks per session based on watch history
[ADDED] - "Ignore from Continue Watching" button on resume cards to remove an item from the resume list
[CHANGED] - Home screen section order: "Recentes" now appears before "Continuar assistindo"
[CHANGED] - "Recentes" sub-sections now always show Movies first, then TV Shows
[CHANGED] - App toolbar reorganised to accommodate new buttons
[CHANGED] - Ticket creation no longer asks the user for their email — it is resolved automatically from their registration profile
[CHANGED] - Hero carousel now displays a "Based on what you watch" label above the title for context
[CHANGED] - React Query Devtools are no longer included in production builds, keeping the bundle clean
[FIXED] - SSE ticket events endpoint no longer returns HTML in production when token validation fails or times out
