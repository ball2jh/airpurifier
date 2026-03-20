// EPA AQI breakpoints for PM2.5 (24-hour average, but we use instantaneous)
export const PM25_BREAKPOINTS = [
  { cLow: 0, cHigh: 12.0, iLow: 0, iHigh: 50, category: 'Good', color: 'green', description: 'Air quality is satisfactory' },
  { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100, category: 'Moderate', color: 'yellow', description: 'Unusually sensitive people should limit outdoor exertion' },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150, category: 'Unhealthy for Sensitive Groups', color: 'orange', description: 'Sensitive groups may experience effects' },
  { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200, category: 'Unhealthy', color: 'red', description: 'Everyone may experience health effects' },
  { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300, category: 'Very Unhealthy', color: 'purple', description: 'Health alert: risk increased for everyone' },
  { cLow: 250.5, cHigh: 500.4, iLow: 301, iHigh: 500, category: 'Hazardous', color: 'maroon', description: 'Emergency conditions' },
];
