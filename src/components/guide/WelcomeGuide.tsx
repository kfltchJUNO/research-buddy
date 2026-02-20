"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Brain, MessageSquare, X } from "lucide-react";

export default function WelcomeGuide() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const isVisited = localStorage.getItem("isResearchBuddyVisited");
    if (!isVisited) {
      setIsOpen(true);
      localStorage.setItem("isResearchBuddyVisited", "true");
    }
  }, []);

  const steps = [
    { icon: <Zap size={24}/>, title: "1. 스캔 (Scan)", desc: "파일을 올리자마자 3초 만에 핵심 키워드를 뽑아냅니다." },
    { icon: <Brain size={24}/>, title: "2. 이해 (Understand)", desc: "연구의 구조와 핵심 내용을 체계적으로 요약해드립니다." },
    { icon: <MessageSquare size={24}/>, title: "3. 통찰 (Think)", desc: "비판적 시각과 반박, 후속 질문으로 사고의 깊이를 더합니다." }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
            className="bg-white max-w-lg w-full rounded-[2.5rem] p-8 shadow-2xl relative"
          >
            <button onClick={() => setIsOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-black">
              <X size={24} />
            </button>

            <h2 className="text-3xl font-black mb-2">반갑습니다, 연구자님! 🖋️</h2>
            <p className="text-gray-500 mb-8 font-medium">리서치버디와 함께 연구의 깊이를 조절해보세요.</p>

            <div className="space-y-6 mb-8">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="bg-gray-100 p-3 rounded-2xl text-gray-900">{step.icon}</div>
                  <div>
                    <h4 className="font-bold text-gray-900">{step.title}</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setIsOpen(false)}
              className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:scale-[1.02] transition-transform"
            >
              지금 바로 시작하기
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}