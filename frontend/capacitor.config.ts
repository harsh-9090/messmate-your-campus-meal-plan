import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.momskitchen.messmate',
  appName: 'Mom\'s Kitchen',
  webDir: 'dist',
  server: {
    url: 'https://messmate-your-campus-meal-plan.onrender.com',
    cleartext: true
  }
};

export default config;
