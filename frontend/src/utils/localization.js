// src/utils/localization.js

export const detectUserPreferences = () => {
  // 1. Get browser language (e.g., 'en-PH', 'en-US')
  const locale = navigator.language || 'en-PH';

  // 2. Request Geolocation for location-aware vehicle filtering
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Save to state, localStorage, or send to your backend API
        localStorage.setItem('userLocation', JSON.stringify({ latitude, longitude }));
      },
      () => {
        console.log('Location access denied or not available.');
      },
      { timeout: 10000 }
    );
  }

  return locale;
};