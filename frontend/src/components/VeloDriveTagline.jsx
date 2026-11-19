import React, { useState, useEffect } from 'react';

const taglines = [
  "VeloDrive: How far will you take me to my destination?",
  "VeloDrive: What are the places and tourist spots destination will you take me?",
  "VeloDrive: How long is the distance would be to get me into you?",
  "VeloDrive: Tell me what will I do to be with you in a long and winding road that never ends?"
];

export default function VeloDriveTagline() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % taglines.length);
    }, 5000); // Rotates every 5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-center my-3 px-4">
      <p className="text-sm md:text-base font-medium text-blue-200/90 italic transition-all duration-700">
        "{taglines[currentIndex]}"
      </p>
    </div>
  );
}