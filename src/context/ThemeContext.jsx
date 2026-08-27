import { createContext, useContext, useEffect, useState } from 'react';
const ThemeContext = createContext(null);
export function ThemeProvider({children}){
  const [theme,setTheme]=useState(()=>localStorage.getItem('mvec_theme')||'light');
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('mvec_theme',theme)},[theme]);
  const toggleTheme=()=>setTheme(t=>t==='dark'?'light':'dark');
  return <ThemeContext.Provider value={{theme,toggleTheme}}>{children}</ThemeContext.Provider>
}
export const useTheme=()=>useContext(ThemeContext);
