import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Terskel - Endurance Training',
    short_name: 'Terskel',
    description: 'Track your endurance training with metabolic blood value tracking and step test analysis',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#1e40af',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['fitness', 'health', 'sports'],
    screenshots: [],
    shortcuts: [
      {
        name: 'New Training',
        short_name: 'Training',
        url: '/trainings/new',
        description: 'Log a new training session',
      },
      {
        name: 'Step Test',
        short_name: 'Test',
        url: '/step-test/new',
        description: 'Start a new step test',
      },
    ],
  }
}
