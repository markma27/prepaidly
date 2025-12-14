import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#6d69ff",
          50: "#f0f0ff",
          100: "#e0e0ff",
          200: "#c7c7ff",
          300: "#a5a5ff",
          400: "#6d69ff",
          500: "#5a56e6",
          600: "#4a46cc",
          700: "#3d39b3",
          800: "#333099",
          900: "#2a2880",
        },
        dark: {
          DEFAULT: "#28273d",
          50: "#f5f5f7",
          100: "#e8e8eb",
          200: "#d1d1d7",
          300: "#b0b0ba",
          400: "#888896",
          500: "#6b6b7a",
          600: "#565664",
          700: "#474753",
          800: "#3d3d47",
          900: "#28273d",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;

