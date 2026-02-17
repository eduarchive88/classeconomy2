"use client"

import * as React from "react"
import { Moon, Sun, Laptop } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <div className="p-2 border rounded-lg w-10 h-10 flex items-center justify-center">
                <Sun className="h-[1.2rem] w-[1.2rem] text-slate-400" />
            </div>
        )
    }

    return (
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
                onClick={() => setTheme("light")}
                className={`p-1.5 rounded-md transition-colors ${theme === 'light' ? 'bg-white shadow-sm text-amber-500' : 'text-slate-400 hover:text-slate-600'}`}
                title="Light mode"
            >
                <Sun className="h-4 w-4" />
            </button>
            <button
                onClick={() => setTheme("dark")}
                className={`p-1.5 rounded-md transition-colors ${theme === 'dark' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-400' : 'text-slate-400 hover:text-slate-500'}`}
                title="Dark mode"
            >
                <Moon className="h-4 w-4" />
            </button>
            <button
                onClick={() => setTheme("system")}
                className={`p-1.5 rounded-md transition-colors ${theme === 'system' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-400 hover:text-slate-500'}`}
                title="System theme"
            >
                <Laptop className="h-4 w-4" />
            </button>
        </div>
    )
}
