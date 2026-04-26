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
          // LabRun brand accent (gradient midpoint).
          amber: "#3B36FC",
        },
        lr: {
          "accent-from": "#214DFC",
          "accent-to": "#561FFC",
          accent: "#3B36FC",
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
