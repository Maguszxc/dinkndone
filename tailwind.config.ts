import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        court: {
          1: "#facc15", // yellow-400
          2: "#60a5fa", // blue-400
          3: "#4ade80", // green-400
          4: "#c084fc", // purple-400
          5: "#fb923c", // orange-400
          6: "#f472b6", // pink-400
        },
      },
    },
  },
  plugins: [],
};
export default config;
