# FAZAI - Simple Accounting

A modern, simple accounting Progressive Web App (PWA) built with Next.js 16, React 19, and TypeScript. Features a double-entry ledger engine, AI-powered financial assistant, and comprehensive financial reporting.

![Version](https://img.shields.io/badge/version-0.4.3-red.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black.svg)
![React](https://img.shields.io/badge/React-19.0.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)

## 🌟 Features

### Core Accounting
- **Double-Entry Ledger Engine** - Professional accounting with balanced journal entries
- **Multi-Account Support** - Track assets, liabilities, income, expenses, and equity
- **Transaction Management** - Record, view, and delete financial transactions
- **Custom Entry Forms** - Multi-row journal entry with auto-balancing suggestions

### Financial Reports
- **Trial Balance** - Point-in-time account balances
- **Balance Sheet** - Assets, liabilities, and equity snapshot
- **Profit & Loss** - Income and expense analysis over periods
- **Cash Flow Statement** - Cash movement tracking
- **Ledger View** - Detailed transaction history by account
- **Period Range Selection** - MTD (Month-to-Date), YTD (Year-to-Date), custom ranges

### AI Assistant
- **Smart Transaction Recording** - Natural language to journal entries
- **Financial Queries** - Ask questions like "How much did I spend this month?"
- **Delete Transactions** - Remove entries via chat commands
- **Financial Insights** - Get analysis and recommendations
- **Counter Account Selection** - Choose cash/bank accounts for transactions

### User Experience
- **PIN-Based Authentication** - Quick and secure login
- **Responsive Design** - Mobile-first PWA with bottom navigation
- **Dark/Light Theme** - Toggle between themes seamlessly
- **Multi-Language Support** - English, Indonesian, Chinese (i18n ready)
- **Offline Capable** - Service worker with intelligent caching
- **Installable** - Add to home screen on mobile/desktop

### Admin Panel
- **Account Management** - Create, edit, toggle accounts
- **User Management** - Manage PIN access
- **Backup & Restore** - Export/import financial data
- **Custom Reports** - Configure report settings

## 🎨 Design System

### Color Theme (FAZAI Brand)
- **Red** (#DC2626) - Primary action, income, active states
- **White/Gray** - Expense, secondary elements
- **Black** - Text and primary content
- **Gold/Amber** - Accents, confirmed states, special indicators

### UI Components
- Built with [Radix UI](https://www.radix-ui.com/) primitives
- Styled with [Tailwind CSS v4](https://tailwindcss.com/)
- Animated with [Framer Motion](https://www.framer.com/motion/)
- Icons from [Lucide React](https://lucide.dev/)

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 16.1.1 (App Router) |
| **Language** | TypeScript 5.x |
| **UI Library** | React 19.0.0 |
| **Styling** | Tailwind CSS v4 + PostCSS |
| **Database** | Dexie.js (IndexedDB wrapper) |
| **State Management** | Zustand 5.0.6 |
| **Testing** | Vitest 4.1.8 + Testing Library |
| **Linting** | ESLint 9 + Next.js config |
| **Runtime** | Bun / Node.js 20+ |
| **PWA** | Manual Service Worker + manifest.json |

## 📦 Installation

### Prerequisites
- Node.js >= 20.0.0
- Bun (recommended) or npm/yarn/pnpm

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd fazai

# Install dependencies
bun install

# Copy environment file (if needed)
cp .env.example .env  # Optional: FAZAI uses Dexie.js, no server DB required
```

## 🚀 Development

```bash
# Start development server
bun run dev

# Run linter
bun run lint

# Run tests
bun run test
```

The app will be available at `http://localhost:3000`

## 🏗️ Building for Production

### Standard Build
```bash
bun run build
bun run start
```

### Standalone Build (Recommended for Deployment)
```bash
# Create standalone production build
bun run build:standalone

# Run standalone server
bun run start:standalone
```

The standalone build includes everything needed in `.next/standalone/` for easy deployment.

### GitHub Pages Build
```bash
bun run build:ghpages
```

## 📁 Project Structure

```
fazai/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── api/              # API routes
│   │   │   └── ai/           # AI endpoints (chat, context, suggest)
│   │   ├── globals.css       # Global styles + Tailwind
│   │   ├── layout.tsx        # Root layout with theme provider
│   │   └── page.tsx          # Main app shell with ErrorBoundary
│   ├── components/
│   │   ├── fazai/            # Core FAZAI components
│   │   │   ├── admin-*.tsx   # Admin panel components
│   │   │   ├── ai-chat.tsx   # AI assistant interface
│   │   │   ├── dashboard.tsx # Main dashboard
│   │   │   ├── history.tsx   # Transaction history
│   │   │   ├── reports.tsx   # Report selector
│   │   │   ├── report-viewer.tsx  # Report display
│   │   │   ├── settings.tsx  # Settings panel
│   │   │   └── transaction-form.tsx  # Entry form
│   │   └── ui/               # Reusable UI components
│   ├── lib/
│   │   ├── format.ts         # Date/number formatting utilities
│   │   ├── i18n.ts           # Internationalization strings
│   │   ├── ledger-engine.ts  # Double-entry accounting logic
│   │   └── utils.ts          # General utilities
│   └── stores/
│       └── app-store.ts      # Zustand state management
├── public/                   # Static assets
│   ├── manifest.json         # PWA manifest
│   └── *.png                 # Icons and images
├── .zscripts/                # Deployment scripts
│   ├── build.sh              # Production build script
│   └── start.sh              # Server startup script
├── scripts/                  # Utility scripts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── worklog.md                # Development changelog
```

## 🔌 API Endpoints

### AI Assistant
- `POST /api/ai/chat` - Chat with AI assistant (transaction recording, queries, insights)
- `GET /api/ai/context` - Get formatted financial context for LLM
- `POST /api/ai/suggest` - Get account suggestions for transactions

## 🧪 Testing

```bash
# Run all tests
bun run test

# Watch mode
bun run test:watch
```

Test coverage includes:
- Ledger engine calculations
- Date formatting utilities
- Component rendering
- API route handlers

## 🌍 Internationalization

Currently supports:
- **English** (default)
- **Indonesian** (Bahasa Indonesia)
- **Chinese** (简体中文)

Translations are managed in `src/lib/i18n.ts`. To add a new language, extend the `TRANSLATIONS` object.

## 📱 PWA Features

- **Service Worker** - Cache-first for static assets, network-first for API
- **Manifest** - Installable on iOS/Android/Desktop
- **Offline Support** - Core functionality works without internet
- **Theme Color** - Red (#DC2626) status bar on mobile

## 🔐 Security Notes

Current implementation is designed for personal/single-user use:
- PIN authentication (client-side)
- No API rate limiting
- No server-side authentication
- Data stored in browser IndexedDB

For production multi-user deployments, consider adding:
- Server-side authentication (JWT/OAuth)
- API rate limiting
- Encrypted data storage
- HTTPS enforcement

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private software. All rights reserved.

## 📞 Support

For issues and feature requests, please open an issue on the repository.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - The React Framework
- [Vercel](https://vercel.com/) - Deployment platform
- [Radix UI](https://www.radix-ui.com/) - Accessible UI primitives
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Dexie.js](https://dexie.org/) - IndexedDB wrapper
- [Zustand](https://zustand-demo.pmnd.rs/) - State management
- [Framer Motion](https://www.framer.com/motion/) - Animations

---

**FAZAI** - Modern simple accounting for everyone. 📊✨
