# Game Hub

A collection of fun brain games built with Next.js and TypeScript.

## Games

- **24 Game**: Use 4 numbers and basic arithmetic to make 24
- **More games coming soon!**

## Features

- Mobile-first responsive design
- Clean, modern UI with smooth animations
- Real-time game logic with optimized performance
- Timer and scoring system
- Accessibility features
- Progressive Web App ready

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Analytics**: Vercel Analytics
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd game-hub

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play!

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── games/          # Game pages
│   ├── leaderboards/   # Leaderboards page
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/         # React components
│   └── Game24.tsx     # 24 Game component
└── lib/               # Utility libraries
    └── solver24.ts    # 24 Game solver algorithm
```

## Live Site

Visit: [https://sfjc.dev](https://sfjc.dev)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License
