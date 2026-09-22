/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#4648d4",
        secondary: "#674bb5",
        tertiary: "#006c49",
        background: "#f7f9fb",
        surface: "#f7f9fb",
        "on-surface": "#191c1e",
        "on-surface-variant": "#464554",
        "outline-variant": "#c7c4d7",
        "primary-fixed": "#e1e0ff",
        "secondary-fixed": "#e8ddff",
        "tertiary-fixed": "#6ffbbe",
        "surface-container-high": "#e6e8ea",
        "surface-container-low": "#f2f4f6",
      },
      spacing: {
        "margin-desktop": "48px",
        "margin-mobile": "16px",
        gutter: "24px",
      },
      fontFamily: {
        sans: ["Lexend", "sans-serif"],
        headline: ["Lexend", "sans-serif"],
      },
    },
  },
  plugins: [],
}