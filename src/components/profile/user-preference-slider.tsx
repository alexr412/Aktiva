import React, { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * UI-Spezifikation für das Profil:
 * Komponente: Linearer Slider.
 * Farbskala: Bipolarer Gradient (Links: Rot / Rechts: Grün).
 * Skala: Diskrete Werte 0.1 bis 3.0.
 * Mittelpunkt: Wert 1.0 (Standard-Neutralstellung).
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
  const discreteValues = [0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 2.5, 3.0];
  
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = discreteValues.indexOf(initialValue);
    if (idx !== -1) return idx;
    if (initialValue < 1.0) return 0;
    if (initialValue > 1.0) return 8;
    return 4;
  });

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    setCurrentIndex(index);
    const newValue = discreteValues[index];
    onChange(tagKey, newValue);
  };

  const currentValue = discreteValues[currentIndex];
  const displayScore = currentIndex - 4; // Mapped to -4 to +4 scale

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-[1.5rem] p-5 border border-slate-200 dark:border-neutral-800 transition-all group shadow-none">
      <div className="flex justify-between items-center mb-4">
        <span className="font-black text-[#0f172a] dark:text-neutral-100 tracking-tight text-sm uppercase leading-none">{label}</span>
        <div className={cn(
            "px-3 py-1 rounded-lg text-[11px] font-black tracking-widest transition-colors",
            displayScore < 0 ? "bg-rose-500 text-white" : 
            displayScore > 0 ? "bg-emerald-500 text-white" : 
            "bg-slate-100 text-slate-500"
        )}>
          {displayScore > 0 ? `+${displayScore}` : displayScore}
        </div>
      </div>
      
      <div className="relative h-6 flex items-center px-0">
          {/* Track Background - Edge aligned */}
          <div className="absolute inset-x-0 h-2 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
              {/* Highlight Fill */}
              <div 
                  className={cn(
                      "absolute top-0 bottom-0 transition-all duration-500 ease-out",
                      currentIndex < 4 ? "bg-rose-500" : 
                      currentIndex > 4 ? "bg-emerald-500" : 
                      "bg-transparent"
                  )}
                  style={{
                      left: currentIndex < 4 ? `${(currentIndex / 8) * 100}%` : '50%',
                      right: currentIndex > 4 ? `${100 - (currentIndex / 8) * 100}%` : '50%',
                      width: currentIndex === 4 ? '0' : 'auto'
                  }}
              />
          </div>
          
          <input 
            type="range" 
            min={0} 
            max={8} 
            step={1}
            value={currentIndex} 
            onChange={handleSliderChange}
            className="absolute inset-x-0 appearance-none bg-transparent cursor-pointer z-10 w-full h-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-slate-300 [&::-webkit-slider-thumb]:shadow-none [&::-webkit-slider-thumb]:active:scale-110 [&::-webkit-slider-thumb]:transition-transform"
          />
      </div>
    </div>
  );
};

