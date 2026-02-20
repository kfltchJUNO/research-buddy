"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
  disabled?: boolean;
}

export default function PolishButton({ children, onClick, variant = 'primary', className, disabled }: ButtonProps) {
  const variants = {
    primary: "bg-black text-white hover:bg-gray-800 shadow-lg shadow-black/5",
    secondary: "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/10",
    outline: "bg-white border-2 border-gray-100 text-gray-600 hover:border-black hover:text-black",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }} // 쫀득한 클릭감의 핵심
      onClick={onClick}
      disabled={disabled}
      className={`
        relative overflow-hidden px-6 py-3 rounded-2xl font-bold transition-colors
        flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${className}
      `}
    >
      {children}
      {/* 반짝이는 오버레이 효과 (선택사항) */}
      <motion.div 
        className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" 
      />
    </motion.button>
  );
}