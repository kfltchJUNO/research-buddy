export const fadeInSlideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } // 부드러운 '애플' 스타일 베지어 곡선
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1 // 자식 요소들이 0.1초 간격으로 순차적으로 등장
    }
  }
};