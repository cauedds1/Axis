# AXIS - Assistente de Vida Pessoal

## Overview
AXIS is a multi-tenant SaaS personal life assistant designed to streamline personal organization through voice and text input. It manages finances (expenses, income, goals), offers a smart agenda with AI suggestions, organizes tasks, tracks habits, and provides a contextual chatbot with long-term memory. The project aims to provide a comprehensive, intuitive, and AI-powered tool for personal management, with a strong focus on ease of use and intelligent automation.

## User Preferences
Not specified.

## System Architecture
**Frontend**: Built with React, Vite, TailwindCSS, shadcn/ui, wouter for routing, TanStack Query for data fetching, and Framer Motion for animations.
**Backend**: Developed using Express.js and TypeScript.
**Database**: PostgreSQL, managed with Drizzle ORM.
**File Storage**: S3-compatible storage (Cloudflare R2 recommended) for images, with a base64 fallback.
**AI**: Integrates OpenAI via Replit AI for transcription, intent detection, document analysis (receipts, PDFs), and contextual chat.
**Authentication**: Native email/password system using bcrypt and express-session.
**Theming**: Features an 8-palette system (4 Slim, 4 High) with dynamic CSS variables for consistent theming across the application and a separate theme system for the landing page.
**UI/UX Decisions**:
- Dual input (voice and text) for all interactions.
- AI-driven intent detection for natural language processing of financial and scheduling commands.
- AI-powered extraction from receipt photos and PDF documents (bank statements, bills) to automate data entry and classification.
- Smart agenda with AI-suggested time slots requiring user approval.
- Habit tracking with streaks and a visible discipline score.
- Contextual chatbot with access to all user data for personalized assistance.
- Conversational onboarding process (basics, current state, ambition, AI personality) and module selection.
- Comprehensive reports page with financial, task, habit, and schedule data visualizations using Recharts.
- Robust bills management system including recurrence, payment tracking, and summary cards.
- Credit card management with automatic bill generation and installment tracking.
- Design principles emphasize a clean aesthetic without AI visual clichés, progressive disclosure, and full responsiveness.
- The interface is entirely in Portuguese (pt-BR).

**AXIS Business Module**: A dedicated corporate expense management system at `/business` for managing expenses, approvals, and reports, featuring WhatsApp-based submission.
- **Business Features**: Organization management with spending limits, member roles, and a dedicated business theme system.
- **Collaborator Accounts**: A specific account type for team members with restricted access and a separate login flow.
- **Reporting**: Detailed reports with filtering and export capabilities.

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **S3-compatible Storage**: For storing user-uploaded files, such as receipt images.
- **OpenAI**: For various AI functionalities including transcription, intent detection, document analysis, and chatbot services.
- **SendGrid**: For sending email alerts and notifications.
- **WhatsApp (Baileys)**: For WhatsApp bot integration, including session persistence.