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
[ADDED] - "Report content issue" button on item detail page to alert the admin via email about playback problems and log reports in a dedicated admin dashboard
[CHANGED] - Home screen section order: "Recentes" now appears before "Continuar assistindo"
[CHANGED] - "Recentes" sub-sections now always show Movies first, then TV Shows
[CHANGED] - App toolbar reorganised to accommodate new buttons
[CHANGED] - Ticket creation no longer asks the user for their email — it is resolved automatically from their registration profile
[CHANGED] - Hero carousel now displays a "Based on what you watch" label above the title for context
[CHANGED] - React Query Devtools are no longer included in production builds, keeping the bundle clean
[CHANGED] - Dev server build process and configuration to avoid compilation hangs on Windows
[CHANGED] - Profile avatar icon size and spacing in the top toolbar to look more proportional
[CHANGED] - User view navigation buttons hover and active states to be theme-aware and prevent white/harsh hover backgrounds
[FIXED] - SSE ticket events endpoint no longer returns HTML in production when token validation fails or times out
[FIXED] - Content reports for series episodes now show the series name and season/episode numbers (e.g. Series - S01E01 - Title) in the title instead of only the episode name.
[FIXED] - Admin email notifications for tickets and reports now fallback to SMTP_ADMIN_EMAIL or SMTP_USER if the admin email setting is not configured.
