/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        f1Blue: "#0077C8",
        f1Red: "#FF0000",
      },
      maxWidth: {
        '8xl': '88rem',
      },
      spacing: {
        '18': '4.5rem',
        '112': '28rem',
        '128': '32rem',
      },
      typography: {
        DEFAULT: {
          css: {
            a: {
              color: "#0077C8",
              "&:hover": {
                color: "#0056b3",
              },
            },
            h1: {
              color: "#0077C8",
            },
            h2: {
              color: "#0077C8",
            },
            h3: {
              color: "#0077C8",
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} 