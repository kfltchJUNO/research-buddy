"use client";

import { useEffect } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

export default function RollingNumber({ value }: { value: number }) {
  // 스프링 애니메이션 설정 (부드러움 조절)
  const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => 
    Math.round(current).toLocaleString()
  );

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}