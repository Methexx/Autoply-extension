import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Autoply',
  version: '0.1.0',
  description: 'AI-drafted job application answers, reviewed by you before anything is submitted.',
  action: {
    default_title: 'Autoply: fill this application',
    default_icon: {
      '16': 'icons/16.png',
      '48': 'icons/48.png',
      '128': 'icons/128.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  options_page: 'src/options/index.html',
  permissions: ['storage', 'activeTab', 'scripting'],
  host_permissions: ['https://generativelanguage.googleapis.com/*'],
  icons: {
    '16': 'icons/16.png',
    '48': 'icons/48.png',
    '128': 'icons/128.png',
  },
})
