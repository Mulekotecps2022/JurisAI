import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        juris: {
          navy: "#14233b",
          blue: "#2457a7",
          teal: "#0f766e",
          canvas: "#f4f6fa"
        }
      }
    }
  },
  plugins: []
};

export default config;
