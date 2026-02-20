import { Toaster } from "react-hot-toast";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        {/* 토스트 알림이 뜰 위치 설정 */}
        <Toaster />
      </body>
    </html>
  );
}