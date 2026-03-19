import { createContext, useContext, useState, useEffect } from 'react';

export function toFahrenheit(celsius) {
  if (celsius == null) return null;
  return (celsius * 9 / 5) + 32;
}

export function convertTemp(celsius, unit) {
  if (celsius == null) return null;
  return unit === 'F' ? (celsius * 9 / 5) + 32 : celsius;
}

export function tempUnit(unit) {
  return unit === 'F' ? '°F' : '°C';
}

const TemperatureUnitContext = createContext({ unit: 'F', setUnit: () => {} });

export function TemperatureUnitProvider({ children }) {
  const [unit, setUnit] = useState(() => {
    try { return localStorage.getItem('tempUnit') || 'F'; }
    catch { return 'F'; }
  });

  useEffect(() => {
    try { localStorage.setItem('tempUnit', unit); }
    catch {}
  }, [unit]);

  return (
    <TemperatureUnitContext.Provider value={{ unit, setUnit }}>
      {children}
    </TemperatureUnitContext.Provider>
  );
}

export function useTemperatureUnit() {
  return useContext(TemperatureUnitContext);
}
