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

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-5 shadow-lg shadow-slate-200/30 dark:shadow-none border border-slate-100 dark:border-neutral-800 transition-all group">
      <div className="flex justify-between items-center mb-5">
        <span className="font-black text-[#0f172a] dark:text-neutral-100 tracking-tight text-base uppercase leading-none">{label}</span>
        <div className={cn(
            "px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest shadow-sm transition-colors",
            currentValue < 1.0 ? "bg-rose-500 text-white" : 
            currentValue > 1.0 ? "bg-emerald-500 text-white" : 
            "bg-slate-100 text-slate-500"
        )}>
          {currentValue.toFixed(2)}x
        </div>
      </div>
      
      <div className="relative h-10 flex items-center px-1">
          {/* Track Background */}
          <div className="absolute inset-x-0 h-2.5 rounded-full bg-slate-200 dark:bg-neutral-800 overflow-hidden shadow-inner">
              {/* Highlight Fill */}
              <div 
                  className={cn(
                      "absolute top-0 bottom-0 transition-all duration-500 ease-out",
                      currentIndex < 4 ? "bg-gradient-to-l from-rose-200 to-rose-500" : 
                      currentIndex > 4 ? "bg-gradient-to-r from-emerald-200 to-emerald-500" : 
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
            className="absolute inset-x-0 appearance-none bg-transparent cursor-pointer z-10 w-full h-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[2px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[0_2px_10px_rgba(0,0,0,0.15)] [&::-webkit-slider-thumb]:active:scale-110 [&::-webkit-slider-thumb]:transition-transform"
          />
      </div>
      
      <div className="flex justify-between px-1 mt-3">
        <span className={cn("text-[9px] font-black uppercase tracking-widest transition-colors", currentIndex < 4 ? "text-rose-500" : "text-slate-400")}>Abneigung</span>
        <span className={cn("text-[9px] font-black uppercase tracking-widest transition-colors", currentIndex === 4 ? "text-slate-600" : "text-slate-400")}>Neutral</span>
        <span className={cn("text-[9px] font-black uppercase tracking-widest transition-colors", currentIndex > 4 ? "text-emerald-500" : "text-slate-400")}>Favorit</span>
      </div>
    </div>
  );
};

