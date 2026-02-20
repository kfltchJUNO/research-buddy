import type { Config } from "tailwindcss";

const config: Config = {
  // 경고의 원인! 테일윈드가 디자인 클래스를 찾아낼 파일 경로들을 지정합니다.
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 리서치버디의 시그니처 보라색 테마 설정
        violet: {
          50: '#f5f3ff',
          100: '#ede9fe',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
        },
      },
    },
  },
  plugins: [],
};

export default config;