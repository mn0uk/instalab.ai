/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fu: {
          bg: "#F0F0EC",
          card: "#FFFFFF",
          border: "#D8D8D4",
          text: "#000000",
          t2: "#252525",
          t3: "#4E4E4A",
          t4: "#767672",
          red: "#FF2319",
          green: "#00B341",
          amber: "#FF8800",
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"Space Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
