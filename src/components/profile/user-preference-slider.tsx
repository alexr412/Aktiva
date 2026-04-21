import React, { useState } from 'react';

/**
 * UI-Spezifikation für das Profil:
 * Komponente: Linearer Slider.
 * Farbskala: Bipolarer Gradient (Links: Rot / Rechts: Grün).
 * Skala: Diskrete Werte -5, -4, -3, -2, 1, 2, 3, 4, 5.
 * Mittelpunkt: Wert 1 (Standard-Neutralstellung).
 * Mapping: Die Slider-Position korrespondiert direkt mit dem Multiplikator w_i in der Datenbank.
 */

interface UserPreferenceSliderProps {
  label: string;
  tagKey: string;
  initialValue?: number;
  onChange: (tagKey: string, newValue: number) => void;
}

export const UserPreferenceSlider: React.FC<UserPreferenceSliderProps> = ({ 
  label, 
  tagKey, 
  initialValue = 1.0, 
  onChange 
}) => {
  // Das Array umfasst exakt die 9 vordefinierten diskreten Werte (Multiplikatoren)
  const discreteValues = [0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  
  // Index 4 entspricht dem neutralen Wert "1.0"
  const [currentIndex, setCurrentIndex] = useState(() => {
    // Wenn in der Datenbank alte Werte (z.B. -5) stehen, mappen wir sie temporär auf Neutral (1.0) oder fangen sie ab
    const idx = discreteValues.indexOf(initialValue);
    if (idx !== -1) return idx;
    
    // Legacy Fallback (alte -5 bis +5 Werte auf den neuen Index mappen, falls noch existent)
    if (initialValue < 0) return 0; // Extrem negativ -> 0.1
    if (initialValue > 2.0) return 8; // Extrem positiv -> 2.0
    return 4; // Fallback Neutral
  });

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    setCurrentIndex(index);
    const newValue = discreteValues[index];
    onChange(tagKey, newValue);
  };

  const currentValue = discreteValues[currentIndex];

  const backgroundStyle = {
    background: 'linear-gradient(to right, #ef4444, #9ca3af, #22c55e)',
    height: '8px',
    borderRadius: '4px',
    outline: 'none',
    width: '100%',
    appearance: 'none' as const
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm mb-6 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div className="flex justify-between items-center text-sm">
        <span className="font-semibold text-gray-800 dark:text-gray-200">{label}</span>
        <span className={`font-mono px-2 py-1 rounded text-xs font-bold ${currentValue < 1.0 ? 'bg-red-50 text-red-600 dark:bg-red-900/30' : currentValue > 1.0 ? 'bg-green-50 text-green-600 dark:bg-green-900/30' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
          w = {currentValue.toFixed(2)}x
        </span>
      </div>
      
      <div className="relative w-full py-2">
        <input 
          type="range" 
          min={0} 
          max={8} 
          step={1}
          value={currentIndex} 
          onChange={handleSliderChange}
          className="cursor-pointer"
          style={backgroundStyle}
        />
      </div>
      
      <div className="flex justify-between text-[10px] text-gray-500 uppercase font-semibold tracking-wider">
        <span className="text-red-500">Abneigung</span>
        <span className="text-gray-400 ml-3">Neutral</span>
        <span className="text-green-500">Favorit</span>
      </div>
    </div>
  );
};
