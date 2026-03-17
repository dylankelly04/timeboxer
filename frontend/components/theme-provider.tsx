"use client"
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps, useTheme as useNextTheme } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem={true}
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export function useTheme() {
  const { theme, setTheme } = useNextTheme()

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light")
  }

  return { theme: theme as "light" | "dark", toggleTheme }
}
